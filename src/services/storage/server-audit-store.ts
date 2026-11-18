import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, prisma } from './prisma';
import { writeJsonFileAtomic } from './atomic-json-file';

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
  writeJsonFileAtomic(AUDIT_FILE, memoryAuditLogs, true);
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
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return;
  try {
    await prisma.audit_logs.create({
      data: {
        workbook_id: log.workbookId || `wb_${log.unitCode}_2026`,
        actor_email: log.actorEmail || 'system',
        actor_role: log.actorRole || 'staff',
        unit_id: log.unitId || log.unitCode,
        action: log.action,
        target_id: log.targetId || null,
        target_entity: log.targetEntity || null,
        old_values: log.oldValues ? (log.oldValues as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        new_values: log.newValues ? (log.newValues as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        metadata: { details: log.details, unitName: log.unitName } as unknown as Prisma.InputJsonValue
      }
    });
  } catch (e) {
    const errText = e instanceof Error ? e.message : String(e);
    const isSchemaOutdated = errText.includes('42703') || errText.includes('42P01');
    if (process.env.NODE_ENV === 'production' || process.env.STRICT_DB_SCHEMA === 'true') {
      const err = new Error(
        isSchemaOutdated
          ? `[DATABASE_SCHEMA_OUTDATED] Bảng audit_logs thiếu trường kiểm toán bắt buộc: ${errText}`
          : `[DB_AUDIT_WRITE_FAILED] Lỗi ghi audit_logs: ${errText}`
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
