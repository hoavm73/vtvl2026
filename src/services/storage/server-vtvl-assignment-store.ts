import fs from 'fs';
import path from 'path';
import {
  CoordinatedVtvlRecipientPreview,
  UserVtvlAssignment
} from '@/types/staff-ticket';
import { getUserAccountByEmail } from './server-account-store';
import { getOrCreateWorkbook, normalizeEmail } from './server-workbook-store';
import { isIsolatedLocalMode } from './server-ticket-db';
import { registerCacheInvalidator } from './server-file-lock';
import { isDatabaseConfigured, prisma, toIsoString } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';
import {
  makeCompositeVtvlKey,
  normalizeCode,
  resolveCatalogVtvlName,
  resolveUnitCodeSafe,
  resolveUnitNameSafe,
  UNASSIGNED_VTVL_MESSAGE
} from '@/services/tickets/vtvl-coordination-helpers';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const ASSIGNMENTS_FILE = path.join(DATA_DIR, 'user_vtvl_assignments.json');

let memoryAssignments: UserVtvlAssignment[] | null = null;
export function resetVtvlAssignmentMemoryStore(): void {
  memoryAssignments = null;
}
registerCacheInvalidator(resetVtvlAssignmentMemoryStore);

function loadLocalAssignments(): UserVtvlAssignment[] {
  if (memoryAssignments) return memoryAssignments;
  try {
    if (fs.existsSync(ASSIGNMENTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ASSIGNMENTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        memoryAssignments = parsed.filter((r) => r && r.userEmail && r.unitCode && r.maVtvl);
        return memoryAssignments;
      }
    }
  } catch {
    // ignore corrupted local cache
  }
  memoryAssignments = [];
  return memoryAssignments;
}

function persistLocalAssignments(list: UserVtvlAssignment[]): void {
  memoryAssignments = list;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

export async function syncVtvlAssignmentsFromSupabase(): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return;
  try {
    const rows = await prisma.user_vtvl_assignments.findMany({ where: { is_active: true } });
    const mapped: UserVtvlAssignment[] = rows.map((r) => ({
      id: String(r.id || `uva-${Date.now()}`),
      userEmail: normalizeEmail(String(r.user_email || '')),
      unitCode: resolveUnitCodeSafe(String(r.unit_code || '')),
      maVtvl: String(r.ma_vtvl || '').trim(),
      tenVtvl: r.ten_vtvl ? String(r.ten_vtvl) : undefined,
      isActive: r.is_active !== false,
      assignedBy: r.assigned_by ? String(r.assigned_by) : undefined,
      createdAt: toIsoString(r.created_at) || new Date().toISOString(),
      updatedAt: toIsoString(r.updated_at) || new Date().toISOString()
    }));
    persistLocalAssignments(mapped);
  } catch {
    // ignore transient DB fallback
  }
}

export function resolveUnitVtvlName(unitCode: string, maVtvl: string): string {
  const cleanUnit = resolveUnitCodeSafe(unitCode);
  const cleanCode = normalizeCode(maVtvl);
  if (!cleanUnit || !cleanCode) return '';
  try {
    const wb = getOrCreateWorkbook(cleanUnit);
    const c1 = Array.isArray(wb.data?.C1) ? wb.data.C1 : [];
    const matched = c1.find((row) => normalizeCode(row.maVtvl) === cleanCode);
    if (matched?.tenVtvl) return String(matched.tenVtvl).trim();
  } catch {
    // ignore
  }
  return resolveCatalogVtvlName(maVtvl);
}

function isAssignmentValidForActiveAccount(a: UserVtvlAssignment): boolean {
  if (!a.isActive) return false;
  const account = getUserAccountByEmail(a.userEmail);
  if (!account || account.status === 'suspended') return false;
  // Đối chiếu đồng thời đơn vị của tài khoản và đơn vị phân công VTVL
  return resolveUnitCodeSafe(account.unitCode) === resolveUnitCodeSafe(a.unitCode);
}

export function getAllVtvlAssignments(unitCode?: string): UserVtvlAssignment[] {
  const targetUnit = unitCode ? resolveUnitCodeSafe(unitCode) : '';
  return loadLocalAssignments().filter((a) => {
    if (!a.isActive) return false;
    if (targetUnit && resolveUnitCodeSafe(a.unitCode) !== targetUnit) return false;
    return true;
  });
}

