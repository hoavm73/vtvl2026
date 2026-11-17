import { NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { isDatabaseConfigured, pgQuery, prisma } from '@/services/storage/prisma';

export async function GET(req: Request) {
  const caller = await getCallerSession(req);
  if (!caller.isAdmin) {
    return NextResponse.json(
      { error: 'Chỉ Quản trị viên mới được xem lịch sử phiên bản migration CSDL.' },
      { status: 403 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      prismaMigrations: [],
      sqlMigrations: [],
      message: 'Chưa cấu hình DATABASE_URL.'
    });
  }

  try {
    const [prismaRes, sqlMigrations] = await Promise.all([
      pgQuery(
        `SELECT id, migration_name, checksum, started_at, finished_at, applied_steps_count, logs
         FROM public."_prisma_migrations"
         ORDER BY finished_at DESC NULLS LAST, started_at DESC`
      ),
      prisma.schema_migrations.findMany({
        orderBy: { applied_at: 'desc' }
      })
    ]);

    return NextResponse.json({
      ok: true,
      prismaMigrations: prismaRes.rows,
      sqlMigrations
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi đọc bảng phiên bản migration.' },
      { status: 500 }
    );
  }
}
