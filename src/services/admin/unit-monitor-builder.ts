import { HCMUTE_UNITS, UNIT_GROUPS, findHcmuteUnit } from '@/configs/hcmute-units';
import { getTicketsByUnit } from '@/services/storage/server-ticket-store';
import { getAllActiveServerWorkbooks } from '@/services/storage/server-workbook-store';
import { getAllUserAccounts } from '@/services/storage/server-account-store';
import { getAuditLogs } from '@/services/storage/server-audit-store';
import { toCanonicalStatus, StaffWorkTicket } from '@/types/staff-ticket';
import {
  deriveReviewMetaFromWorkbook,
  REVIEW_STATUS_LABELS,
  summarizeErrorCountFromWorkbookData
} from '@/services/workbooks/workbook-history-service';

export interface UnitMonitorHistoryItem {
  id: string;
  unitCode: string;
  unitNameVi: string;
  category: 'ticket' | 'workbook' | 'audit';
  actionLabel: string;
  title: string;
  details: string;
  actorEmail: string;
  statusBadge?: string;
  timestampIso: string;
}

const CORE_SHEETS = ['A1', 'A2', 'B1', 'B2_CT', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2'] as const;

export function buildUnitMonitorPayload(filterUnit: string, includeTest: boolean) {
  const workbooks = getAllActiveServerWorkbooks();
  const wbByUnit = new Map(workbooks.map((w) => [w.unitId.toUpperCase(), w]));
  const allAccounts = getAllUserAccounts();
  const allAuditLogs = getAuditLogs({ unitCode: filterUnit || undefined, limit: 300 });
  const auditsByUnit = new Map<string, typeof allAuditLogs>();
  for (const log of allAuditLogs) {
    const uc = (log.unitCode || '').toUpperCase();
    const list = auditsByUnit.get(uc) || [];
    list.push(log);
    auditsByUnit.set(uc, list);
  }

  const allTicketsRaw: StaffWorkTicket[] = [];
  for (const u of HCMUTE_UNITS) {
    allTicketsRaw.push(...getTicketsByUnit(u.code, true));
  }

  const unitSummaries = HCMUTE_UNITS.map((unit) => {
    const uc = unit.code.toUpperCase();
    const rawUnitTickets = allTicketsRaw.filter((t) => t.unitCode.toUpperCase() === uc);
    const activeTickets = includeTest
      ? rawUnitTickets
      : rawUnitTickets.filter((t) => !t.isTestData && !t.isArchived);
    const testTicketCount = rawUnitTickets.filter((t) => t.isTestData || t.isArchived).length;

    let draftCount = 0;
    let submittedCount = 0;
    let resubmittedCount = 0;
    let changesRequestedCount = 0;
    let approvedCount = 0;
    let mergedCount = 0;

    for (const t of activeTickets) {
      const c = toCanonicalStatus(t.status);
      if (c === 'draft') draftCount++;
      else if (c === 'submitted') submittedCount++;
      else if (c === 'resubmitted') {
        submittedCount++;
        resubmittedCount++;
      } else if (c === 'changes_requested') changesRequestedCount++;
      else if (c === 'approved') approvedCount++;
      if (t.isMergedToB1B2) mergedCount++;
    }

    const wb = wbByUnit.get(uc);
    let populatedSheetsCount = 0;
    let totalRows = 0;
    const sheetCounts: Record<string, number> = {};

    if (wb?.data) {
      for (const key of CORE_SHEETS) {
        const rows = (wb.data as Record<string, unknown[]>)[key];
        const count = Array.isArray(rows) ? rows.length : 0;
        sheetCounts[key] = count;
        if (count > 0) {
          populatedSheetsCount++;
          totalRows += count;
        }
      }
    }

    const unitAccs = allAccounts.filter((a) => a.unitCode.toUpperCase() === uc && a.status === 'active');
    const leaderCount = unitAccs.filter((a) => a.role === 'unit_leader').length;
    const staffCount = unitAccs.filter((a) => a.role === 'staff').length;

    const latestTicketTime = activeTickets[0]?.updatedAt || '';
    const wbTime = wb?.updatedAt || '';
    const lastUpdatedAt = latestTicketTime > wbTime ? latestTicketTime : wbTime;

    let progressPercent = 0;
    let stageLabel = 'Chưa kê khai';
    if (mergedCount > 0 && populatedSheetsCount >= 6) {
      progressPercent = 100;
      stageLabel = 'Đã gộp B1/B2 & hoàn thiện biểu';
    } else if (approvedCount > 0) {
      progressPercent = 80;
      stageLabel = 'Đã duyệt phiếu';
    } else if (submittedCount > 0 || changesRequestedCount > 0) {
      progressPercent = 60;
      stageLabel = submittedCount > 0 ? 'Đang chờ duyệt phiếu' : 'Đang chờ bổ sung phiếu';
    } else if (draftCount > 0) {
      progressPercent = 35;
      stageLabel = 'Đang lưu nháp phiếu';
    } else if (populatedSheetsCount > 0) {
      progressPercent = 20;
      stageLabel = 'Đã khởi tạo biểu mẫu';
    }

    const groupInfo = UNIT_GROUPS.find((g) => g.id === unit.group);
    const reviewMeta = deriveReviewMetaFromWorkbook(wb, auditsByUnit.get(uc) || []);
    const errorCount = wb ? summarizeErrorCountFromWorkbookData(wb.data) : 0;

    return {
      unitCode: unit.code,
      unitNameVi: unit.nameVi,
      group: unit.group,
      groupLabel: groupInfo?.label || unit.group,
      totalTickets: activeTickets.length,
      draftCount,
      submittedCount,
      resubmittedCount,
      changesRequestedCount,
      approvedCount,
      mergedCount,
      testTicketCount,
      hasWorkbook: Boolean(wb),
      workbookRevision: wb?.currentRevision || 0,
      populatedSheetsCount,
      totalCoreSheets: CORE_SHEETS.length,
      totalRows,
      sheetCounts,
      accountCount: unitAccs.length,
      leaderCount,
      staffCount,
      progressPercent,
      stageLabel,
      lastUpdatedAt: lastUpdatedAt || null,
      reviewStatus: reviewMeta.status,
      reviewStatusLabel: REVIEW_STATUS_LABELS[reviewMeta.status],
      submittedAt: reviewMeta.submittedAt,
      submittedBy: reviewMeta.submittedBy,
      submittedRevision: reviewMeta.submittedRevision,
      reviewerEmail: reviewMeta.reviewerEmail,
      reviewedAt: reviewMeta.reviewedAt,
      reviewNote: reviewMeta.reviewNote,
      errorCount
    };
  });

  const filteredTickets = allTicketsRaw
    .filter((t) => {
      if (!includeTest && (t.isTestData || t.isArchived)) return false;
      if (filterUnit && t.unitCode.toUpperCase() !== filterUnit) return false;
      return true;
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .map((t) => {
      const u = findHcmuteUnit(t.unitCode);
      const totalHours =
        Math.round((((Number(t.soSpNam) || 0) * (Number(t.phutThucTe) || 0)) / 60 + (Number(t.gioBoSung) || 0)) * 10) / 10;
      return {
        id: t.id,
        unitCode: t.unitCode,
        unitNameVi: u.nameVi,
        maNhiemVu: t.maNhiemVu,
        maCongViec: t.maCongViec,
        tenCongViec: t.tenCongViec,
        maVtvl: t.maVtvl,
        ownerEmail: t.ownerEmail,
        ownerName: t.ownerName,
        status: t.status,
        canonicalStatus: toCanonicalStatus(t.status),
        currentVersionNo: t.currentVersionNo || (Array.isArray(t.versions) ? t.versions.length : 0),
        isMergedToB1B2: Boolean(t.isMergedToB1B2),
        isTestData: Boolean(t.isTestData),
        soSpNam: t.soSpNam,
        phutThucTe: t.phutThucTe,
        gioBoSung: t.gioBoSung,
        totalHours,
        revisionReason: t.revisionReason || '',
        lastChangeSummary: t.lastChangeSummary || '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });

  const historyItems: UnitMonitorHistoryItem[] = [];
  for (const t of filteredTickets) {
    historyItems.push({
      id: `tkt-latest-${t.id}`,
      unitCode: t.unitCode,
      unitNameVi: t.unitNameVi,
      category: 'ticket',
      actionLabel: t.isMergedToB1B2 ? 'Đã gộp B1/B2' : t.status,
      title: `[${t.maCongViec}] ${t.tenCongViec}`,
      details: t.revisionReason
        ? `Yêu cầu chỉnh sửa: ${t.revisionReason}`
        : t.lastChangeSummary
          ? `Giải trình: ${t.lastChangeSummary}`
          : `Sản lượng: ${t.soSpNam} SP • Tổng: ${t.totalHours} giờ/năm`,
      actorEmail: t.ownerEmail,
      statusBadge: t.status,
      timestampIso: t.updatedAt || t.createdAt
    });
  }

  for (const wb of workbooks) {
    if (filterUnit && wb.unitId.toUpperCase() !== filterUnit) continue;
    const revs = Array.isArray(wb.revisions) ? wb.revisions.slice(-5) : [];
    for (const r of revs) {
      historyItems.push({
        id: `wb-${wb.unitId}-r${r.revision}`,
        unitCode: wb.unitId,
        unitNameVi: wb.unitNameVi,
        category: 'workbook',
        actionLabel: `Bảng tính v${r.revision}`,
        title: `Cập nhật bộ 10 biểu đơn vị [${wb.unitId}]`,
        details: r.changeSummary || 'Lưu cập nhật bảng tính đơn vị',
        actorEmail: r.actorEmail || 'system',
        statusBadge: `Rev #${r.revision}`,
        timestampIso: r.createdAt || wb.updatedAt
      });
    }
  }

  for (const log of getAuditLogs({ unitCode: filterUnit || undefined, limit: 80 })) {
    const u = findHcmuteUnit(log.unitCode);
    historyItems.push({
      id: log.id,
      unitCode: log.unitCode,
      unitNameVi: log.unitName || u.nameVi,
      category: 'audit',
      actionLabel: log.action,
      title: log.details,
      details: `Đối tượng: ${log.targetEntity || 'hệ thống'}${log.targetId ? ` (${log.targetId})` : ''}`,
      actorEmail: log.actorEmail || 'system',
      statusBadge: log.action,
      timestampIso: log.createdAt
    });
  }

  historyItems.sort((a, b) => (b.timestampIso || '').localeCompare(a.timestampIso || ''));

  const targetSummaries = filterUnit
    ? unitSummaries.filter((u) => u.unitCode.toUpperCase() === filterUnit)
    : unitSummaries;

  const totals = targetSummaries.reduce(
    (acc, u) => {
      acc.totalUnits += 1;
      acc.unitsWithTickets += u.totalTickets > 0 ? 1 : 0;
      acc.unitsWithApproved += u.approvedCount > 0 ? 1 : 0;
      acc.totalTickets += u.totalTickets;
      acc.draftCount += u.draftCount;
      acc.submittedCount += u.submittedCount;
      acc.resubmittedCount += u.resubmittedCount;
      acc.changesRequestedCount += u.changesRequestedCount;
      acc.approvedCount += u.approvedCount;
      acc.mergedCount += u.mergedCount;
      acc.testTicketCount += u.testTicketCount;
      acc.totalAccounts += u.accountCount;
      return acc;
    },
    {
      totalUnits: 0, unitsWithTickets: 0, unitsWithApproved: 0, totalTickets: 0,
      draftCount: 0, submittedCount: 0, resubmittedCount: 0, changesRequestedCount: 0,
      approvedCount: 0, mergedCount: 0, testTicketCount: 0, totalAccounts: 0
    }
  );

  return {
    filterUnit: filterUnit || 'ALL',
    totals,
    unitSummaries,
    tickets: filteredTickets.slice(0, 100),
    history: historyItems.slice(0, 120)
  };
}
