import { HcmuteUnit } from '@/types/vtvl';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { normalizeCode } from '@/services/tickets/vtvl-coordination-helpers';
import { withCrossProcessLock } from './server-file-lock';
import { invalidateCacheTags } from './runtime-cache';
import { getDbTestHook, isDatabaseConfigured } from './prisma';
import { isIsolatedLocalMode } from './server-ticket-db';
import { loadTickets, persistTickets, syncTicketsFromSupabase } from './server-ticket-store';
import {
  getRawAssignmentsSnapshot,
  commitAssignmentsSnapshot,
  syncVtvlAssignmentsFromSupabase
} from './server-vtvl-assignment-store';
import {
  getWorkRelationshipStateSnapshot,
  commitWorkRelationshipState,
  syncWorkRelationshipsFromSupabase
} from './server-work-relationship-store';
import {
  loadCoordinationState,
  persistCoordinationState,
  syncVersionsCacheFromSupabase
} from './server-coordination-store';
import {
  getAllSurveyVersionsSnapshot,
  commitAllSurveyVersionsSnapshot
} from './server-ticket-version-store';
import { appendAuditLog, persistAuditLogToSupabase } from './server-audit-store';
import { executeUnitMigrationDbTransaction } from './server-unit-migration-db';
import {
  cloneJson,
  stageAssignmentsMigration,
  stageCoordinationAndVersions,
  stageRelationshipsMigration,
  stageTicketsMigration
} from './server-unit-migration-stage';

export interface MigrateUnitOptions {
  newNameVi?: string;
  targetUnitMeta?: Partial<HcmuteUnit>;
  actorEmail?: string;
  actorRole?: string;
  simulateTxFailure?: boolean;
  checkTargetExists?: boolean;
}

export interface UnitTicketMigrationStats {
  oldCode: string;
  newCode: string;
  migratedTickets: number;
  migratedCoordinatedTickets: number;
  migratedAssignments: number;
  migratedRelationships: number;
  migratedCoordinatedRows: number;
  migratedVersions: number;
}

