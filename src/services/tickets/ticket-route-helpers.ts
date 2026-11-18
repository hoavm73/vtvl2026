import { NextRequest, NextResponse } from 'next/server';
import { getWorkbookForUnitReadOnly, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { getTicketById, getTicketsByOwner, getTicketsByUnit, loadTickets, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { ensureLegacyBaselineVersion } from '@/services/storage/server-ticket-version-store';
import { syncVersionsCacheFromSupabase } from '@/services/storage/server-coordination-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { CallerAuthContext } from '@/services/storage/server-auth-guard';
import { CanonicalTicketStatus, StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { normalizeCoordinatedVtvls, resolveUnitCodeSafe } from './vtvl-coordination-helpers';
import { paginateTicketsWithCursor, queryTicketsFromPostgresPaginated } from './ticket-query-service';

export async function executeGetTicketsRoute(req: NextRequest, caller: CallerAuthContext): Promise<NextResponse> {
  const singleTicketId = (req.nextUrl.searchParams.get('id') || '').trim();
  if (singleTicketId) {
    await syncVersionsCacheFromSupabase().catch(() => {});
    let found = getTicketById(singleTicketId);
    if (!found) { await syncTicketsFromSupabase().catch(() => {}); found = getTicketById(singleTicketId); }
    if (!found || (found.isArchived && !caller.isAdmin)) return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    if (!caller.isAdmin && found.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) return NextResponse.json({ error: 'Bạn không có quyền xem phiếu hoặc lịch sử phiên bản của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    if (!caller.isAdmin && toCanonicalStatus(found.status) === 'draft' && normalizeEmail(found.ownerEmail) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Phiếu Nháp chỉ chủ sở hữu và Quản trị viên mới được xem.', code: 'FORBIDDEN_DRAFT_ACCESS' }, { status: 403 });
    return NextResponse.json({ ticket: found, versions: ensureLegacyBaselineVersion(found) });
  }

  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  if (!caller.isAdmin && unitCodeParam && unitCodeParam !== caller.unitCode) return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  const isAllUnits = caller.isAdmin && unitCodeParam === 'ALL';
  const requestedCode = caller.isAdmin && unitCodeParam && !isAllUnits ? resolveUnitCodeSafe(unitCodeParam) : caller.unitCode;
  const unit = findHcmuteUnit(requestedCode);
  const queryCode = isAllUnits ? 'ALL' : (caller.isAdmin && unitCodeParam ? requestedCode : unit.code);
  const isKnownUnit = isAllUnits || unit.code.toUpperCase() === queryCode.toUpperCase();

  const cursorParam = req.nextUrl.searchParams.get('cursor');
  const limitParam = req.nextUrl.searchParams.get('limit');
  const viewParam = req.nextUrl.searchParams.get('view') === 'full' ? 'full' : 'list';
  const statusParam = (req.nextUrl.searchParams.get('status') || '').trim();
  const isPaginatedQuery = cursorParam !== null || limitParam !== null || req.nextUrl.searchParams.get('view') === 'list';

  if (isPaginatedQuery) {
    const dbPage = await queryTicketsFromPostgresPaginated({
      unitCode: queryCode, callerEmail: caller.email, includeDraftsOfOthers: caller.isAdmin,
      status: statusParam ? (toCanonicalStatus(statusParam) as CanonicalTicketStatus) : undefined,
      cursor: cursorParam, limit: limitParam ? Number(limitParam) : 50, view: viewParam
    });
    if (dbPage) {
      return NextResponse.json({
        ok: true, items: dbPage.items, tickets: dbPage.items, unitTickets: dbPage.items,
        nextCursor: dbPage.nextCursor, hasMore: dbPage.hasMore, totalCount: dbPage.totalCount, limit: dbPage.limit,
        unitCode: queryCode === 'ALL' ? unit.code : queryCode, unitNameVi: isKnownUnit ? unit.nameVi : queryCode
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  await syncTicketsFromSupabase(isAllUnits ? undefined : queryCode, false);
  if (isPaginatedQuery) {
    const uc = queryCode.toUpperCase();
    const normCaller = normalizeEmail(caller.email);
    const rawFiltered = Array.from(loadTickets().values()).filter((t) => {
      if (t.isTestData || t.isArchived) return false;
      if (uc !== 'ALL' && t.unitCode.toUpperCase() !== uc) return false;
      if (!caller.isAdmin && normalizeEmail(t.ownerEmail) !== normCaller && toCanonicalStatus(t.status) === 'draft') return false;
      if (statusParam && toCanonicalStatus(t.status) !== toCanonicalStatus(statusParam)) return false;
      return true;
    });
    const page = paginateTicketsWithCursor(rawFiltered, {
      cursor: cursorParam,
      limit: limitParam ? Number(limitParam) : 50,
      view: viewParam,
      alreadyEnriched: false
    });
    return NextResponse.json({
      ok: true, items: page.items, tickets: page.items, unitTickets: page.items,
      nextCursor: page.nextCursor, hasMore: page.hasMore, totalCount: page.totalCount, limit: page.limit,
      unitCode: queryCode === 'ALL' ? unit.code : queryCode, unitNameVi: isKnownUnit ? unit.nameVi : queryCode
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (isKnownUnit) await syncServerWorkbooksFromSupabase(false);
  const latestWb = isKnownUnit ? getWorkbookForUnitReadOnly(unit.code) : null;
  const rawMyTickets = getTicketsByOwner(caller.email, queryCode === 'ALL' ? unit.code : queryCode);
  const rawUnitTickets = getTicketsByUnit(queryCode);
  const visibleUnitTickets = caller.isAdmin
    ? rawUnitTickets
    : rawUnitTickets.filter((t) => normalizeEmail(t.ownerEmail) === normalizeEmail(caller.email) || toCanonicalStatus(t.status) !== 'draft');

  return NextResponse.json({
    myTickets: rawMyTickets,
    unitTickets: visibleUnitTickets,
    unitCode: queryCode === 'ALL' ? unit.code : queryCode,
    unitNameVi: isKnownUnit ? unit.nameVi : queryCode,
    a1Missions: latestWb?.data.A1 || [],
    c1Vtvls: latestWb?.data.C1 || [],
    unitA2Tasks: latestWb?.data.A2 || [],
    unitB1Volumes: latestWb?.data.B1 || []
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export function handleTicketRouteError(err: unknown, defaultMessage: string) {
  const errObj = err as { code?: string; status?: number; message?: string };
  if (errObj?.code === 'REVISION_CONFLICT' || errObj?.code === 'DUPLICATE_BUSINESS_CODE' || errObj?.status === 409) {
    return NextResponse.json(
      { error: errObj.message || 'Xung đột phiên bản dữ liệu máy chủ.', code: errObj.code || 'REVISION_CONFLICT' },
      { status: 409 }
    );
  }
  if (errObj?.code === 'DATABASE_SCHEMA_OUTDATED') {
    return NextResponse.json({ error: errObj.message || 'Lược đồ CSDL chưa cập nhật.', code: 'DATABASE_SCHEMA_OUTDATED' }, { status: 500 });
  }
  if (errObj?.code === 'VERSION_SNAPSHOT_FAILED' || errObj?.code === 'DB_VERSION_WRITE_FAILED') {
    return NextResponse.json({ error: errObj.message || 'Lỗi lưu phiên bản phiếu.', code: errObj.code }, { status: 500 });
  }
  return NextResponse.json({ error: errObj?.message || defaultMessage, code: errObj?.code || 'PERSISTENCE_FAILED' }, { status: errObj?.status || 502 });
}

export function isSameEditablePayload(
  ex: StaffWorkTicket,
  body: Record<string, unknown>,
  effectiveUnit: string,
  changeSummary?: string
): boolean {
  const nextCoord = normalizeCoordinatedVtvls(body.coordinatedVtvls as StaffWorkTicket['coordinatedVtvls'], ex.unitCode || effectiveUnit);
  return (
    ex.tenCongViec.trim() === String(body.tenCongViec || '').trim() &&
    ex.maVtvl.trim() === String(body.maVtvl || '').trim() &&
    (ex.maVtvlPhoiHop || '').trim() === String(body.maVtvlPhoiHop || '').trim() &&
    (ex.coordinationNote || '').trim() === String(body.coordinationNote || '').trim() &&
    JSON.stringify(ex.coordinatedVtvls || []) === JSON.stringify(nextCoord) &&
    (ex.sanPham || '').trim() === String(body.sanPham || '').trim() &&
    (ex.chatLuong || '').trim() === String(body.chatLuong || '').trim() &&
    (ex.canCu || '').trim() === String(body.canCu || '').trim() &&
    Number(ex.soSpNam) === (Number(body.soSpNam) || 0) &&
    (ex.nguonSoLieu || '').trim() === String(body.nguonSoLieu || '').trim() &&
    Number(ex.phutThucTe) === (Number(body.phutThucTe) || 0) &&
    Number(ex.gioBoSung) === (Number(body.gioBoSung) || 0) &&
    (!changeSummary || changeSummary === (ex.lastChangeSummary || ''))
  );
}

export function validateMutableTicket(ex: StaffWorkTicket | null, callerEmail: string): NextResponse | null {
  if (!ex) return null;
  if (normalizeEmail(ex.ownerEmail) !== normalizeEmail(callerEmail)) {
    return NextResponse.json({ error: 'Chỉ chủ sở hữu mới được phép sửa nội dung phiếu kê khai của mình.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (ex.isMergedToB1B2) {
    return NextResponse.json({ error: 'Phiếu đã được gộp vào Biểu B1/B2 nên không thể chỉnh sửa nội dung nguồn.', code: 'FORBIDDEN_TICKET_MERGED' }, { status: 403 });
  }
  if (toCanonicalStatus(ex.status) === 'approved') {
    return NextResponse.json({ error: 'Phiếu đã được duyệt nên không thể tiếp tục chỉnh sửa. Vui lòng tải lại dữ liệu.', code: 'FORBIDDEN_TICKET_APPROVED' }, { status: 403 });
  }
  if (ex.isArchived) {
    return NextResponse.json({ error: 'Phiếu đã bị hủy hoặc khóa nên không thể chỉnh sửa.', code: 'FORBIDDEN_TICKET_LOCKED' }, { status: 403 });
  }
  return null;
}
