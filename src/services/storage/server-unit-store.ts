import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { HcmuteUnit, UnitGroupKind } from '@/types/vtvl';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { getDbTestHook, isDatabaseConfigured, prisma } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';
import { invalidateCacheTags } from './runtime-cache';
import { writeJsonFileAtomic } from './atomic-json-file';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const UNITS_FILE = path.join(DATA_DIR, 'custom_units.json');
const getDbUrl = () => (process.env.DATABASE_URL || '').trim();

const VALID_UNIT_GROUPS = new Set<UnitGroupKind>(['khoa-vien', 'phong-ban', 'trung-tam', 'dang-doanthe']);

export function assertUnitDbConfigured(operation: string): void {
  if (!getDbUrl() && !isDatabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(`[DB_SERVICE_UNAVAILABLE] Dịch vụ CSDL máy chủ chưa được cấu hình cho thao tác ${operation}.`);
      (err as unknown as { code: string; status: number }).code = 'DB_SERVICE_UNAVAILABLE';
      (err as unknown as { code: string; status: number }).status = 503;
      throw err;
    }
  }
}

let memoryUnits: HcmuteUnit[] | null = null;
let lastSupabaseSyncAt = 0;

export const DELETED_UNIT_CODES = new Set([
  'IDDF', 'TRTC', 'HDT', 'BGH', 'FFT',
  'TTNN', 'TTVD', 'TTRBTM', 'TTKTTH', 'KTCNMT', 'NCUDKTXD', 'THKTTH', 'TTCNTT', 'CDT', 'DTN'
]);

export const LEGACY_UNIT_MAP: Record<string, string> = {
  FME: 'CK', FEET: 'GTNL', FEEE: 'DDT', FIT: 'CNTT', FCFT: 'HHKHSS',
  FCE: 'XD', FE: 'KT', FAE: 'DTTT', FGAM: 'MTTT', FPI: 'CTL',
  FAS: 'KHUD', FFL: 'NN', ITE: 'VSPKT', IIE: 'VDTQT', CISAT: 'STKNCCCN',
  INC: 'TTTTMT', STC: 'CNPM', BMC: 'QTTHTT', AAO: 'DT', OIA: 'QHQT',
  ERO: 'QHDN', FPO: 'KHTC', STIAO: 'KHCN', OGA: 'HCTH', SAO: 'CTSV',
  QAO: 'KTDBCL', EMO: 'QTCSVC', CPM: 'QLDTXDDT'
};

export function normalizeRemoteUnits(remoteUnits: HcmuteUnit[]): HcmuteUnit[] {
  const seenCodes = new Set<string>();
  const normalized: HcmuteUnit[] = [];
  for (const raw of remoteUnits) {
    if (!raw || !raw.code) continue;
    const rawCode = String(raw.code).trim().toUpperCase();
    if (DELETED_UNIT_CODES.has(rawCode)) continue;
    const targetCanonical = LEGACY_UNIT_MAP[rawCode];
    let effectiveUnit: HcmuteUnit;
    if (targetCanonical) {
      const canonicalMatch = HCMUTE_UNITS.find((u) => u.code.toUpperCase() === targetCanonical);
      effectiveUnit = canonicalMatch ? { ...canonicalMatch } : { ...raw, code: targetCanonical };
    } else {
      effectiveUnit = { ...raw };
    }
    const normCode = effectiveUnit.code.trim().toUpperCase();
    if (DELETED_UNIT_CODES.has(normCode) || seenCodes.has(normCode)) continue;
    seenCodes.add(normCode);
    normalized.push(effectiveUnit);
  }
  return normalized;
}

function mapDmDonViRowToUnit(r: Record<string, unknown>): HcmuteUnit {
  const code = String(r.ma_don_vi || '').trim().toUpperCase();
  const base = HCMUTE_UNITS.find((u) => u.code.toUpperCase() === code);
  const rawGroup = String(r.khoi_don_vi || base?.group || 'phong-ban') as UnitGroupKind;
  return {
    code,
    nameVi: String(r.ten_don_vi_vi || base?.nameVi || code).trim(),
    nameEn: String(r.ten_don_vi_en || base?.nameEn || r.ten_don_vi_vi || code).trim(),
    group: VALID_UNIT_GROUPS.has(rawGroup) ? rawGroup : 'phong-ban',
    domain: base?.domain || `${code.toLowerCase()}.hcmute.edu.vn`,
    headTitleVi: String(r.chuc_danh_thu_truong_vi || base?.headTitleVi || 'Trưởng đơn vị'),
    headTitleEn: String(r.chuc_danh_thu_truong_en || base?.headTitleEn || 'Head of Department'),
    defaultStaffCount: Number(r.so_nhan_su_mac_dinh ?? base?.defaultStaffCount ?? 10)
  };
}