export async function migrateTicketsForUnitDetailed(
  oldCode: string,
  newCode: string,
  options?: MigrateUnitOptions
): Promise<UnitTicketMigrationStats> {
  const cOld = oldCode.trim().toUpperCase();
  const cNew = newCode.trim().toUpperCase();
  if (!cOld || !cNew) {
    throw Object.assign(new Error('Mã đơn vị cũ và mã đơn vị mới không được để trống.'), {
      code: 'INVALID_UNIT_CODE',
      status: 400
    });
  }
  if (cOld === cNew) {
    return {
      oldCode: cOld, newCode: cNew, migratedTickets: 0, migratedCoordinatedTickets: 0,
      migratedAssignments: 0, migratedRelationships: 0, migratedCoordinatedRows: 0, migratedVersions: 0
    };
  }

  return withCrossProcessLock('unit_code_migration_lock', async () => {
    if (!isIsolatedLocalMode() && isDatabaseConfigured() && !getDbTestHook()) {
      await Promise.all([
        syncTicketsFromSupabase(undefined, true).catch(() => {}),
        syncVtvlAssignmentsFromSupabase().catch(() => {}),
        syncWorkRelationshipsFromSupabase().catch(() => {}),
        syncVersionsCacheFromSupabase(true).catch(() => {})
      ]);
    }

    const stagedTickets = cloneJson(Array.from(loadTickets().values()));
    if (options?.checkTargetExists && stagedTickets.some((t) => !t.isArchived && t.unitCode.trim().toUpperCase() === cNew)) {
      throw Object.assign(new Error(`Mã đơn vị [${cNew}] đã có phiếu công việc đang hoạt động.`), {
        code: 'UNIT_CODE_ALREADY_EXISTS',
        status: 409
      });
    }
    const existingNewCodes = new Set(
      stagedTickets.filter((t) => !t.isArchived && t.unitCode.trim().toUpperCase() === cNew).map((t) => normalizeCode(t.maCongViec))
    );
    for (const t of stagedTickets) {
      if (!t.isArchived && t.unitCode.trim().toUpperCase() === cOld) {
        const nextTask = normalizeCode(replaceUnitCodePrefix(t.maCongViec, cOld, cNew));
        if (nextTask && existingNewCodes.has(nextTask)) {
          throw Object.assign(new Error(`Xung đột mã công việc [${nextTask}] đã tồn tại ở đơn vị [${cNew}].`), {
            code: 'UNIT_CODE_ALREADY_EXISTS',
            status: 409
          });
        }
      }
    }

    const stagedAssignments = cloneJson(getRawAssignmentsSnapshot());
    const stagedRelState = cloneJson(getWorkRelationshipStateSnapshot());
    const stagedCoordState = cloneJson(loadCoordinationState());
    const stagedVersionsMap = cloneJson(getAllSurveyVersionsSnapshot());

    const tStage = stageTicketsMigration(stagedTickets, cOld, cNew, options?.newNameVi);
    const aStage = stageAssignmentsMigration(stagedAssignments, cOld, cNew);
    const rStage = stageRelationshipsMigration(stagedRelState, cOld, cNew, options?.newNameVi);
    const cStage = stageCoordinationAndVersions(stagedCoordState, stagedVersionsMap, cOld, cNew, options?.newNameVi);

    // 1. Thực thi Database Transaction trước — nếu thất bại tuyệt đối không chạm file/cache
    await executeUnitMigrationDbTransaction({
      oldCode: cOld, newCode: cNew, newNameVi: options?.newNameVi, targetUnitMeta: options?.targetUnitMeta,
      ticketsToPersist: tStage.toPersist, assignmentsToPersist: aStage.migrated,
      relationshipsToPersist: rStage.toPersist, oldRelationshipIdsToDelete: rStage.oldIdsToDelete,
      versionsToPersist: cStage.versionsToPersist, simulateTxFailure: options?.simulateTxFailure
    });

    // 2. Chỉ ghi file cục bộ & cập nhật RAM store sau khi Transaction DB thành công
    const liveTickets = loadTickets();
    liveTickets.clear();
    for (const t of stagedTickets) liveTickets.set(t.id, t);
    persistTickets();
    commitAssignmentsSnapshot(aStage.merged);
    commitWorkRelationshipState(stagedRelState);
    persistCoordinationState(stagedCoordState);
    commitAllSurveyVersionsSnapshot(stagedVersionsMap);

    invalidateCacheTags(['units', 'accounts', 'workbooks', 'tickets', 'overview-stats', 'unit-monitor', 'coordination']);

    const stats: UnitTicketMigrationStats = {
      oldCode: cOld, newCode: cNew, migratedTickets: tStage.migratedTickets,
      migratedCoordinatedTickets: tStage.migratedCoordinatedTickets, migratedAssignments: aStage.count,
      migratedRelationships: rStage.count, migratedCoordinatedRows: cStage.coordRowsCount,
      migratedVersions: cStage.versionsToPersist.length
    };

    const audit = appendAuditLog({
      unitCode: cNew, unitName: options?.newNameVi || cNew,
      action: 'ĐỒNG_BỘ_ĐỔI_MÃ_ĐƠN_VỊ', targetId: `${cOld}->${cNew}`, targetEntity: 'dm_don_vi',
      details: `Đổi mã đơn vị ${cOld} -> ${cNew}: ${stats.migratedTickets} phiếu, ${stats.migratedCoordinatedTickets} phiếu phối hợp, ${stats.migratedAssignments} phân công VTVL, ${stats.migratedRelationships} quan hệ công việc, ${stats.migratedVersions} phiên bản.`,
      actorEmail: options?.actorEmail || 'system', actorRole: options?.actorRole || 'admin',
      oldValues: { unitCode: cOld }, newValues: { ...stats }
    });
    await persistAuditLogToSupabase(audit);

    return stats;
  });
}

export async function migrateTicketsForUnit(
  oldCode: string,
  newCode: string,
  options?: MigrateUnitOptions
): Promise<number> {
  const stats = await migrateTicketsForUnitDetailed(oldCode, newCode, options);
  return stats.migratedTickets;
}
