import {
  CoordinatedVtvlEntry,
  StaffWorkTicket,
  UserVtvlAssignment,
  WorkRelationshipItem,
  WorkSurveyVersion
} from '@/types/staff-ticket';
import { replaceUnitCodeList, replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { makeStableCoordinatedVtvlId, normalizeCode } from '@/services/tickets/vtvl-coordination-helpers';
import { makeWorkRelationshipId, WorkRelationshipStoreState } from './server-work-relationship-store';
import { CoordinationDiskState } from './server-coordination-store';

export function cloneJson<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

export function updateCoordVtvlsList(
  list: CoordinatedVtvlEntry[] | undefined,
  cOld: string,
  cNew: string,
  newNameVi?: string
): { updated: CoordinatedVtvlEntry[] | undefined; changed: boolean } {
  if (!Array.isArray(list)) return { updated: list, changed: false };
  let changed = false;
  const updated = list.map((cv) => {
    if ((cv.targetUnitCode || '').trim().toUpperCase() !== cOld) return cv;
    changed = true;
    const nextVtvl = replaceUnitCodePrefix(cv.maVtvl, cOld, cNew);
    return {
      ...cv,
      targetUnitCode: cNew,
      targetUnitName: newNameVi || cv.targetUnitName,
      maVtvl: nextVtvl,
      id: makeStableCoordinatedVtvlId(cNew, nextVtvl)
    };
  });
  return { updated, changed };
}

export function stageTicketsMigration(
  stagedTickets: StaffWorkTicket[],
  cOld: string,
  cNew: string,
  newNameVi?: string
): { toPersist: StaffWorkTicket[]; migratedTickets: number; migratedCoordinatedTickets: number } {
  const nowIso = new Date().toISOString();
  const toPersist: StaffWorkTicket[] = [];
  let migratedTickets = 0;
  let migratedCoordinatedTickets = 0;

  for (const ticket of stagedTickets) {
    const isOwner = ticket.unitCode.trim().toUpperCase() === cOld;
    let coordChanged = false;

    if (isOwner) {
      ticket.immutableUnitId = ticket.immutableUnitId || ticket.unitId || cOld;
      ticket.unitCode = cNew;
      ticket.unitId = cNew;
      ticket.maNhiemVu = replaceUnitCodePrefix(ticket.maNhiemVu, cOld, cNew);
      ticket.maCongViec = replaceUnitCodePrefix(ticket.maCongViec, cOld, cNew);
      ticket.maVtvl = replaceUnitCodePrefix(ticket.maVtvl, cOld, cNew);
      if (Array.isArray(ticket.statusHistory)) {
        ticket.statusHistory = ticket.statusHistory.map((h) =>
          (h.unitId || '').trim().toUpperCase() === cOld ? { ...h, unitId: cNew } : h
        );
      }
      migratedTickets++;
    }

    if (ticket.maVtvlPhoiHop) {
      const nextPhoiHop = replaceUnitCodeList(ticket.maVtvlPhoiHop, cOld, cNew);
      if (nextPhoiHop !== ticket.maVtvlPhoiHop) {
        ticket.maVtvlPhoiHop = nextPhoiHop;
        coordChanged = true;
      }
    }

    const cvRes = updateCoordVtvlsList(ticket.coordinatedVtvls, cOld, cNew, newNameVi);
    if (cvRes.changed) {
      ticket.coordinatedVtvls = cvRes.updated;
      coordChanged = true;
    }

    if (Array.isArray(ticket.coordinatedTasks)) {
      ticket.coordinatedTasks = ticket.coordinatedTasks.map((ct) => {
        if ((ct.targetUnitCode || '').trim().toUpperCase() !== cOld) return ct;
        coordChanged = true;
        return {
          ...ct,
          targetUnitCode: cNew,
          targetUnitName: newNameVi || ct.targetUnitName,
          targetTaskCode: replaceUnitCodePrefix(ct.targetTaskCode, cOld, cNew)
        };
      });
    }

    if (isOwner || coordChanged) {
      if (!isOwner && coordChanged) migratedCoordinatedTickets++;
      ticket.updatedAt = nowIso;
      toPersist.push(ticket);
    }
  }
  return { toPersist, migratedTickets, migratedCoordinatedTickets };
}

export function stageAssignmentsMigration(
  raw: UserVtvlAssignment[],
  cOld: string,
  cNew: string
): { merged: UserVtvlAssignment[]; migrated: UserVtvlAssignment[]; count: number } {
  const nowIso = new Date().toISOString();
  const dedupe = new Map<string, UserVtvlAssignment>();
  const migrated: UserVtvlAssignment[] = [];
  let count = 0;

  for (const item of raw) {
    const isOld = item.unitCode.trim().toUpperCase() === cOld;
    const nextVtvl = isOld ? replaceUnitCodePrefix(item.maVtvl, cOld, cNew) : item.maVtvl;
    const nextItem: UserVtvlAssignment = isOld
      ? {
          ...item,
          id: `uva-${cNew}-${normalizeCode(nextVtvl)}-${Buffer.from(item.userEmail).toString('hex').slice(0, 10)}`,
          unitCode: cNew,
          maVtvl: nextVtvl,
          updatedAt: nowIso
        }
      : item;
    if (isOld) {
      count++;
      migrated.push(nextItem);
    }
    const key = `${nextItem.userEmail.toLowerCase()}::${nextItem.unitCode.toUpperCase()}::${normalizeCode(nextItem.maVtvl)}`;
    dedupe.set(key, nextItem);
  }
  return { merged: Array.from(dedupe.values()), migrated, count };
}

export function stageRelationshipsMigration(
  relState: WorkRelationshipStoreState,
  cOld: string,
  cNew: string,
  newNameVi?: string
): { toPersist: WorkRelationshipItem[]; oldIdsToDelete: string[]; count: number } {
  const nextRelationships: Record<string, WorkRelationshipItem> = {};
  const nextManual = { ...relState.manualApprovals };
  const toPersist: WorkRelationshipItem[] = [];
  const oldIdsToDelete: string[] = [];
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const [oldId, rel] of Object.entries(relState.relationships)) {
    const hostHit = rel.hostUnitCode.trim().toUpperCase() === cOld;
    const targetHit = rel.targetUnitCode.trim().toUpperCase() === cOld;
    if (!hostHit && !targetHit) {
      nextRelationships[oldId] = rel;
      continue;
    }

    const updated: WorkRelationshipItem = {
      ...rel,
      hostUnitCode: hostHit ? cNew : rel.hostUnitCode,
      hostUnitName: hostHit && newNameVi ? newNameVi : rel.hostUnitName,
      hostVtvlCode: hostHit ? replaceUnitCodePrefix(rel.hostVtvlCode, cOld, cNew) : rel.hostVtvlCode,
      sourceTaskCode: hostHit ? replaceUnitCodePrefix(rel.sourceTaskCode, cOld, cNew) : rel.sourceTaskCode,
      sourceMissionCode: hostHit ? replaceUnitCodePrefix(rel.sourceMissionCode, cOld, cNew) : rel.sourceMissionCode,
      targetUnitCode: targetHit ? cNew : rel.targetUnitCode,
      targetUnitName: targetHit && newNameVi ? newNameVi : rel.targetUnitName,
      targetVtvlCode: targetHit ? replaceUnitCodePrefix(rel.targetVtvlCode, cOld, cNew) : rel.targetVtvlCode,
      targetDeclaredTicketCode: targetHit && rel.targetDeclaredTicketCode
        ? replaceUnitCodePrefix(rel.targetDeclaredTicketCode, cOld, cNew)
        : rel.targetDeclaredTicketCode,
      updatedAt: nowIso
    };
    const newId = makeWorkRelationshipId(updated.sourceSurveyId, updated.targetUnitCode, updated.targetVtvlCode);
    updated.id = newId;

    if (newId !== oldId) {
      oldIdsToDelete.push(oldId);
      if (nextManual[oldId]) {
        nextManual[newId] = nextManual[oldId];
        delete nextManual[oldId];
      }
    }
    nextRelationships[newId] = updated;
    toPersist.push(updated);
    count++;
  }

  relState.relationships = nextRelationships;
  relState.manualApprovals = nextManual;
  return { toPersist, oldIdsToDelete, count };
}

