import { getQd2266A1RowsForUnit } from '../../configs/hcmute-qd2266-missions';
import { StaffWorkTicket, toCanonicalStatus } from '../../types/staff-ticket';
import type { ShadcnSelectOption } from '../ui/ShadcnSelect';

export type PendingSubFilter = 'ALL' | 'WAITING' | 'SUBMITTED_NEW' | 'RESUBMITTED' | 'CHANGES';

export const NO_MISSION_KEY = '__NO_MISSION__';

export interface PendingCascadeResult {
  totalPendingCount: number;
  effectiveMission: string;
  effectiveOwner: string;
  effectiveStatus: PendingSubFilter;
  missionOptions: ShadcnSelectOption[];
  ownerOptions: ShadcnSelectOption[];
  statusOptions: ShadcnSelectOption[];
  filteredTickets: StaffWorkTicket[];
}

function truncateLabel(text: string, maxLen = 44): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export function getTicketMissionKey(t: StaffWorkTicket): string {
  const code = (t.maNhiemVu || '').trim();
  return code || NO_MISSION_KEY;
}

export function getTicketOwnerKey(t: StaffWorkTicket): string {
  return (t.ownerEmail || t.ownerName || t.id).trim().toLowerCase();
}

function matchesPendingStatus(t: StaffWorkTicket, filter: PendingSubFilter): boolean {
  const c = toCanonicalStatus(t.status);
  if (filter === 'WAITING') return c === 'submitted' || c === 'resubmitted';
  if (filter === 'SUBMITTED_NEW') return c === 'submitted';
  if (filter === 'RESUBMITTED') return c === 'resubmitted';
  if (filter === 'CHANGES') return c === 'changes_requested';
  return c === 'submitted' || c === 'resubmitted' || c === 'changes_requested';
}

function lookupMissionNameFromUnit(
  unitCode: string,
  maNhiemVu: string,
  cache: Map<string, Map<string, string>>
): string {
  const uc = unitCode.trim().toUpperCase();
  if (!uc || maNhiemVu === NO_MISSION_KEY) return '';
  let byCode = cache.get(uc);
  if (!byCode) {
    byCode = new Map<string, string>();
    for (const row of getQd2266A1RowsForUnit(uc)) {
      const code = String(row.maNhiemVu || '').trim().toUpperCase();
      const name = String(row.tenNhiemVu || '').trim();
      if (code && name && !byCode.has(code)) byCode.set(code, name);
    }
    cache.set(uc, byCode);
  }
  return byCode.get(maNhiemVu.trim().toUpperCase()) || '';
}

