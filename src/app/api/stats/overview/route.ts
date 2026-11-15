import { NextResponse } from 'next/server';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { getTicketCounts, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';

export async function GET() {
  try {
    await syncTicketsFromSupabase().catch(() => {});
  } catch {
    // ignore
  }

  const ticketCounts = getTicketCounts();
  const totalUnits = HCMUTE_UNITS.length;
  const totalPositions = ND232_2026_VTVL_CATALOG.length;

  const unitGroups = UNIT_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    count: HCMUTE_UNITS.filter((u) => u.group === g.id).length,
    shortDesc: g.shortDesc
  }));

  return NextResponse.json({
    totalUnits,
    totalPositions,
    approvedPositions: ticketCounts.approved,
    pendingPositions: ticketCounts.pending,
    draftPositions: ticketCounts.draft,
    totalTickets: ticketCounts.total,
    unitGroups
  });
}
