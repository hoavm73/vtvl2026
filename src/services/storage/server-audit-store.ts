import fs from 'fs';
import path from 'path';

export interface ServerAuditLog {
  id: string;
  workbookId?: string;
  unitCode: string;
  unitId?: string;
  unitName: string;
  action: string;
  details: string;
  actorEmail?: string;
  actorRole?: string;
  targetId?: string;
  targetEntity?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  timestamp: number;
}

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-logs.json');
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const SECRET_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'client_secret'
]);

export function sanitizeAuditPayload(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.has(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      cleaned[k] = sanitizeAuditPayload(v as Record<string, unknown>);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

const memoryAuditLogs: ServerAuditLog[] = [];
let isLoaded = false;

function ensureLoaded() {
  if (isLoaded) return;
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryAuditLogs.push(...parsed);
      }
    }
  } catch { /* ignore */ }
  isLoaded = true;
}

function persistLogs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(memoryAuditLogs, null, 2), 'utf8');
  } catch { /* ignore in read-only environment */ }
}

export function appendAuditLog(entry: Omit<ServerAuditLog, 'id' | 'createdAt' | 'timestamp'>): ServerAuditLog {
  ensureLoaded();
  const safeOld = sanitizeAuditPayload(entry.oldValues);
  const safeNew = sanitizeAuditPayload(entry.newValues);
  const newLog: ServerAuditLog = {
    ...entry,
    unitId: entry.unitId || entry.unitCode,
    oldValues: safeOld,
    newValues: safeNew,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    timestamp: Date.now()
  };
  memoryAuditLogs.unshift(newLog);
  if (memoryAuditLogs.length > 5000) {
    memoryAuditLogs.length = 5000;
  }
  persistLogs();
  return newLog;
}

export async function persistAuditLogToSupabase(log: ServerAuditLog): Promise<void> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return;
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      workbook_id: log.workbookId || `wb_${log.unitCode}_2026`,
      actor_email: log.actorEmail || 'system',
      actor_role: log.actorRole || 'staff',
      unit_id: log.unitId || log.unitCode,
      action: log.action,
      target_id: log.targetId || null,
      target_entity: log.targetEntity || null,
      old_values: log.oldValues || null,
      new_values: log.newValues || null,
      metadata: { details: log.details, unitName: log.unitName }
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const isSchemaOutdated =
      res.status === 400 || errText.includes('PGRST204') || errText.includes('42703');
    if (process.env.NODE_ENV === 'production' || process.env.STRICT_DB_SCHEMA === 'true') {
      const err = new Error(
        isSchemaOutdated
          ? `[DATABASE_SCHEMA_OUTDATED] Bảng audit_logs thiếu trường kiểm toán bắt buộc: ${errText}`
          : `[DB_AUDIT_WRITE_FAILED] Lỗi ghi audit_logs (${res.status}): ${errText}`
      );
      (err as unknown as { code: string; status: number }).code = isSchemaOutdated
        ? 'DATABASE_SCHEMA_OUTDATED'
        : 'DB_AUDIT_WRITE_FAILED';
      (err as unknown as { status: number }).status = 500;
      throw err;
    }
  }
}

export function getAuditLogs(filter?: { unitCode?: string; workbookId?: string; limit?: number }): ServerAuditLog[] {
  ensureLoaded();
  let list = [...memoryAuditLogs];
  if (filter?.unitCode) {
    list = list.filter((l) => l.unitCode === filter.unitCode);
  }
  if (filter?.workbookId) {
    list = list.filter((l) => l.workbookId === filter.workbookId);
  }
  const max = filter?.limit || 100;
  return list.slice(0, max);
}
