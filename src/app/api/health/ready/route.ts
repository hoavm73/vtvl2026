import { NextResponse } from 'next/server';
import { checkPostgresReadiness } from '@/services/storage/prisma';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

/** Readiness probe: kiểm tra nhanh PostgreSQL với timeout ngắn và chỉ trả trạng thái tối giản. */
export async function GET() {
  const ready = await checkPostgresReadiness(1500);
  if (!ready) {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ status: 'ready' }, { status: 200, headers: NO_STORE_HEADERS });
}

export async function HEAD() {
  const ready = await checkPostgresReadiness(1500);
  return new NextResponse(null, { status: ready ? 200 : 503, headers: NO_STORE_HEADERS });
}
