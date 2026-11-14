import { GenericGridRow, ExcelSheetKey } from '@/components/excel-grid/excel-grid-types';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { getCurrentOperatorSession, saveCurrentOperatorSession, getAllEmailSessions } from '@/services/telemetry/operator-session';

export function replaceUnitCodePrefix(code: string | undefined | null, oldCode: string, newCode: string): string {
  if (!code) return '';
  const s = String(code).trim();
  const upper = s.toUpperCase();
  const oldUpper = oldCode.toUpperCase();
  const newUpper = newCode.toUpperCase();

  if (upper.startsWith(`${oldUpper}.`)) {
    return `${newUpper}.${s.slice(oldUpper.length + 1)}`;
  }
  if (upper === oldUpper) {
    return newUpper;
  }
  return s;
}

export function migrateGridRow(
  row: GenericGridRow,
  oldCode: string,
  newCode: string,
  oldNameVi?: string,
  newNameVi?: string
): GenericGridRow {
  const updated: GenericGridRow = { ...row };

  if (updated.maNhiemVu) {
    updated.maNhiemVu = replaceUnitCodePrefix(String(updated.maNhiemVu), oldCode, newCode);
  }
  if (updated.maCongViec) {
    updated.maCongViec = replaceUnitCodePrefix(String(updated.maCongViec), oldCode, newCode);
  }
  if (updated.maVtvl) {
    updated.maVtvl = replaceUnitCodePrefix(String(updated.maVtvl), oldCode, newCode);
  }
  if (updated.maDonVi && String(updated.maDonVi).toUpperCase() === oldCode.toUpperCase()) {
    updated.maDonVi = newCode.toUpperCase();
  }
  if (oldNameVi && newNameVi) {
    if (updated.tenDonVi && (updated.tenDonVi === oldNameVi || String(updated.tenDonVi).includes(oldNameVi))) {
      updated.tenDonVi = String(updated.tenDonVi).replaceAll(oldNameVi, newNameVi);
    }
    if (updated.donVi && (updated.donVi === oldNameVi || String(updated.donVi).includes(oldNameVi))) {
      updated.donVi = String(updated.donVi).replaceAll(oldNameVi, newNameVi);
    }
  }

  return updated;
}

export function migrateWorkbookSheets(
  data: Record<string, GenericGridRow[]>,
  oldCode: string,
  newCode: string,
  oldNameVi: string,
  newNameVi: string
): Record<ExcelSheetKey, GenericGridRow[]> {
  const cleanOld = oldCode.toUpperCase();
  const cleanNew = newCode.toUpperCase();
  const migrated: Record<string, GenericGridRow[]> = {};

  for (const [key, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) {
      migrated[key] = [];
      continue;
    }
    migrated[key] = rows.map((r) => migrateGridRow(r, cleanOld, cleanNew, oldNameVi, newNameVi));
  }

  const recalculated = recalculateGridFormulas(
    migrated as Record<ExcelSheetKey, GenericGridRow[]>,
    cleanNew,
    newNameVi
  );

  const now = new Date().toLocaleString('vi-VN');
  const syncLog: GenericGridRow = {
    id: `log-sync-${Date.now().toString(36)}`,
    thoiGian: now,
    maDonVi: cleanNew,
    tenDonVi: newNameVi,
    nguoiThucHien: 'Quản trị viên hệ thống [TCNS]',
    noiDungThayDoi: `Đồng bộ tự động mã đơn vị (${cleanOld} ➔ ${cleanNew}) và tên đơn vị trên toàn bộ 15 biểu`,
    trangThai: 'Đã đồng bộ'
  };
  recalculated.S = [syncLog, ...(recalculated.S || [])];

  return recalculated;
}

