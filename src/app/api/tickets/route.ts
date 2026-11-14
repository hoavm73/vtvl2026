import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByOwner,
  getTicketsByUnit,
  upsertTicketAndSyncUnit,
  deleteTicketAndSyncUnit,
  allocateNextTaskCode,
  syncTicketsFromWorkbook,
  syncTicketsFromSupabase
} from '@/services/storage/server-ticket-store';
import {
  getOrCreateWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCallerSession } from '@/services/storage/server-auth-guard';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để truy cập phiếu công việc.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }

  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();

  // Kiểm soát phân quyền đa đơn vị (Tenant Isolation)
  if (!caller.isAdmin && unitCodeParam && unitCodeParam !== caller.unitCode) {
    return NextResponse.json(
      { error: 'Bạn không có quyền truy cập dữ liệu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
      { status: 403 }
    );
  }

  const effectiveUnitCode = caller.isAdmin && unitCodeParam ? unitCodeParam : caller.unitCode;
  const unit = findHcmuteUnit(effectiveUnitCode);

  await syncTicketsFromSupabase(unit.code);
  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', caller.email, caller.role);
  await syncTicketsFromWorkbook(wb.data, unit.code);

  // IDOR Protection: Nhân viên chỉ xem phiếu của chính mình, Admin/Leader xem được danh sách đơn vị
  const myTickets = getTicketsByOwner(caller.email, unit.code);
  const rawUnitTickets = getTicketsByUnit(unit.code);

  const unitTickets = caller.isAdmin || caller.isUnitLeader
    ? rawUnitTickets
    : rawUnitTickets.filter((t) => t.ownerEmail === caller.email || t.status === 'Đã nộp');

  return NextResponse.json({
    myTickets,
    unitTickets,
    unitCode: unit.code,
    unitNameVi: unit.nameVi,
    a1Missions: wb.data.A1 || [],
    c1Vtvls: wb.data.C1 || [],
    unitA2Tasks: wb.data.A2 || [],
    unitB1Volumes: wb.data.B1 || []
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để lập phiếu công việc.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const targetOwner = normalizeEmail(body.ownerEmail || caller.email);

    // IDOR & Spoofing Protection: Nhân viên không được tạo/sửa phiếu dưới danh nghĩa người khác
    if (!caller.isAdmin && targetOwner !== caller.email) {
      return NextResponse.json(
        { error: 'Bạn không có quyền thao tác trên phiếu của người khác.', code: 'FORBIDDEN_IDOR' },
        { status: 403 }
      );
    }

    const requestedUnitCode = (body.unitCode || caller.unitCode).toUpperCase();
    if (!caller.isAdmin && requestedUnitCode !== caller.unitCode) {
      return NextResponse.json(
        { error: 'Bạn không thể lập phiếu cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) {
      return NextResponse.json(
        { error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc cụ thể.' },
        { status: 400 }
      );
    }

    const existingTickets = getTicketsByUnit(requestedUnitCode);
    if (body.id) {
      const existing = existingTickets.find((t) => t.id === body.id);
      if (existing && existing.ownerEmail !== caller.email && !caller.isAdmin) {
        return NextResponse.json(
          { error: 'Bạn không có quyền cập nhật phiếu của người khác.', code: 'FORBIDDEN_IDOR' },
          { status: 403 }
        );
      }
    }

    const result = await upsertTicketAndSyncUnit({
      id: body.id,
      unitCode: requestedUnitCode,
      ownerEmail: targetOwner,
      ownerName: body.ownerName || caller.email.split('@')[0],
      ownerTitle: body.ownerTitle || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên'),
      status: body.status === 'Đã nộp' ? 'Đã nộp' : 'Nháp',
      maNhiemVu: String(body.maNhiemVu),
      maCongViec: String(body.maCongViec || ''),
      tenCongViec: String(body.tenCongViec),
      maVtvl: String(body.maVtvl),
      maVtvlPhoiHop: body.maVtvlPhoiHop ? String(body.maVtvlPhoiHop) : '',
      sanPham: String(body.sanPham || ''),
      chatLuong: String(body.chatLuong || ''),
      canCu: String(body.canCu || ''),
      soSpNam: Number(body.soSpNam) || 0,
      nguonSoLieu: String(body.nguonSoLieu || ''),
      phutThucTe: Number(body.phutThucTe) || 0,
      gioBoSung: Number(body.gioBoSung) || 0,
      coordinatedTasks: Array.isArray(body.coordinatedTasks) ? body.coordinatedTasks : []
    });

    return NextResponse.json({
      ok: true,
      ticket: result.ticket,
      unitWorkbookRevision: result.unitWorkbookRevision
    });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'REVISION_CONFLICT' || errorObj?.status === 409) {
      return NextResponse.json(
        { error: 'Xung đột phiên bản dữ liệu với máy chủ. Vui lòng tải lại và thử lại.', code: 'REVISION_CONFLICT' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Lưu phiếu công việc vào CSDL máy chủ thất bại. Vui lòng thử lại sau.', code: 'PERSISTENCE_FAILED' },
      { status: 502 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để xóa phiếu công việc.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ error: 'Thiếu mã phiếu cần xóa.' }, { status: 400 });
  }

  // IDOR & Cross-User Tampering: Phải kiểm tra quyền sở hữu phiếu
  const unitTickets = getTicketsByUnit(caller.unitCode);
  const targetTicket = unitTickets.find((t) => t.id === id);

  if (targetTicket && targetTicket.ownerEmail !== caller.email && !caller.isAdmin) {
    return NextResponse.json(
      { error: 'Bạn không có quyền xóa phiếu công việc của người khác.', code: 'FORBIDDEN_IDOR' },
      { status: 403 }
    );
  }

  try {
    const actor = caller.isAdmin ? (targetTicket?.ownerEmail || caller.email) : caller.email;
    const deleted = await deleteTicketAndSyncUnit(id, actor);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu hoặc bạn không có quyền xóa phiếu này.' }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'REVISION_CONFLICT' || errorObj?.status === 409) {
      return NextResponse.json(
        { error: 'Xung đột phiên bản dữ liệu khi xóa phiếu. Vui lòng thử lại.', code: 'REVISION_CONFLICT' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Xóa phiếu công việc trên máy chủ thất bại. Vui lòng thử lại sau.', code: 'PERSISTENCE_FAILED' },
      { status: 502 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const body = await req.json();
  const requestedUnit = (body.unitCode || caller.unitCode).toUpperCase();
  if (!caller.isAdmin && requestedUnit !== caller.unitCode) {
    return NextResponse.json(
      { error: 'Không thể cấp mã cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
      { status: 403 }
    );
  }

  const maNhiemVu = String(body.maNhiemVu || '').trim();
  if (!maNhiemVu) return NextResponse.json({ nextTaskCode: '' });

  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email, caller.role);
  const unitTickets = getTicketsByUnit(requestedUnit);
  const nextTaskCode = allocateNextTaskCode(requestedUnit, maNhiemVu, wb.data.A2 || [], unitTickets, body.excludeTicketId);
  return NextResponse.json({ nextTaskCode, maCongViec: nextTaskCode });
}
