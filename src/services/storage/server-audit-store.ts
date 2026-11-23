import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, prisma, toIsoString } from './prisma';
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

export const AUTH_AUDIT_ACTIONS = new Set([
  'ĐĂNG_NHẬP',
  'ĐĂNG_NHẬP_GOOGLE',
  'ĐĂNG_NHẬP_THẤT_BẠI',
  'XÁC_THỰC_QUẢN_TRỊ',
  'ĐĂNG_XUẤT'
]);

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
        workbook_id: log.workbookId || (log.targetEntity === 'auth_session' ? null : `wb_${log.unitCode}_2026`),
        actor_email: log.actorEmail || 'system',
        actor_role: log.actorRole || 'staff',
        unit_id: log.unitId || log.unitCode,
        action: log.action,
        target_id: log.targetId || null,
        target_entity: log.targetEntity || null,
        ip_address: log.ipAddress || null,
        user_agent: log.userAgent ? log.userAgent.slice(0, 500) : null,
        old_values: log.oldValues ? (log.oldValues as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        new_values: log.newValues ? (log.newValues as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        metadata: {
          details: log.details,
          unitName: log.unitName,
          clientLogId: log.id,
          ...(log.ipAddress ? { ipAddress: log.ipAddress } : {})
        } as unknown as Prisma.InputJsonValue
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

export async function syncAuditLogsFromSupabase(
  limit = 500,
  onlyActions?: ReadonlySet<string> | string[]
): Promise<void> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return;
  ensureLoaded();
  try {
    const actionList = onlyActions ? Array.from(onlyActions) : [];
    const rows = await prisma.audit_logs.findMany({
      ...(actionList.length > 0 ? { where: { action: { in: actionList } } } : {}),
      orderBy: { created_at: 'desc' },
      take: Math.max(50, Math.min(limit, 2000))
    });
    const knownIds = new Set(memoryAuditLogs.map((l) => l.id));
    let merged = false;
    for (const row of rows) {
      const dbId = `db_audit_${row.id.toString()}`;
      const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
      const clientLogId = typeof meta.clientLogId === 'string' ? meta.clientLogId : '';
      if (knownIds.has(dbId) || (clientLogId && knownIds.has(clientLogId))) continue;
      const unitUpper = String(row.unit_id || '').trim().toUpperCase();
      const createdAt = toIsoString(row.created_at) || new Date().toISOString();
      const ts = new Date(createdAt).getTime() || Date.now();
      const details = typeof meta.details === 'string' && meta.details ? meta.details : row.action;
      const actor = row.actor_email || 'system';
      const fuzzyDup = memoryAuditLogs.some(
        (m) => m.action === row.action && m.unitCode.toUpperCase() === unitUpper && (m.actorEmail || 'system') === actor && Math.abs((m.timestamp || 0) - ts) < 5000
      );
      if (fuzzyDup) { knownIds.add(dbId); continue; }
      memoryAuditLogs.push({
        id: clientLogId || dbId,
        workbookId: row.workbook_id || undefined,
        unitCode: unitUpper || 'TCNS',
        unitId: unitUpper || 'TCNS',
        unitName: typeof meta.unitName === 'string' && meta.unitName ? meta.unitName : (unitUpper || 'TCNS'),
        action: row.action,
        details,
        actorEmail: actor,
        actorRole: row.actor_role || undefined,
        targetId: row.target_id || undefined,
        targetEntity: row.target_entity || undefined,
        ipAddress: row.ip_address || (typeof meta.ipAddress === 'string' ? meta.ipAddress : undefined),
        userAgent: row.user_agent || undefined,
        oldValues: (row.old_values && typeof row.old_values === 'object' ? row.old_values : null) as Record<string, unknown> | null,
        newValues: (row.new_values && typeof row.new_values === 'object' ? row.new_values : null) as Record<string, unknown> | null,
        createdAt,
        timestamp: ts
      });
      knownIds.add(clientLogId || dbId);
      merged = true;
    }
    if (merged) {
      memoryAuditLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (memoryAuditLogs.length > 5000) memoryAuditLogs.length = 5000;
      persistLogs();
    }
  } catch { /* fallback cleanly to local/memory audit logs */ }
}

export function getAuditLogs(filter?: {
  unitCode?: string;
  workbookId?: string;
  actions?: ReadonlySet<string> | string[];
  limit?: number;
}): ServerAuditLog[] {
  ensureLoaded();
  let list = [...memoryAuditLogs];
  if (filter?.unitCode) {
    const targetUnit = filter.unitCode.trim().toUpperCase();
    list = list.filter((l) => (l.unitCode || '').trim().toUpperCase() === targetUnit);
  }
  if (filter?.workbookId) {
    list = list.filter((l) => l.workbookId === filter.workbookId);
  }
  if (filter?.actions) {
    const actionSet = filter.actions instanceof Set ? filter.actions : new Set(filter.actions);
    list = list.filter((l) => actionSet.has(l.action));
  }
  const max = filter?.limit || 100;
  return list.slice(0, max);
}

export async function recordAuthAuditEvent(params: {
  action: 'ĐĂNG_NHẬP' | 'ĐĂNG_NHẬP_GOOGLE' | 'ĐĂNG_NHẬP_THẤT_BẠI' | 'XÁC_THỰC_QUẢN_TRỊ' | 'ĐĂNG_XUẤT';
  email: string;
  role?: string;
  unitCode?: string;
  unitName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  authMethod?: string;
  reason?: string;
}): Promise<ServerAuditLog> {
  const cleanUnit = (params.unitCode || 'SYSTEM').trim().toUpperCase() || 'SYSTEM';
  const cleanEmail = (params.email || 'anonymous').trim().toLowerCase() || 'anonymous';
  const log = appendAuditLog({
    unitCode: cleanUnit,
    unitName: params.unitName || cleanUnit,
    action: params.action,
    details: params.details,
    actorEmail: cleanEmail,
    actorRole: params.role || 'guest',
    targetId: cleanEmail,
    targetEntity: 'auth_session',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent ? params.userAgent.slice(0, 300) : undefined,
    newValues: { authMethod: params.authMethod || 'unknown', ...(params.reason ? { reason: params.reason } : {}) }
  });
  await persistAuditLogToSupabase(log).catch(() => {});
  return log;
}
