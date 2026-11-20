import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

/** Liveness probe: xác nhận tiến trình Node.js và vòng lặp sự kiện còn phản hồi, không chạm DB. */
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE_HEADERS });
}
