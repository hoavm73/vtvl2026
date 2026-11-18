import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { getAllReplacedWorkCodes } from './server-coordination-store';
import { getTicketVersions } from './server-ticket-version-store';
import { allocateTaskCodeAtomic, getMissionCounterWatermark } from './server-mission-counter';

export function computeMaxMissionSeq(
  unitCode: string,
  missionCode: string,
  a2Rows: GenericGridRow[],
  existingTickets: StaffWorkTicket[],
  excludeTicketId?: string
): number {
  const cleanMission = missionCode.trim();
  if (!cleanMission) return 0;
  const pattern = new RegExp(`^${cleanMission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.CV(\\d+)$`, 'i');
  let maxNum = 0;
  const checkCode = (raw?: string) => {
    const match = String(raw || '').trim().match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  };
  for (const row of a2Rows) checkCode(String(row.maCongViec || ''));
  for (const r of getAllReplacedWorkCodes(unitCode)) {
    checkCode(r.oldWorkCode);
    checkCode(r.newWorkCode);
  }
  for (const t of existingTickets) {
    if (t.unitCode.toUpperCase() !== unitCode.toUpperCase()) continue;
    for (const v of getTicketVersions(t.id)) checkCode(v.snapshot?.maCongViec);
    for (const r of t.replacedWorkCodes || []) { checkCode(r.oldWorkCode); checkCode(r.newWorkCode); }
    for (const h of t.statusHistory || []) {
      checkCode(h.oldWorkCode);
      checkCode(h.newWorkCode);
      const m = String(h.reason || '').match(/Mã công việc được thay đổi từ\s+([^\s;]+)\s+sang\s+([^\s.;]+)/i);
      if (m) { checkCode(m[1]); checkCode(m[2]); }
    }
    if (t.id === excludeTicketId) continue;
    checkCode(t.maCongViec);
  }
  return maxNum;
}

export function allocateNextTaskCode(
  unitCode: string,
  missionCode: string,
  a2Rows: GenericGridRow[],
  existingTickets: StaffWorkTicket[],
  excludeTicketId?: string
): string {
  const cleanMission = missionCode.trim();
  if (!cleanMission) return '';
  const maxNum = computeMaxMissionSeq(unitCode, missionCode, a2Rows, existingTickets, excludeTicketId);
  return `${cleanMission}.CV${String(maxNum + 1).padStart(2, '0')}`;
}

export async function allocateNextTaskCodeAsync(
  unitCode: string,
  missionCode: string,
  a2Rows: GenericGridRow[],
  existingTickets: StaffWorkTicket[],
  excludeTicketId?: string
): Promise<string> {
  const cleanMission = missionCode.trim();
  if (!cleanMission) return '';
  const watermark = !excludeTicketId ? getMissionCounterWatermark(unitCode, cleanMission) : undefined;
  const seedMax = watermark !== undefined ? watermark : computeMaxMissionSeq(unitCode, missionCode, a2Rows, existingTickets, excludeTicketId);
  return allocateTaskCodeAtomic(unitCode, cleanMission, seedMax);
}
