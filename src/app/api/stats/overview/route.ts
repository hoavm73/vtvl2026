import { NextResponse } from 'next/server';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { buildRecommendedC1Rows } from '@/configs/hcmute-pl1-builder';
import { getTicketCounts, loadTickets, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { getAllActiveServerWorkbooks, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { getAuditLogs } from '@/services/storage/server-audit-store';
import { deriveReviewMetaFromWorkbook } from '@/services/workbooks/workbook-history-service';
import { cacheGetOrSet } from '@/services/storage/runtime-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await cacheGetOrSet('api:stats:overview', ['tickets', 'workbooks', 'overview-stats'], 4000, async () => {
    try {
      await Promise.all([
        syncTicketsFromSupabase().catch(() => {}),
        syncServerWorkbooksFromSupabase(false).catch(() => {})
      ]);
    } catch {
      // ignore
    }

    const ticketCounts = getTicketCounts();
    const appliedVtvlSet = new Set<string>();
    for (const t of loadTickets().values()) {
      if (t.isTestData || t.isArchived) continue;
      const code = String(t.maVtvl || '').trim().toUpperCase();
      if (code) appliedVtvlSet.add(`${t.unitCode.toUpperCase()}__${code}`);
    }
    const appliedPositions = appliedVtvlSet.size;
    const totalUnits = HCMUTE_UNITS.length;

    const workbooks = getAllActiveServerWorkbooks();
    const wbByUnit = new Map(workbooks.map((w) => [w.unitId.toUpperCase(), w]));

    let totalC1Positions = 0;
    let chuaGui = 0;
    let daGuiTcns = 0;
    let dangThamDinh = 0;
    let canBoSung = 0;
    let datVaKhoa = 0;
    const allLogs = getAuditLogs({ limit: 500 });
    for (const u of HCMUTE_UNITS) {
      const codeUpper = u.code.toUpperCase();
      const wb = wbByUnit.get(codeUpper);
      const c1Rows = Array.isArray(wb?.data?.C1) && wb.data.C1.length > 0
        ? wb.data.C1
        : buildRecommendedC1Rows(u.code, u.group);
      const validRows = c1Rows.filter((r) => String(r?.maVtvl || r?.tenVtvl || '').trim().length > 0);
      totalC1Positions += validRows.length;

      const unitLogs = allLogs.filter((l) => (l.unitCode || '').toUpperCase() === codeUpper);
      const meta = deriveReviewMetaFromWorkbook(wb, unitLogs);
      if (meta.status === 'dat_yeu_cau' || meta.status === 'da_khoa') datVaKhoa++;
      else if (meta.status === 'can_bo_sung') canBoSung++;
      else if (meta.status === 'dang_tham_dinh') dangThamDinh++;
      else if (meta.status === 'cho_tham_dinh' || meta.status === 'da_gui_lai') daGuiTcns++;
      else chuaGui++;
    }

    const reviewProgress = {
      totalUnits,
      chuaGui,
      daGuiTcns,
      dangThamDinh,
      canBoSung,
      datVaKhoa,
      approvedPercent: totalUnits > 0 ? Math.round((datVaKhoa / totalUnits) * 100) : 0
    };

    const unitGroups = UNIT_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      count: HCMUTE_UNITS.filter((u) => u.group === g.id).length,
      shortDesc: g.shortDesc
    }));

    return {
      totalUnits,
      totalPositions: totalC1Positions,
      frameworkPositions: ND232_2026_VTVL_CATALOG.length,
      appliedPositions,
      approvedPositions: ticketCounts.approved,
      pendingPositions: ticketCounts.pending,
      draftPositions: ticketCounts.draft,
      totalTickets: ticketCounts.total,
      reviewProgress,
      unitGroups,
      updatedAt: new Date().toISOString()
    };
  });

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
