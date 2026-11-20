import { Prisma } from '@prisma/client';
import {
  CanonicalTicketStatus,
  StaffWorkTicket,
  toCanonicalStatus
} from '@/types/staff-ticket';
import { findHcmuteUnit, getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { isDatabaseConfigured, prisma } from '@/services/storage/prisma';
import { cacheGetOrSet } from '@/services/storage/runtime-cache';
import { DbTicketRow, isIsolatedLocalMode, mapDbRowToTicket } from '@/services/storage/server-ticket-db';
import { enrichTicket, loadTickets } from '@/services/storage/server-ticket-store';

export type TicketDtoView = 'list' | 'full';

/**
 * List DTO nhẹ cho danh sách 200–500+ phiếu/đơn vị:
 * - Không chứa mảng `versions` (snapshot JSON), không chứa full `mergeLinks` hay workbook JSON.
 * - Chỉ giữ tối đa 1 mục `statusHistory` gần nhất kèm `versionCount` và `historyCount`.
 */
export function toTicketListDto(ticket: StaffWorkTicket): StaffWorkTicket {
  const versionCount = Array.isArray(ticket.versions) ? ticket.versions.length : (ticket.currentVersionNo || 0);
  const historyList = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const latestHistory = historyList.length > 0 ? [historyList[historyList.length - 1]] : [];

  return {
    id: ticket.id, unitCode: ticket.unitCode, unitId: ticket.unitId || ticket.unitCode,
    ownerEmail: ticket.ownerEmail, ownerId: ticket.ownerId || ticket.ownerEmail,
    ownerName: ticket.ownerName, ownerTitle: ticket.ownerTitle, status: ticket.status,
    maNhiemVu: ticket.maNhiemVu, maCongViec: ticket.maCongViec, tenCongViec: ticket.tenCongViec,
    maVtvl: ticket.maVtvl, maVtvlPhoiHop: ticket.maVtvlPhoiHop,
    coordinationNote: ticket.coordinationNote, coordinatedVtvls: ticket.coordinatedVtvls,
    coordinatedTasks: ticket.coordinatedTasks,
    sanPham: ticket.sanPham, chatLuong: ticket.chatLuong, canCu: ticket.canCu,
    soSpNam: ticket.soSpNam, nguonSoLieu: ticket.nguonSoLieu,
    phutThucTe: ticket.phutThucTe, gioBoSung: ticket.gioBoSung,
    sourceTicketId: ticket.sourceTicketId, submittedAt: ticket.submittedAt, resubmittedAt: ticket.resubmittedAt,
    approvedAt: ticket.approvedAt, approvedBy: ticket.approvedBy, approvedByName: ticket.approvedByName,
    revisionReason: ticket.revisionReason, revisionRequestedAt: ticket.revisionRequestedAt,
    revisionRequestedBy: ticket.revisionRequestedBy, revisionRequestedByName: ticket.revisionRequestedByName,
    mergedAt: ticket.mergedAt, mergedBy: ticket.mergedBy, mergedByName: ticket.mergedByName,
    a2RowId: ticket.a2RowId, b1RowId: ticket.b1RowId, b2RowId: ticket.b2RowId,
    isMergedToB1B2: Boolean(ticket.isMergedToB1B2), currentVersionNo: Number(ticket.currentVersionNo) || 0,
    revision: Number(ticket.revision ?? ticket.currentVersionNo ?? 1),
    versionCount, historyCount: historyList.length, lastChangeSummary: ticket.lastChangeSummary,
    isTestData: ticket.isTestData, isArchived: ticket.isArchived, statusHistory: latestHistory,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt
  };
}

export function encodeTicketCursor(item: { updatedAt: string; id: string }): string {
  return Buffer.from(`${item.updatedAt}|${item.id}`, 'utf8').toString('base64url');
}

export function decodeTicketCursor(cursor?: string | null): { updatedAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.lastIndexOf('|');
    if (sep <= 0) return null;
    const updatedAt = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!updatedAt || !id || Number.isNaN(Date.parse(updatedAt))) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

export function compareTicketsDesc(a: { updatedAt: string; id: string }, b: { updatedAt: string; id: string }): number {
  const cmp = b.updatedAt.localeCompare(a.updatedAt);
  if (cmp !== 0) return cmp;
  return b.id.localeCompare(a.id);
}

export interface PaginatedTicketResult {
  items: StaffWorkTicket[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  limit: number;
}

export function paginateTicketsWithCursor(
  tickets: StaffWorkTicket[],
  options: { cursor?: string | null; limit?: number; view?: TicketDtoView; alreadyEnriched?: boolean }
): PaginatedTicketResult {
  const safeLimit = Math.max(1, Math.min(200, Number(options.limit) || 50));
  const sorted = [...tickets].sort(compareTicketsDesc);
  const parsed = decodeTicketCursor(options.cursor);

  const afterCursor = parsed
    ? sorted.filter((t) => {
        const cmp = t.updatedAt.localeCompare(parsed.updatedAt);
        return cmp < 0 || (cmp === 0 && t.id.localeCompare(parsed.id) < 0);
      })
    : sorted;

  const pageSlice = afterCursor.slice(0, safeLimit);
  const hasMore = afterCursor.length > safeLimit;
  const last = pageSlice[pageSlice.length - 1];
  const nextCursor = hasMore && last ? encodeTicketCursor(last) : null;

  const mapped = pageSlice.map((item) => {
    const base = options.alreadyEnriched ? item : enrichTicket(item);
    return options.view === 'full' ? base : toTicketListDto(base);
  });

  return { items: mapped, nextCursor, hasMore, totalCount: sorted.length, limit: safeLimit };
}

export async function queryTicketsFromPostgresPaginated(params: {
  unitCode?: string;
  ownerEmail?: string;
  status?: CanonicalTicketStatus;
  callerEmail?: string;
  includeDraftsOfOthers?: boolean;
  cursor?: string | null;
  limit?: number;
  view?: TicketDtoView;
}): Promise<PaginatedTicketResult | null> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return null;
  const safeLimit = Math.max(1, Math.min(200, Number(params.limit) || 50));
  const unitSeg = params.unitCode && params.unitCode !== 'ALL' ? `u:${params.unitCode.trim().toUpperCase()}` : 'scope:ALL';
  const cacheKey = `tickets:list:|${unitSeg}|e:${(params.callerEmail || '').toLowerCase().trim()}|inc:${params.includeDraftsOfOthers ? '1' : '0'}|own:${(params.ownerEmail || '').toLowerCase().trim()}|st:${params.status || ''}|cur:${params.cursor || ''}|lim:${safeLimit}|v:${params.view || 'list'}`;

  return cacheGetOrSet(cacheKey, ['tickets'], 3000, async () => {
    const parsedCursor = decodeTicketCursor(params.cursor);
    const whereAnd: Prisma.staff_work_ticketsWhereInput[] = [{ is_archived: false, is_test_data: false }];
    if (params.unitCode && params.unitCode !== 'ALL') whereAnd.push({ unit_code: params.unitCode.toUpperCase() });
    if (params.ownerEmail) whereAnd.push({ owner_email: params.ownerEmail.toLowerCase().trim() });
    if (params.status) whereAnd.push({ status: params.status });
    if (!params.includeDraftsOfOthers && params.callerEmail) {
      whereAnd.push({ OR: [{ status: { not: 'draft' } }, { owner_email: params.callerEmail.toLowerCase().trim() }] });
    }

    const baseWhere: Prisma.staff_work_ticketsWhereInput = { AND: whereAnd };
    const pageWhere: Prisma.staff_work_ticketsWhereInput = parsedCursor
      ? { AND: [...whereAnd, { OR: [{ updated_at: { lt: new Date(parsedCursor.updatedAt) } }, { updated_at: new Date(parsedCursor.updatedAt), id: { lt: parsedCursor.id } }] }] }
      : baseWhere;

    const rows = await prisma.staff_work_tickets.findMany({
      where: pageWhere,
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1
    });
    const hasMore = rows.length > safeLimit;
    const totalCount = (parsedCursor || hasMore) ? await prisma.staff_work_tickets.count({ where: baseWhere }) : rows.length;
    const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
    const mapped = sliced.map((r) => {
      const ticket = mapDbRowToTicket(r as unknown as DbTicketRow);
      return params.view === 'full' ? ticket : toTicketListDto(ticket);
    });
    const last = mapped[mapped.length - 1];
    return {
      items: mapped,
      nextCursor: hasMore && last ? encodeTicketCursor(last) : null,
      hasMore,
      totalCount,
      limit: safeLimit
    };
  });
}

export interface UnitOverviewAggregate {
  unitCode: string;
  unitNameVi: string;
  total: number;
  draft: number;
  submitted: number;
  resubmitted: number;
  changesRequested: number;
  approved: number;
  merged: number;
  unmergedApproved: number;
}

export async function getAdminOverviewSqlAggregate(unitCode?: string): Promise<{
  totals: Omit<UnitOverviewAggregate, 'unitCode' | 'unitNameVi'>;
  units: UnitOverviewAggregate[];
  source: 'sql_aggregate' | 'memory_aggregate';
}> {
  const scope = (unitCode || 'ALL').trim().toUpperCase();
  const cacheKey = `admin:overview:agg:${scope}`;

  return cacheGetOrSet(cacheKey, ['overview-stats', 'tickets'], 5000, async () => {
    const unitMap = new Map<string, UnitOverviewAggregate>();
    const activeUnits = scope === 'ALL' ? getActiveHcmuteUnits() : [findHcmuteUnit(scope)];
    for (const u of activeUnits) {
      unitMap.set(u.code.toUpperCase(), {
        unitCode: u.code, unitNameVi: u.nameVi, total: 0, draft: 0, submitted: 0,
        resubmitted: 0, changesRequested: 0, approved: 0, merged: 0, unmergedApproved: 0
      });
    }

    const applyRow = (uc: string, statusRaw: string, isMerged: boolean, count: number) => {
      const code = uc.toUpperCase();
      const entry = unitMap.get(code) || {
        unitCode: code, unitNameVi: findHcmuteUnit(code).nameVi, total: 0, draft: 0, submitted: 0,
        resubmitted: 0, changesRequested: 0, approved: 0, merged: 0, unmergedApproved: 0
      };
      const st = toCanonicalStatus(statusRaw);
      entry.total += count;
      if (st === 'draft') entry.draft += count;
      else if (st === 'submitted') entry.submitted += count;
      else if (st === 'resubmitted') entry.resubmitted += count;
      else if (st === 'changes_requested') entry.changesRequested += count;
      else if (st === 'approved') {
        entry.approved += count;
        if (isMerged) entry.merged += count;
        else entry.unmergedApproved += count;
      }
      unitMap.set(code, entry);
    };

    let usedSql = false;
    if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
      try {
        const rows = scope === 'ALL'
          ? await prisma.$queryRaw<Array<{ unit_code: string; status: string; is_merged_to_b1_b2: boolean; total: number }>>`
              SELECT unit_code, status, is_merged_to_b1_b2, COUNT(*)::int AS total
              FROM public.staff_work_tickets
              WHERE is_archived = false AND is_test_data = false
              GROUP BY unit_code, status, is_merged_to_b1_b2
            `
          : await prisma.$queryRaw<Array<{ unit_code: string; status: string; is_merged_to_b1_b2: boolean; total: number }>>`
              SELECT unit_code, status, is_merged_to_b1_b2, COUNT(*)::int AS total
              FROM public.staff_work_tickets
              WHERE is_archived = false AND is_test_data = false AND unit_code = ${scope}
              GROUP BY unit_code, status, is_merged_to_b1_b2
            `;
        for (const r of rows) applyRow(String(r.unit_code || ''), String(r.status || 'draft'), Boolean(r.is_merged_to_b1_b2), Number(r.total) || 0);
        usedSql = true;
      } catch {
        // fallback to in-memory aggregate if test DB unreachable
      }
    }

    if (!usedSql) {
      for (const t of loadTickets().values()) {
        if (t.isArchived || t.isTestData) continue;
        if (scope !== 'ALL' && t.unitCode.toUpperCase() !== scope) continue;
        applyRow(t.unitCode, t.status, Boolean(t.isMergedToB1B2), 1);
      }
    }

    const units = Array.from(unitMap.values());
    const totals = units.reduce(
      (acc, u) => ({
        total: acc.total + u.total, draft: acc.draft + u.draft, submitted: acc.submitted + u.submitted,
        resubmitted: acc.resubmitted + u.resubmitted, changesRequested: acc.changesRequested + u.changesRequested,
        approved: acc.approved + u.approved, merged: acc.merged + u.merged, unmergedApproved: acc.unmergedApproved + u.unmergedApproved
      }),
      { total: 0, draft: 0, submitted: 0, resubmitted: 0, changesRequested: 0, approved: 0, merged: 0, unmergedApproved: 0 }
    );
    return { totals, units, source: usedSql ? 'sql_aggregate' : 'memory_aggregate' };
  }, { forceSingleFlight: true });
}
