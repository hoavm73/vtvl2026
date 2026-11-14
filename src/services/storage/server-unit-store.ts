import fs from 'fs';
import path from 'path';
import { HcmuteUnit } from '@/types/vtvl';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const UNITS_FILE = path.join(DATA_DIR, 'custom_units.json');
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Thao tác đặc quyền server-side: Bắt buộc duy nhất SUPABASE_SERVICE_ROLE_KEY ở mọi môi trường
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function assertUnitDbConfigured(operation: string): void {
  if (!SUPABASE_URL || !SERVICE_KEY) {
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

function getSupabaseHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

export const DELETED_UNIT_CODES = new Set(['IDDF', 'TRTC', 'HDT', 'BGH', 'FFT']);

export const LEGACY_UNIT_MAP: Record<string, string> = {
  FME: 'CK', FEET: 'GTNL', FEEE: 'DDT', FIT: 'CNTT', FCFT: 'HHKHSS',
  FCE: 'XD', FE: 'KT', FAE: 'DTTT', FGAM: 'MTTT', FPI: 'CTL',
  FAS: 'KHUD', FFL: 'NN', ITE: 'VSPKT', IIE: 'VDTQT', CISAT: 'STKNCCCN',
  INC: 'TTTTMT', ITC: 'TTCNTT', STC: 'CNPM', TPC: 'THKTTH', CFL: 'TTNN',
  VGC: 'TTVD', SRC: 'TTRBTM', ESC: 'TTKTTH', EETC: 'KTCNMT', CERAC: 'NCUDKTXD',
  BMC: 'QTTHTT', AAO: 'DT', OIA: 'QHQT', ERO: 'QHDN', FPO: 'KHTC',
  STIAO: 'KHCN', OGA: 'HCTH', SAO: 'CTSV', QAO: 'KTDBCL', EMO: 'QTCSVC',
  CPM: 'QLDTXDDT'
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
    if (DELETED_UNIT_CODES.has(normCode)) continue;
    if (!seenCodes.has(normCode)) {
      seenCodes.add(normCode);
      normalized.push(effectiveUnit);
    }
  }

  return normalized;
}

function persistLocalUnits(): void {
  if (!memoryUnits) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(UNITS_FILE, JSON.stringify(memoryUnits, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

async function persistUnitsToSupabase(units: HcmuteUnit[]): Promise<boolean> {
  assertUnitDbConfigured('persist_units');
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.TCNS&select=du_lieu_ho_so_json,phien_ban`,
      { headers: getSupabaseHeaders(), cache: 'no-store' }
    );
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    const existingRow = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?on_conflict=ma_don_vi`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        ma_don_vi: 'TCNS',
        ten_don_vi: 'Phòng Tổ chức - Nhân sự',
        phien_ban: existingRow?.phien_ban || 'v1',
        du_lieu_ho_so_json: {
          ...(existingRow?.du_lieu_ho_so_json || {}),
          customUnits: units,
          unitsUpdatedAt: new Date().toISOString()
        }
      })
    });
    return res.ok;
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
      const raw = fs.readFileSync(UNITS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryUnits = parsed;
        return memoryUnits;
      }
    }
  } catch {
    // ignore
  }
  memoryUnits = [...HCMUTE_UNITS];
  return memoryUnits;
}

export function getServerUnits(): HcmuteUnit[] {
  return loadServerUnits();
}

export async function syncUnitsFromSupabase(force = false): Promise<HcmuteUnit[]> {
  const now = Date.now();
  if (!force && now - lastSupabaseSyncAt < 30000 && memoryUnits && memoryUnits.length > 0) {
    return memoryUnits;
  }
  assertUnitDbConfigured('sync_units');
  if (!SUPABASE_URL || !SERVICE_KEY) return loadServerUnits();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.TCNS&select=du_lieu_ho_so_json`,
      { headers: getSupabaseHeaders(), cache: 'no-store' }
    );
    if (res.ok) {
      const rows = await res.json();
      const tcnsRow = Array.isArray(rows) && rows[0] ? rows[0] : null;
      const remoteUnits = tcnsRow?.du_lieu_ho_so_json?.customUnits;
      if (Array.isArray(remoteUnits) && remoteUnits.length > 0) {
        memoryUnits = normalizeRemoteUnits(remoteUnits);
        persistLocalUnits();
        lastSupabaseSyncAt = now;
        return memoryUnits;
      }
    }
  } catch (err: unknown) {
    const errObj = err as { code?: string; status?: number };
    if (errObj?.code === 'DB_SERVICE_UNAVAILABLE' || errObj?.status === 503) throw err;
    // Lỗi mạng dev/local: fallback bộ nhớ cục bộ an toàn
  }
  lastSupabaseSyncAt = now;
  return loadServerUnits();
}

export async function saveServerUnitsList(units: HcmuteUnit[]): Promise<HcmuteUnit[]> {
  memoryUnits = [...units];
  persistLocalUnits();
  await persistUnitsToSupabase(units);
  return memoryUnits;
}

export async function upsertServerUnit(
  unit: HcmuteUnit,
  originalCode?: string
): Promise<{ units: HcmuteUnit[]; oldUnit: HcmuteUnit | null }> {
  const current = [...getServerUnits()];
  const normCode = unit.code.trim().toUpperCase();
  const clean: HcmuteUnit = {
    ...unit,
    code: normCode,
    nameVi: unit.nameVi.trim(),
    nameEn: unit.nameEn.trim(),
    domain: unit.domain?.trim() || `${normCode.toLowerCase()}.hcmute.edu.vn`,
    headTitleVi: unit.headTitleVi?.trim() || 'Trưởng đơn vị',
    headTitleEn: unit.headTitleEn?.trim() || 'Head of Department',
    defaultStaffCount: Number(unit.defaultStaffCount) || 10
  };

  const lookupCode = (originalCode || normCode).toUpperCase();
  const idx = current.findIndex((u) => u.code.toUpperCase() === lookupCode);
  const oldUnit = idx >= 0 ? current[idx] : null;

  if (idx >= 0) {
    current[idx] = clean;
  } else {
    current.unshift(clean);
  }

  await saveServerUnitsList(current);
  return { units: current, oldUnit };
}

export async function deleteServerUnit(code: string): Promise<HcmuteUnit[]> {
  const current = getServerUnits();
  const norm = code.trim().toUpperCase();
  const filtered = current.filter((u) => u.code.toUpperCase() !== norm);
  await saveServerUnitsList(filtered);
  return filtered;
}

export async function resetServerUnits(): Promise<HcmuteUnit[]> {
  const defaults = [...HCMUTE_UNITS];
  await saveServerUnitsList(defaults);
  return defaults;
}
