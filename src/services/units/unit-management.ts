import { HcmuteUnit } from '@/types/vtvl';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { syncUnitCodeAndNameInBrowser } from './unit-synchronizer';

export const CUSTOM_UNITS_STORAGE_KEY = 'hcmute_vtvl_custom_units_v1';
export const UNITS_UPDATED_EVENT = 'vtvl-units-updated';

/**
 * Lấy danh sách toàn bộ đơn vị hiện hành trong hệ thống.
 * Ưu tiên danh sách đã chỉnh sửa trong localStorage, fallback về 51 đơn vị chuẩn HCM-UTE.
 */
export function getAdminUnits(): HcmuteUnit[] {
  if (typeof window === 'undefined') return [...HCMUTE_UNITS];
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return [...HCMUTE_UNITS];
    const parsed: HcmuteUnit[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [...HCMUTE_UNITS];
  } catch {
    return [...HCMUTE_UNITS];
  }
}

/**
 * Lưu hoặc cập nhật một đơn vị vào danh mục đồng bộ.
 * Phát sự kiện để tất cả bảng biểu cập nhật thời gian thực.
 */
export function saveAdminUnit(unit: HcmuteUnit, originalCode?: string): void {
  if (typeof window === 'undefined') return;
  const currentUnits = getAdminUnits();
  const normCode = unit.code.trim().toUpperCase();
  const cleanUnit: HcmuteUnit = {
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
  const existingIndex = currentUnits.findIndex((u) => u.code.toUpperCase() === lookupCode);
  const oldUnit = existingIndex >= 0 ? currentUnits[existingIndex] : null;

  let updatedList: HcmuteUnit[];
  if (existingIndex >= 0) {
    updatedList = [...currentUnits];
    updatedList[existingIndex] = cleanUnit;
  } else {
    updatedList = [cleanUnit, ...currentUnits];
  }

  try {
    localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(updatedList));
    window.dispatchEvent(new CustomEvent(UNITS_UPDATED_EVENT, { detail: updatedList }));
    if (oldUnit && (oldUnit.code.toUpperCase() !== normCode || oldUnit.nameVi !== cleanUnit.nameVi)) {
      syncUnitCodeAndNameInBrowser(oldUnit.code, normCode, oldUnit.nameVi, cleanUnit.nameVi);
    }
  } catch {
    /* ignore localStorage errors */
  }
}

/**
 * Xóa một đơn vị khỏi danh mục.
 */
export function deleteAdminUnit(code: string): boolean {
  if (typeof window === 'undefined') return false;
  const currentUnits = getAdminUnits();
  const normCode = code.trim().toUpperCase();
  const filtered = currentUnits.filter((u) => u.code.toUpperCase() !== normCode);

  if (filtered.length === currentUnits.length) {
    return false; // Không tìm thấy đơn vị để xóa
  }

  try {
    localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent(UNITS_UPDATED_EVENT, { detail: filtered }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Khôi phục danh mục về 51 đơn vị chuẩn gốc của HCM-UTE.
 */
export function resetAdminUnitsToDefault(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CUSTOM_UNITS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(UNITS_UPDATED_EVENT, { detail: [...HCMUTE_UNITS] }));
  } catch {
    /* ignore localStorage errors */
  }
}

/**
 * Đăng ký lắng nghe sự kiện đồng bộ danh mục đơn vị thời gian thực.
 */
export function subscribeToUnitsChange(callback: (units: HcmuteUnit[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvt = e as CustomEvent<HcmuteUnit[]>;
    if (customEvt.detail) {
      callback(customEvt.detail);
    } else {
      callback(getAdminUnits());
    }
  };

  window.addEventListener(UNITS_UPDATED_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === CUSTOM_UNITS_STORAGE_KEY) {
      callback(getAdminUnits());
    }
  });

  return () => {
    window.removeEventListener(UNITS_UPDATED_EVENT, handler);
  };
}