export function syncUnitCodeAndNameInBrowser(
  oldCode: string,
  newCode: string,
  oldNameVi: string,
  newNameVi: string
): void {
  if (typeof window === 'undefined') return;
  const cOld = oldCode.trim().toUpperCase();
  const cNew = newCode.trim().toUpperCase();
  const oldName = oldNameVi.trim();
  const newName = newNameVi.trim();

  let updatedGridData: Record<ExcelSheetKey, GenericGridRow[]> | null = null;
  const oldKey = `hcmute_vtvl_grid_${cOld}`;
  const newKey = `hcmute_vtvl_grid_${cNew}`;

  try {
    const raw = localStorage.getItem(oldKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      updatedGridData = migrateWorkbookSheets(parsed, cOld, cNew, oldName, newName);
      localStorage.setItem(newKey, JSON.stringify(updatedGridData));
      if (cOld !== cNew) localStorage.removeItem(oldKey);
    }
  } catch { /* ignore */ }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hcmute_vtvl_session_data_')) {
        const raw = localStorage.getItem(k);
        if (raw && raw.includes(cOld)) {
          const parsed = JSON.parse(raw);
          const next = migrateWorkbookSheets(parsed, cOld, cNew, oldName, newName);
          localStorage.setItem(k, JSON.stringify(next));
        }
      }
    }
  } catch { /* ignore */ }

  try {
    const cur = getCurrentOperatorSession();
    if (cur && cur.unitCode.toUpperCase() === cOld) {
      saveCurrentOperatorSession(cur.email, cNew, cur.title, {
        displayName: cur.displayName,
        avatarUrl: cur.avatarUrl,
        authProvider: cur.authProvider,
        accessToken: cur.accessToken,
        role: cur.role,
        hasSelectedUnit: cur.hasSelectedUnit
      });
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem('hcmute_vtvl_unit_session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.unitCode && s.unitCode.toUpperCase() === cOld) {
        s.unitCode = cNew;
        if (s.proposedPositions && Array.isArray(s.proposedPositions)) {
          s.proposedPositions = s.proposedPositions.map((pos: { vtvlSuffix?: string }) => ({
            ...pos,
            vtvlSuffix: pos.vtvlSuffix?.replace(new RegExp(`^${cOld}-`, 'i'), '')
          }));
        }
        localStorage.setItem('hcmute_vtvl_unit_session', JSON.stringify(s));
        window.dispatchEvent(new CustomEvent('vtvl-unit-session-updated', { detail: s }));
      }
    }
  } catch { /* ignore */ }

  try {
    const all = getAllEmailSessions();
    const updated = all.map((s) => {
      if (s.unitCode.toUpperCase() === cOld) {
        return {
          ...s,
          unitCode: cNew,
          unitNameVi: newName,
          data: s.data ? migrateWorkbookSheets(s.data, cOld, cNew, oldName, newName) : undefined
        };
      }
      return s;
    });
    localStorage.setItem('hcmute_vtvl_email_sessions_v1', JSON.stringify(updated));
  } catch { /* ignore */ }

  window.dispatchEvent(
    new CustomEvent('vtvl-grid-sync', {
      detail: { oldCode: cOld, newCode: cNew, oldNameVi: oldName, newNameVi: newName, updatedData: updatedGridData }
    })
  );

  try {
    const channel = new BroadcastChannel('hcmute_vtvl_realtime');
    channel.postMessage({
      type: 'UNIT_SYNC',
      oldCode: cOld,
      newCode: cNew,
      oldNameVi: oldName,
      newNameVi: newName
    });
    channel.close();
  } catch {
    // ignore
  }

  const syncHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const adminToken = sessionStorage.getItem('hcmute_vtvl_admin_token');
    if (adminToken) syncHeaders.Authorization = `Bearer ${adminToken}`;
  } catch {
    // ignore
  }

  fetch('/api/admin/units/sync', {
    method: 'POST',
    headers: syncHeaders,
    credentials: 'include',
    body: JSON.stringify({ oldCode: cOld, newCode: cNew, oldNameVi: oldName, newNameVi: newName })
  }).catch(() => {});
}
