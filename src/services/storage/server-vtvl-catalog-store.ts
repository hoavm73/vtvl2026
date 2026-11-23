import fs from 'fs';
import path from 'path';
import { PL1_VTVL_CATALOG } from '@/configs/hcmute-pl1-catalog';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { writeJsonFileAtomic } from './atomic-json-file';
import { appendAuditLog, persistAuditLogToSupabase } from './server-audit-store';
import { invalidateCacheTags, invalidateUnitMutationCache } from './runtime-cache';
import { getAllActiveServerWorkbooks, saveServerWorkbookAndPersist } from './server-workbook-store';

export interface SchoolVtvlCatalogItem {
  code: string;
  name: string;
  groupName: string;
  groupRoman: 'I' | 'II' | 'III';
  rankTitle: string;
  careerLevel: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
const CATALOG_FILE = path.join(DATA_DIR, 'vtvl_catalog.json');
const DRAFT_PROPAGATE_STATUSES = new Set(['draft', 'not_started', 'returned']);

let memoryCatalog: Map<string, SchoolVtvlCatalogItem> | null = null;

function buildDefaultCatalog(): Map<string, SchoolVtvlCatalogItem> {
  const now = new Date().toISOString();
  const map = new Map<string, SchoolVtvlCatalogItem>();
  for (const item of PL1_VTVL_CATALOG) {
    const code = item.pl1Code.trim().toUpperCase();
    map.set(code, {
      code,
      name: item.positionName,
      groupName: item.vtvlGroup4,
      groupRoman: item.groupRoman,
      rankTitle: item.tt31OrNgachCode,
      careerLevel: item.careerLevel,
      isActive: true,
      updatedAt: now,
      updatedBy: 'system@hcmute.edu.vn'
    });
  }
  return map;
}

function ensureCatalog(): Map<string, SchoolVtvlCatalogItem> {
  if (memoryCatalog) return memoryCatalog;
  const base = buildDefaultCatalog();
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const raw of parsed) {
          if (raw && typeof raw.code === 'string' && raw.code.trim()) {
            const c = raw.code.trim().toUpperCase();
            base.set(c, { ...base.get(c), ...raw, code: c });
          }
        }
      }
    }
  } catch { /* fallback to default catalog */ }
  memoryCatalog = base;
  return memoryCatalog;
}

function persistCatalog(map: Map<string, SchoolVtvlCatalogItem>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    writeJsonFileAtomic(CATALOG_FILE, Array.from(map.values()));
  } catch { /* read-only fs safe */ }
}

export function resetVtvlCatalogMemoryStore(): void {
  memoryCatalog = null;
}

export function getVtvlCatalog(options?: { activeOnly?: boolean }): SchoolVtvlCatalogItem[] {
  const all = Array.from(ensureCatalog().values());
  return options?.activeOnly ? all.filter((x) => x.isActive) : all;
}

export function extractVtvlCatalogCode(
  maVtvl: string,
  expectedUnitCode?: string
): { ok: true; code: string; prefix?: string } | { ok: false; code: string; error: string } {
  const raw = String(maVtvl || '').trim().toUpperCase();
  if (!raw) return { ok: false, code: 'EMPTY_VTVL_CODE', error: 'Mã VTVL không được để trống.' };
  const parts = raw.split('.');
  if (parts.length >= 2) {
    const prefix = parts[0];
    const suffix = parts.slice(1).join('.').replace(/-\d+$/, '');
    if (expectedUnitCode && prefix !== expectedUnitCode.trim().toUpperCase()) {
      return {
        ok: false,
        code: 'CROSS_UNIT_VTVL_CODE',
        error: `Mã VTVL "${raw}" không thuộc đơn vị ${expectedUnitCode.toUpperCase()}.`
      };
    }
    return { ok: true, code: suffix, prefix };
  }
  return { ok: true, code: raw.replace(/-\d+$/, '') };
}

export function findVtvlCatalogItem(codeOrPrefixed: string): SchoolVtvlCatalogItem | undefined {
  const extracted = extractVtvlCatalogCode(codeOrPrefixed);
  if (!extracted.ok) return undefined;
  return ensureCatalog().get(extracted.code);
}

