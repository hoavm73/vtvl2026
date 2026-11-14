import fs from 'fs';
import path from 'path';

export interface ServerAuditLog {
  id: string;
  workbookId?: string;
  unitCode: string;
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
  const newLog: ServerAuditLog = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    timestamp: Date.now()
  };
  memoryAuditLogs.unshift(newLog);
  // Giới hạn bộ nhớ 5000 bản ghi gần nhất
  if (memoryAuditLogs.length > 5000) {
    memoryAuditLogs.length = 5000;
  }
  persistLogs();
  return newLog;
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