function mapUnitToDmDonViRow(u: HcmuteUnit) {
  const code = u.code.trim().toUpperCase();
  const group: UnitGroupKind = VALID_UNIT_GROUPS.has(u.group) ? u.group : 'phong-ban';
  return {
    ma_don_vi: code,
    ten_don_vi_vi: (u.nameVi || code).trim(),
    ten_don_vi_en: (u.nameEn || u.nameVi || code).trim(),
    khoi_don_vi: group,
    linh_vuc: u.domain || null,
    chuc_danh_thu_truong_vi: u.headTitleVi || 'Trưởng đơn vị',
    chuc_danh_thu_truong_en: u.headTitleEn || 'Head of Department',
    so_nhan_su_mac_dinh: Math.max(0, Number(u.defaultStaffCount) || 10),
    is_active: true,
    updated_at: new Date().toISOString()
  };
}

async function upsertUnitsToDmDonVi(units: HcmuteUnit[]): Promise<boolean> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured() || units.length === 0) return false;
  const rows = units.filter((u) => u.code && !DELETED_UNIT_CODES.has(u.code.toUpperCase())).map(mapUnitToDmDonViRow);
  if (rows.length === 0) return false;
  const res = await pgUpsertRows('dm_don_vi', rows, 'ma_don_vi');
  return res.ok;
}

async function deactivateUnitInDmDonVi(code: string): Promise<boolean> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return false;
  const norm = code.trim().toUpperCase();
  if (getDbTestHook()) return true;
  await prisma.dm_don_vi.updateMany({
    where: { ma_don_vi: norm },
    data: { is_active: false, updated_at: new Date() }
  });
  return true;
}

function persistLocalUnits(): void {
  if (!memoryUnits) return;
  writeJsonFileAtomic(UNITS_FILE, memoryUnits, true);
}