export function createVtvlCatalogItem(
  input: Partial<SchoolVtvlCatalogItem>,
  actorEmail: string
): { ok: true; item: SchoolVtvlCatalogItem } | { ok: false; status: number; code: string; error: string } {
  const code = String(input.code || '').trim().toUpperCase();
  const name = String(input.name || '').trim();
  if (!code || !/^[A-Z0-9_-]{2,24}$/.test(code)) {
    return { ok: false, status: 400, code: 'INVALID_CATALOG_CODE', error: 'Mã VTVL chuẩn không hợp lệ (chỉ gồm chữ cái, số, -, _).' };
  }
  if (!name) return { ok: false, status: 400, code: 'MISSING_VTVL_NAME', error: 'Tên VTVL chuẩn không được để trống.' };
  const map = ensureCatalog();
  if (map.has(code)) return { ok: false, status: 409, code: 'DUPLICATE_VTVL_CODE', error: `Mã VTVL "${code}" đã tồn tại trong danh mục chuẩn.` };

  const item: SchoolVtvlCatalogItem = {
    code,
    name,
    groupName: String(input.groupName || 'II. Nhóm VTVL Chuyên môn, nghiệp vụ').trim(),
    groupRoman: (input.groupRoman === 'I' || input.groupRoman === 'III') ? input.groupRoman : 'II',
    rankTitle: String(input.rankTitle || '01.003').trim(),
    careerLevel: String(input.careerLevel || 'Bậc 3').trim(),
    isActive: input.isActive !== false,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail
  };
  map.set(code, item);
  persistCatalog(map);
  invalidateCacheTags(['c1-catalog']);
  const log = appendAuditLog({
    unitCode: 'TCNS', unitName: 'Danh mục VTVL chuẩn HCM-UTE', action: 'VTVL_CATALOG_CREATE',
    details: `Thêm mã VTVL chuẩn ${code} — ${name}`, actorEmail, actorRole: 'admin',
    targetEntity: 'vtvl_catalog', targetId: code, newValues: { ...item }
  });
  void persistAuditLogToSupabase(log);
  return { ok: true, item };
}

export async function updateVtvlCatalogItem(
  rawCode: string,
  patch: Partial<Pick<SchoolVtvlCatalogItem, 'name' | 'groupName' | 'groupRoman' | 'rankTitle' | 'careerLevel' | 'isActive'>>,
  actorEmail: string
): Promise<{ ok: true; item: SchoolVtvlCatalogItem; propagatedWorkbooks: string[] } | { ok: false; status: number; code: string; error: string }> {
  const code = String(rawCode || '').trim().toUpperCase();
  const map = ensureCatalog();
  const existing = map.get(code);
  if (!existing) return { ok: false, status: 404, code: 'VTVL_NOT_FOUND', error: `Không tìm thấy mã VTVL "${code}" trong danh mục chuẩn.` };

  const nextName = patch.name !== undefined ? String(patch.name).trim() : existing.name;
  if (!nextName) return { ok: false, status: 400, code: 'MISSING_VTVL_NAME', error: 'Tên VTVL chuẩn không được để trống.' };

  const updated: SchoolVtvlCatalogItem = {
    ...existing,
    name: nextName,
    groupName: patch.groupName !== undefined ? String(patch.groupName).trim() : existing.groupName,
    groupRoman: patch.groupRoman ?? existing.groupRoman,
    rankTitle: patch.rankTitle !== undefined ? String(patch.rankTitle).trim() : existing.rankTitle,
    careerLevel: patch.careerLevel !== undefined ? String(patch.careerLevel).trim() : existing.careerLevel,
    isActive: patch.isActive !== undefined ? Boolean(patch.isActive) : existing.isActive,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail
  };
  map.set(code, updated);
  persistCatalog(map);
  invalidateCacheTags(['c1-catalog', 'workbooks', 'overview-stats', 'unit-monitor', 'check-results']);

  const nameChanged = existing.name !== updated.name || existing.groupName !== updated.groupName || existing.rankTitle !== updated.rankTitle;
  const log = appendAuditLog({
    unitCode: 'TCNS', unitName: 'Danh mục VTVL chuẩn HCM-UTE',
    action: existing.name !== updated.name ? 'VTVL_CATALOG_RENAME' : 'VTVL_CATALOG_UPDATE',
    details: `Cập nhật VTVL ${code}: "${existing.name}" → "${updated.name}" (active=${updated.isActive})`,
    actorEmail, actorRole: 'admin', targetEntity: 'vtvl_catalog', targetId: code,
    oldValues: { code, name: existing.name, groupName: existing.groupName, rankTitle: existing.rankTitle, isActive: existing.isActive },
    newValues: { code, name: updated.name, groupName: updated.groupName, rankTitle: updated.rankTitle, isActive: updated.isActive }
  });
  void persistAuditLogToSupabase(log);

  // Chỉ đồng bộ tên mới vào hồ sơ ở trạng thái draft / not_started / returned (không sửa submitted / approved / revisions)
  const propagatedWorkbooks: string[] = [];
  if (nameChanged) {
    for (const wb of getAllActiveServerWorkbooks()) {
      const st = String(wb.status || 'draft').toLowerCase();
      if (!DRAFT_PROPAGATE_STATUSES.has(st)) continue;
      const c1 = Array.isArray(wb.data?.C1) ? wb.data.C1 : [];
      let changed = false;
      const nextC1 = c1.map((row) => {
        const ext = extractVtvlCatalogCode(String(row.maVtvl || ''));
        if (!ext.ok || ext.code !== code) return row;
        changed = true;
        return { ...row, tenVtvl: updated.name, tenKhung: updated.name, nhomVtvl4: updated.groupName, maNgach: updated.rankTitle };
      });
      if (changed) {
        await saveServerWorkbookAndPersist({
          workbookId: wb.id, baseRevision: wb.currentRevision, data: { ...wb.data, C1: nextC1 },
          actorEmail, actorTitle: 'Cập nhật danh mục VTVL chuẩn',
          changeSummary: `Đồng bộ tên VTVL ${code} → "${updated.name}" vào bản nháp`
        });
        invalidateUnitMutationCache(wb.unitId, wb.id);
        propagatedWorkbooks.push(wb.id);
      }
    }
  }
  return { ok: true, item: updated, propagatedWorkbooks };
}

