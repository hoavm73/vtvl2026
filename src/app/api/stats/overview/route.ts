import { NextResponse } from 'next/server';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { buildRecommendedC1Rows } from '@/configs/hcmute-pl1-builder';
import { getTicketCounts, loadTickets, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { getAllActiveServerWorkbooks, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
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
    for (const u of HCMUTE_UNITS) {
      const wb = wbByUnit.get(u.code.toUpperCase());
      const c1Rows = Array.isArray(wb?.data?.C1) && wb.data.C1.length > 0
        ? wb.data.C1
        : buildRecommendedC1Rows(u.code, u.group);
      const validRows = c1Rows.filter((r) => String(r?.maVtvl || r?.tenVtvl || '').trim().length > 0);
      totalC1Positions += validRows.length;
    }

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
      unitGroups,
      updatedAt: new Date().toISOString()
    };
  });

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