async function persistUnitsToSupabase(units: HcmuteUnit[]): Promise<boolean> {
  assertUnitDbConfigured('persist_units');
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return false;
  try {
    await upsertUnitsToDmDonVi(units);
    const hook = getDbTestHook();
    if (hook?.select) {
      const rows = await hook.select('t_tien_do', { ma_don_vi: 'TCNS' });
      const prev = rows[0] || {};
      const r = await pgUpsertRows('t_tien_do', {
        ma_don_vi: 'TCNS', ten_don_vi: 'Phòng Tổ chức - Nhân sự', phien_ban: prev.phien_ban || 'v1',
        du_lieu_ho_so_json: { ...((prev.du_lieu_ho_so_json as Record<string, unknown>) || {}), customUnits: units, unitsUpdatedAt: new Date().toISOString() }
      }, 'ma_don_vi');
      return r.ok;
    }
    const existingRow = await prisma.t_tien_do.findUnique({ where: { ma_don_vi: 'TCNS' } });
    const prevJson = (existingRow?.du_lieu_ho_so_json as Record<string, unknown>) || {};
    const nextJson = { ...prevJson, customUnits: units, unitsUpdatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue;
    await prisma.t_tien_do.upsert({
      where: { ma_don_vi: 'TCNS' },
      update: { ten_don_vi: 'Phòng Tổ chức - Nhân sự', du_lieu_ho_so_json: nextJson, updated_at: new Date() },
      create: { ma_don_vi: 'TCNS', ten_don_vi: 'Phòng Tổ chức - Nhân sự', phien_ban: existingRow?.phien_ban || 'v1', du_lieu_ho_so_json: nextJson }
    });
    return true;
  } catch (err: unknown) {
    const errObj = err as { code?: string; status?: number };
    if (errObj?.code === 'DB_SERVICE_UNAVAILABLE' || errObj?.status === 503) throw err;
    return false;
  }
}

export function loadServerUnits(): HcmuteUnit[] {
  if (memoryUnits && memoryUnits.length > 0) return memoryUnits;
  try {
    if (fs.existsSync(UNITS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(UNITS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) { memoryUnits = parsed; return memoryUnits; }
    }
  } catch { /* ignore */ }
  memoryUnits = [...HCMUTE_UNITS];
  return memoryUnits;
}

export function getServerUnits(): HcmuteUnit[] { return loadServerUnits(); }

export function resetUnitMemoryStore(): void {
  memoryUnits = null;
  lastSupabaseSyncAt = 0;
  invalidateCacheTags(['units', 'overview-stats', 'unit-monitor']);
}

export async function syncUnitsFromSupabase(force = false): Promise<HcmuteUnit[]> {
  const now = Date.now();
  if (!force && now - lastSupabaseSyncAt < 30000 && memoryUnits && memoryUnits.length > 0) return memoryUnits;
  assertUnitDbConfigured('sync_units');
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return loadServerUnits();

  try {
    const hook = getDbTestHook();
    const dmRows: Record<string, unknown>[] = hook?.select
      ? await hook.select('dm_don_vi')
      : ((await prisma.dm_don_vi.findMany({ orderBy: { ma_don_vi: 'asc' } })) as unknown as Record<string, unknown>[]);
    const tdRow: Record<string, unknown> | null = hook?.select
      ? ((await hook.select('t_tien_do', { ma_don_vi: 'TCNS' }))[0] || null)
      : ((await prisma.t_tien_do.findUnique({ where: { ma_don_vi: 'TCNS' }, select: { du_lieu_ho_so_json: true } })) as unknown as Record<string, unknown> | null);
    const rawJson = (tdRow?.du_lieu_ho_so_json as Record<string, unknown>) || {};
    const tcnsCustom = Array.isArray(rawJson.customUnits) ? normalizeRemoteUnits(rawJson.customUnits as HcmuteUnit[]) : [];

    if (Array.isArray(dmRows) && dmRows.length > 0) {
      const inactiveCodeSet = new Set(dmRows.filter((r) => r.is_active === false).map((r) => String(r.ma_don_vi || '').trim().toUpperCase()));
      const dmUnits = dmRows.filter((r) => r.is_active !== false).map(mapDmDonViRowToUnit);
      const dmCodeSet = new Set(dmUnits.map((u) => u.code));
      const missingFromDm = tcnsCustom.filter((u) => {
        const c = u.code.toUpperCase();
        return !dmCodeSet.has(c) && !inactiveCodeSet.has(c);
      });
      if (missingFromDm.length > 0) await upsertUnitsToDmDonVi(missingFromDm).catch(() => {});
      memoryUnits = normalizeRemoteUnits([...dmUnits, ...missingFromDm]);
      persistLocalUnits();
      lastSupabaseSyncAt = now;
      return memoryUnits;
    }
    if (tcnsCustom.length > 0) {
      memoryUnits = tcnsCustom;
      persistLocalUnits();
      lastSupabaseSyncAt = now;
      return memoryUnits;
    }
  } catch (err: unknown) {
    const errObj = err as { code?: string; status?: number };
    if (errObj?.code === 'DB_SERVICE_UNAVAILABLE' || errObj?.status === 503) throw err;
  }
  lastSupabaseSyncAt = now;
  return loadServerUnits();
}

export async function saveServerUnitsList(units: HcmuteUnit[]): Promise<HcmuteUnit[]> {
  await persistUnitsToSupabase(units);
  memoryUnits = [...units];
  persistLocalUnits();
  invalidateCacheTags(['units', 'overview-stats', 'unit-monitor']);
  return memoryUnits;
}

export async function upsertServerUnit(unit: HcmuteUnit, originalCode?: string): Promise<{ units: HcmuteUnit[]; oldUnit: HcmuteUnit | null }> {
  const current = [...getServerUnits()];
  const normCode = unit.code.trim().toUpperCase();
  const lookupCode = (originalCode || normCode).trim().toUpperCase();
  const idx = current.findIndex((u) => u.code.toUpperCase() === lookupCode);
  const oldUnit = idx >= 0 ? current[idx] : null;

  if (originalCode && lookupCode !== normCode) {
    const duplicateIdx = current.findIndex((u) => u.code.toUpperCase() === normCode);
    if (duplicateIdx >= 0 && duplicateIdx !== idx) {
      throw Object.assign(
        new Error(`Mã đơn vị mới [${normCode}] đã tồn tại trong danh mục đang hoạt động.`),
        { code: 'UNIT_CODE_ALREADY_EXISTS', status: 409 }
      );
    }
  }

  const clean: HcmuteUnit = {
    ...unit,
    code: normCode,
    immutableUnitId: unit.immutableUnitId || oldUnit?.immutableUnitId || lookupCode,
    nameVi: unit.nameVi.trim(),
    nameEn: (unit.nameEn || unit.nameVi).trim(),
    domain: unit.domain?.trim() || `${normCode.toLowerCase()}.hcmute.edu.vn`,
    headTitleVi: unit.headTitleVi?.trim() || 'Trưởng đơn vị',
    headTitleEn: unit.headTitleEn?.trim() || 'Head of Department',
    defaultStaffCount: Number(unit.defaultStaffCount) || 10
  };
  if (idx >= 0) current[idx] = clean;
  else current.unshift(clean);
  await saveServerUnitsList(current);
  if (originalCode && lookupCode !== normCode) await deactivateUnitInDmDonVi(lookupCode).catch(() => {});
  return { units: current, oldUnit };
}

export async function deleteServerUnit(code: string): Promise<HcmuteUnit[]> {
  const norm = code.trim().toUpperCase();
  const filtered = getServerUnits().filter((u) => u.code.toUpperCase() !== norm);
  await deactivateUnitInDmDonVi(norm).catch(() => {});
  await saveServerUnitsList(filtered);
  return filtered;
}

export async function resetServerUnits(): Promise<HcmuteUnit[]> {
  const defaults = [...HCMUTE_UNITS];
  await saveServerUnitsList(defaults);
  return defaults;
}