export function deleteVtvlCatalogItem(
  rawCode: string,
  actorEmail: string
): { ok: true } | { ok: false; status: number; code: string; error: string; usedByUnits?: string[] } {
  const code = String(rawCode || '').trim().toUpperCase();
  const map = ensureCatalog();
  const existing = map.get(code);
  if (!existing) return { ok: false, status: 404, code: 'VTVL_NOT_FOUND', error: `Không tìm thấy mã VTVL "${code}".` };

  const usedByUnits = new Set<string>();
  for (const wb of getAllActiveServerWorkbooks()) {
    for (const row of (wb.data?.C1 || [])) {
      const ext = extractVtvlCatalogCode(String(row.maVtvl || ''));
      if (ext.ok && ext.code === code) usedByUnits.add(wb.unitId.toUpperCase());
    }
  }
  if (usedByUnits.size > 0) {
    return {
      ok: false, status: 409, code: 'VTVL_IN_USE',
      error: `Không thể xóa cứng mã VTVL "${code}" vì đang được ${usedByUnits.size} đơn vị sử dụng. Hãy chuyển sang ngừng sử dụng (isActive = false).`,
      usedByUnits: Array.from(usedByUnits)
    };
  }
  map.delete(code);
  persistCatalog(map);
  invalidateCacheTags(['c1-catalog']);
  const log = appendAuditLog({
    unitCode: 'TCNS', unitName: 'Danh mục VTVL chuẩn HCM-UTE', action: 'VTVL_CATALOG_DELETE',
    details: `Xóa mã VTVL chưa sử dụng ${code} (${existing.name})`, actorEmail, actorRole: 'admin',
    targetEntity: 'vtvl_catalog', targetId: code, oldValues: { ...existing }
  });
  void persistAuditLogToSupabase(log);
  return { ok: true };
}

export function validateAndNormalizeUnitC1Rows(params: {
  unitCode: string;
  incomingC1: GenericGridRow[];
  existingC1?: GenericGridRow[];
}): { ok: true; normalizedC1: GenericGridRow[] } | { ok: false; status: number; code: string; error: string } {
  const uc = params.unitCode.trim().toUpperCase();
  const catalog = ensureCatalog();
  const existingById = new Map((params.existingC1 || []).map((r) => [String(r.id || ''), r]));
  const existingCodes = new Set((params.existingC1 || []).map((r) => String(r.maVtvl || '').trim().toUpperCase()));
  const normalizedC1: GenericGridRow[] = [];

  for (const row of params.incomingC1) {
    const rawMa = String(row.maVtvl || '').trim().toUpperCase();
    const ext = extractVtvlCatalogCode(rawMa, uc);
    if (!ext.ok) return { ok: false, status: 400, code: ext.code, error: ext.error };

    const prevRow = existingById.get(String(row.id || ''));
    const wasAlreadyPresent = Boolean(prevRow && String(prevRow.maVtvl || '').trim().toUpperCase() === rawMa) || existingCodes.has(rawMa);
    const catalogItem = catalog.get(ext.code);

    if (!catalogItem) {
      if (wasAlreadyPresent) {
        normalizedC1.push(row);
        continue;
      }
      return {
        ok: false, status: 400, code: 'INVALID_VTVL_CODE',
        error: `Mã VTVL "${rawMa}" (mã chuẩn "${ext.code}") không tồn tại trong Danh mục VTVL chuẩn cấp Trường.`
      };
    }
    if (!catalogItem.isActive && !wasAlreadyPresent) {
      return {
        ok: false, status: 400, code: 'INACTIVE_VTVL_CODE',
        error: `Mã VTVL "${catalogItem.code}" đã ngừng sử dụng, không thể thêm mới vào Biểu C1.`
      };
    }
    normalizedC1.push({
      ...row,
      maVtvl: `${uc}.${catalogItem.code}`,
      tenVtvl: catalogItem.name,
      tenKhung: catalogItem.name,
      nhomVtvl4: catalogItem.groupName,
      maNgach: catalogItem.rankTitle,
      bacNgheNghiep: row.bacNgheNghiep || catalogItem.careerLevel
    });
  }
  return { ok: true, normalizedC1 };
}
