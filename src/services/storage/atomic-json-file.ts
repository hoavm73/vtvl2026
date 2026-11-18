import fs from 'fs';
import path from 'path';
import { isDatabaseConfigured } from './prisma';

/**
 * Chỉ lưu tệp JSON cục bộ khi:
 * 1) Chạy ở chế độ cô lập kiểm thử `VTVL_ISOLATED_LOCAL_STORE=true`, HOẶC
 * 2) Chưa cấu hình kết nối PostgreSQL (`DATABASE_URL` trống).
 * Khi PostgreSQL đã cấu hình trên Production/Staging, tuyệt đối KHÔNG gọi `JSON.stringify` toàn bộ store hay `fs.writeFileSync`.
 */
export function shouldPersistLocalJson(): boolean {
  if (process.env.VTVL_BENCHMARK_MEMORY_ONLY === 'true') return false;
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return true;
  if (isDatabaseConfigured()) return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Ghi tệp JSON nguyên tử (temp file + renameSync) ở chế độ local/test.
 * Trên Production có PostgreSQL sẽ thoát ngay O(1), không chạm ổ đĩa và không serialize toàn bộ store.
 */
export function writeJsonFileAtomic(filePath: string, payload: unknown, pretty = false): boolean {
  if (!shouldPersistLocalJson()) return false;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpFile = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    const serialized = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
    fs.writeFileSync(tmpFile, serialized, 'utf8');
    fs.renameSync(tmpFile, filePath);
    return true;
  } catch {
    return false;
  }
}