export function stageCoordinationAndVersions(
  coordState: CoordinationDiskState,
  versionsMap: Record<string, WorkSurveyVersion[]>,
  cOld: string,
  cNew: string,
  newNameVi?: string
): { coordRowsCount: number; versionsToPersist: WorkSurveyVersion[] } {
  let coordRowsCount = 0;
  for (const extra of Object.values(coordState.draftExtrasBySurvey)) {
    const cvRes = updateCoordVtvlsList(extra.coordinatedVtvls, cOld, cNew, newNameVi);
    if (cvRes.changed) extra.coordinatedVtvls = cvRes.updated;
  }
  for (const [sid, rows] of Object.entries(coordState.submittedRowsBySurvey)) {
    coordState.submittedRowsBySurvey[sid] = rows.map((r) => {
      const hHit = r.hostUnitCode.trim().toUpperCase() === cOld;
      const tHit = r.targetUnitCode.trim().toUpperCase() === cOld;
      if (!hHit && !tHit) return r;
      coordRowsCount++;
      const nextTargetUnit = tHit ? cNew : r.targetUnitCode;
      const nextTargetVtvl = tHit ? replaceUnitCodePrefix(r.targetVtvlCode, cOld, cNew) : r.targetVtvlCode;
      return {
        ...r,
        id: `wscv-${r.surveyId}-v${r.versionNo}-${nextTargetUnit}-${normalizeCode(nextTargetVtvl)}`,
        hostUnitCode: hHit ? cNew : r.hostUnitCode,
        targetUnitCode: nextTargetUnit,
        targetVtvlCode: nextTargetVtvl
      };
    });
  }
  for (const [sid, list] of Object.entries(coordState.replacedCodesBySurvey)) {
    coordState.replacedCodesBySurvey[sid] = list.map((rec) =>
      rec.unitCode.trim().toUpperCase() === cOld
        ? {
            ...rec, unitCode: cNew,
            oldMissionCode: replaceUnitCodePrefix(rec.oldMissionCode, cOld, cNew),
            newMissionCode: replaceUnitCodePrefix(rec.newMissionCode, cOld, cNew),
            oldWorkCode: replaceUnitCodePrefix(rec.oldWorkCode, cOld, cNew),
            newWorkCode: replaceUnitCodePrefix(rec.newWorkCode, cOld, cNew)
          }
        : rec
    );
  }

  const versionsToPersist: WorkSurveyVersion[] = [];
  for (const list of Object.values(versionsMap)) {
    for (const ver of list) {
      const s = ver.snapshot;
      if (!s) continue;
      const ownerHit = (s.unitCode || '').trim().toUpperCase() === cOld;
      const cvRes = updateCoordVtvlsList(s.coordinatedVtvls, cOld, cNew, newNameVi);
      const phoiHopNext = s.maVtvlPhoiHop ? replaceUnitCodeList(s.maVtvlPhoiHop, cOld, cNew) : s.maVtvlPhoiHop;
      const phoiHopHit = phoiHopNext !== s.maVtvlPhoiHop;
      if (!ownerHit && !cvRes.changed && !phoiHopHit) continue;
      if (ownerHit) {
        s.unitCode = cNew;
        if (newNameVi) s.unitNameSnapshot = newNameVi;
        s.maNhiemVu = replaceUnitCodePrefix(s.maNhiemVu, cOld, cNew);
        s.maCongViec = replaceUnitCodePrefix(s.maCongViec, cOld, cNew);
        s.maVtvl = replaceUnitCodePrefix(s.maVtvl, cOld, cNew);
      }
      if (phoiHopHit) s.maVtvlPhoiHop = phoiHopNext;
      if (cvRes.changed) s.coordinatedVtvls = cvRes.updated;
      versionsToPersist.push(ver);
    }
  }
  return { coordRowsCount, versionsToPersist };
}