/** Tính toán 3 tầng bộ lọc liên thông (Nhiệm vụ -> Người khai -> Trạng thái duyệt) cho tab Chờ duyệt & Yêu cầu bổ sung. */
export function buildPendingCascadeState(
  unitScopedTickets: StaffWorkTicket[],
  missionFilter: string,
  ownerFilter: string,
  statusFilter: PendingSubFilter
): PendingCascadeResult {
  const pendingPool = unitScopedTickets.filter((t) => matchesPendingStatus(t, 'ALL'));
  const unitMissionCache = new Map<string, Map<string, string>>();

  // Tầng 1: Nhiệm vụ (Biểu A1)
  const missionGroups = new Map<string, { code: string; name: string; count: number }>();
  for (const t of pendingPool) {
    const key = getTicketMissionKey(t);
    const snapName = t.versions?.[t.versions.length - 1]?.snapshot?.tenNhiemVuSnapshot?.trim() || '';
    const existing = missionGroups.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.name && snapName) existing.name = snapName;
    } else {
      const name = snapName || lookupMissionNameFromUnit(t.unitCode || '', key, unitMissionCache);
      missionGroups.set(key, { code: key, name, count: 1 });
    }
  }

  const sortedMissions = Array.from(missionGroups.values()).sort((a, b) => {
    if (a.code === NO_MISSION_KEY) return 1;
    if (b.code === NO_MISSION_KEY) return -1;
    return a.code.localeCompare(b.code, 'vi');
  });

  const missionOptions: ShadcnSelectOption[] = [
    { value: 'ALL', label: `Tất cả nhiệm vụ (${pendingPool.length})` },
    ...sortedMissions.map((m) => {
      if (m.code === NO_MISSION_KEY) return { value: m.code, label: `Chưa gắn nhiệm vụ (${m.count})` };
      const titlePart = m.name ? ` — ${truncateLabel(m.name)}` : '';
      return { value: m.code, label: `${m.code}${titlePart} (${m.count})` };
    })
  ];

  const effectiveMission = missionFilter !== 'ALL' && missionGroups.has(missionFilter) ? missionFilter : 'ALL';
  const afterMissionTickets = effectiveMission === 'ALL'
    ? pendingPool
    : pendingPool.filter((t) => getTicketMissionKey(t) === effectiveMission);

  // Tầng 2: Người khai (lọc động theo Nhiệm vụ đang chọn)
  const ownerGroups = new Map<string, { key: string; name: string; email: string; count: number }>();
  const duplicateNames = new Map<string, number>();
  for (const t of afterMissionTickets) {
    const key = getTicketOwnerKey(t);
    const name = (t.ownerName || t.ownerEmail || 'Chưa rõ người khai').trim();
    const existing = ownerGroups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      ownerGroups.set(key, { key, name, email: (t.ownerEmail || '').trim(), count: 1 });
      duplicateNames.set(name.toLowerCase(), (duplicateNames.get(name.toLowerCase()) || 0) + 1);
    }
  }

  const sortedOwners = Array.from(ownerGroups.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const ownerOptions: ShadcnSelectOption[] = [
    { value: 'ALL', label: `Tất cả người khai (${afterMissionTickets.length})` },
    ...sortedOwners.map((o) => {
      const hasDup = (duplicateNames.get(o.name.toLowerCase()) || 0) > 1 && o.email;
      const emailShort = hasDup ? ` · ${o.email.split('@')[0]}` : '';
      return { value: o.key, label: `${o.name}${emailShort} (${o.count})` };
    })
  ];

  const effectiveOwner = ownerFilter !== 'ALL' && ownerGroups.has(ownerFilter) ? ownerFilter : 'ALL';
  const afterOwnerTickets = effectiveOwner === 'ALL'
    ? afterMissionTickets
    : afterMissionTickets.filter((t) => getTicketOwnerKey(t) === effectiveOwner);

  // Tầng 3: Trạng thái duyệt (lọc động theo Nhiệm vụ + Người khai đang chọn)
  let submittedNewCount = 0;
  let resubmittedCount = 0;
  let changesCount = 0;
  for (const t of afterOwnerTickets) {
    const c = toCanonicalStatus(t.status);
    if (c === 'submitted') submittedNewCount += 1;
    else if (c === 'resubmitted') resubmittedCount += 1;
    else if (c === 'changes_requested') changesCount += 1;
  }
  const waitingCount = submittedNewCount + resubmittedCount;

  const statusOptions: ShadcnSelectOption[] = [
    { value: 'ALL', label: `Tất cả trạng thái (${afterOwnerTickets.length})` }
  ];
  if (waitingCount > 0) statusOptions.push({ value: 'WAITING', label: `Chờ phê duyệt (${waitingCount})` });
  if (submittedNewCount > 0 && resubmittedCount > 0) {
    statusOptions.push({ value: 'SUBMITTED_NEW', label: `Đã nộp lần đầu (${submittedNewCount})` });
    statusOptions.push({ value: 'RESUBMITTED', label: `Đã nộp lại (${resubmittedCount})` });
  } else if (resubmittedCount > 0) {
    statusOptions.push({ value: 'RESUBMITTED', label: `Đã nộp lại (${resubmittedCount})` });
  }
  if (changesCount > 0) statusOptions.push({ value: 'CHANGES', label: `Yêu cầu bổ sung (${changesCount})` });

  const validStatusSet = new Set(statusOptions.map((o) => o.value));
  const effectiveStatus: PendingSubFilter = validStatusSet.has(statusFilter) ? statusFilter : 'ALL';

  const filteredTickets = afterOwnerTickets
    .filter((t) => matchesPendingStatus(t, effectiveStatus))
    .sort((a, b) =>
      (b.revisionRequestedAt || b.resubmittedAt || b.submittedAt || b.updatedAt).localeCompare(
        a.revisionRequestedAt || a.resubmittedAt || a.submittedAt || a.updatedAt
      )
    );

  return {
    totalPendingCount: pendingPool.length,
    effectiveMission,
    effectiveOwner,
    effectiveStatus,
    missionOptions,
    ownerOptions,
    statusOptions,
    filteredTickets
  };
}