export function getAssignmentsForEmail(email: string): UserVtvlAssignment[] {
  const norm = normalizeEmail(email);
  if (!norm) return [];
  return loadLocalAssignments().filter(
    (a) => normalizeEmail(a.userEmail) === norm && isAssignmentValidForActiveAccount(a)
  );
}

export function getRecipientsForVtvlTarget(
  targetUnitCode: string,
  maVtvl: string
): { email: string; displayName: string; unitCode: string }[] {
  const targetKey = makeCompositeVtvlKey(targetUnitCode, maVtvl);
  if (!targetKey) return [];

  const seen = new Set<string>();
  const recipients: { email: string; displayName: string; unitCode: string }[] = [];

  for (const a of loadLocalAssignments()) {
    if (makeCompositeVtvlKey(a.unitCode, a.maVtvl) !== targetKey) continue;
    if (!isAssignmentValidForActiveAccount(a)) continue;
    const norm = normalizeEmail(a.userEmail);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const acc = getUserAccountByEmail(norm);
    recipients.push({
      email: norm,
      displayName: acc?.displayName || norm.split('@')[0],
      unitCode: resolveUnitCodeSafe(a.unitCode)
    });
  }

  return recipients.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
}

export function previewRecipientsForTargets(
  targets: { targetUnitCode: string; maVtvl: string; tenVtvl?: string }[]
): CoordinatedVtvlRecipientPreview[] {
  const seen = new Set<string>();
  const previews: CoordinatedVtvlRecipientPreview[] = [];

  for (const t of targets) {
    const unitCode = resolveUnitCodeSafe(t.targetUnitCode);
    const maVtvl = String(t.maVtvl || '').trim();
    const key = makeCompositeVtvlKey(unitCode, maVtvl);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const recipients = getRecipientsForVtvlTarget(unitCode, maVtvl);
    previews.push({
      targetUnitCode: unitCode,
      targetUnitName: resolveUnitNameSafe(unitCode),
      maVtvl,
      tenVtvl: (t.tenVtvl || '').trim() || resolveUnitVtvlName(unitCode, maVtvl),
      recipients,
      emptyMessage: recipients.length === 0 ? UNASSIGNED_VTVL_MESSAGE : undefined
    });
  }

  return previews;
}

export async function setAssignmentsForAccount(params: {
  userEmail: string;
  unitCode: string;
  items: { maVtvl: string; tenVtvl?: string }[];
  assignedBy: string;
}): Promise<UserVtvlAssignment[]> {
  const normEmail = normalizeEmail(params.userEmail);
  const unitCode = resolveUnitCodeSafe(params.unitCode);
  const nowIso = new Date().toISOString();

  const deduped = new Map<string, { maVtvl: string; tenVtvl?: string }>();
  for (const raw of params.items) {
    const code = String(raw.maVtvl || '').trim();
    if (!code) continue;
    deduped.set(normalizeCode(code), {
      maVtvl: code,
      tenVtvl: String(raw.tenVtvl || '').trim() || resolveUnitVtvlName(unitCode, code) || undefined
    });
  }

  const nextRecords: UserVtvlAssignment[] = Array.from(deduped.values()).map((item) => ({
    id: `uva-${unitCode}-${normalizeCode(item.maVtvl)}-${Buffer.from(normEmail).toString('hex').slice(0, 10)}`,
    userEmail: normEmail,
    unitCode,
    maVtvl: item.maVtvl,
    tenVtvl: item.tenVtvl,
    isActive: true,
    assignedBy: normalizeEmail(params.assignedBy),
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      await prisma.user_vtvl_assignments.deleteMany({ where: { user_email: normEmail } });
      if (nextRecords.length > 0) {
        await pgUpsertRows(
          'user_vtvl_assignments',
          nextRecords.map((r) => ({
            user_email: r.userEmail,
            unit_code: r.unitCode,
            ma_vtvl: r.maVtvl,
            ten_vtvl: r.tenVtvl || null,
            is_active: true,
            assigned_by: r.assignedBy || null,
            created_at: r.createdAt,
            updated_at: r.updatedAt
          })),
          'user_email,unit_code,ma_vtvl'
        );
      }
    } catch {
      // Fallback an toàn vào dữ liệu cục bộ
    }
  }

  const remaining = loadLocalAssignments().filter((a) => normalizeEmail(a.userEmail) !== normEmail);
  const merged = [...remaining, ...nextRecords];
  persistLocalAssignments(merged);
  return nextRecords;
}
