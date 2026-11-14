import { findHcmuteUnit } from '@/configs/hcmute-units';
import { GenericGridRow, ExcelSheetKey } from '@/components/excel-grid/excel-grid-types';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';

export interface OperatorSession {
  email: string;
  unitCode: string;
  unitNameVi: string;
  title: string;
  startedAt: string;
  lastActiveAt: string;
  displayName?: string;
  avatarUrl?: string;
  authProvider?: 'google' | 'email';
  accessToken?: string;
  role?: 'admin' | 'unit_leader' | 'staff';
  hasSelectedUnit?: boolean;
}

export interface EmailSessionRecord {
  email: string;
  unitCode: string;
  unitNameVi: string;
  title: string;
  lastSavedAt: string;
  touchedCells: string[];
  totalRows?: number;
  sheetSummaries?: Partial<Record<ExcelSheetKey, number>>;
  data?: Record<ExcelSheetKey, GenericGridRow[]>;
}

const CURRENT_OPERATOR_KEY = 'hcmute_vtvl_current_operator_v1';
const EMAIL_RECORDS_KEY = 'hcmute_vtvl_email_sessions_v1';

export function normalizeEmail(raw: string): string {
  let e = (raw || '').trim().toLowerCase();
  if (!e) return '';
  if (!e.includes('@')) return `${e}@hcmute.edu.vn`;
  if (e.endsWith('@hcmute')) return `${e}.edu.vn`;
  return e;
}

export function getCurrentOperatorSession(): OperatorSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_OPERATOR_KEY);
    if (!raw) {
      const p = new URLSearchParams(window.location.search);
      if (p.has('preview') || p.has('operator')) {
        const u = findHcmuteUnit(p.get('unit') || 'CNTT');
        const now = new Date().toISOString();
        return { email: normalizeEmail(p.get('email') || 'dfdfff@hcmute.edu.vn'), unitCode: u.code, unitNameVi: u.nameVi, title: 'Thư ký khoa / Trợ lý đào tạo', startedAt: now, lastActiveAt: now };
      }
      return null;
    }
    const session: OperatorSession = JSON.parse(raw);
    if (session) {
      session.email = normalizeEmail(session.email);
    }
    return session;
  } catch {
    return null;
  }
}

export function registerOperatorSession(
  email: string,
  unitCode: string,
  title: string
): EmailSessionRecord {
  const normEmail = normalizeEmail(email);
  const unit = findHcmuteUnit(unitCode);
  const now = new Date().toLocaleString('vi-VN');
  const all = getAllEmailSessions();
  const existingIdx = all.findIndex((s) => s.email === normEmail);

  let record: EmailSessionRecord;
  if (existingIdx >= 0) {
    record = {
      ...all[existingIdx], unitCode, unitNameVi: unit.nameVi,
      title: title.trim() || all[existingIdx].title,
      lastSavedAt: all[existingIdx].lastSavedAt || `Khởi tạo ${now}`
    };
    all[existingIdx] = record;
  } else {
    record = {
      email: normEmail, unitCode, unitNameVi: unit.nameVi,
      title: title.trim() || 'Chuyên viên', lastSavedAt: `Khởi tạo ${now}`, touchedCells: []
    };
    all.unshift(record);
  }

  if (typeof window !== 'undefined') {
    try {
      const trimmed = all.slice(0, 30);
      localStorage.setItem(EMAIL_RECORDS_KEY, JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('vtvl-email-sessions-updated', { detail: trimmed }));
    } catch { /* ignore */ }
  }
  return record;
}

export function saveCurrentOperatorSession(
  email: string,
  unitCode: string,
  title: string,
  meta?: {
    displayName?: string;
    avatarUrl?: string;
    authProvider?: 'google' | 'email';
    accessToken?: string;
    role?: 'admin' | 'unit_leader' | 'staff';
    hasSelectedUnit?: boolean;
  }
): OperatorSession {
  const normEmail = normalizeEmail(email);
  const unit = findHcmuteUnit(unitCode);
  const now = new Date().toLocaleString('vi-VN');
  const existing = getCurrentOperatorSession();
  const session: OperatorSession = {
    email: normEmail,
    unitCode: unit.code,
    unitNameVi: unit.nameVi,
    title: title.trim(),
    startedAt: now,
    lastActiveAt: now,
    displayName: meta?.displayName ?? (existing?.email === normEmail ? existing.displayName : undefined),
    avatarUrl: meta?.avatarUrl ?? (existing?.email === normEmail ? existing.avatarUrl : undefined),
    authProvider: meta?.authProvider ?? (existing?.email === normEmail ? existing.authProvider : 'email'),
    accessToken: meta?.accessToken ?? (existing?.email === normEmail ? existing.accessToken : undefined),
    role: meta?.role ?? (existing?.email === normEmail ? existing.role : undefined),
    hasSelectedUnit: meta?.hasSelectedUnit ?? (existing?.email === normEmail ? existing.hasSelectedUnit : undefined)
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CURRENT_OPERATOR_KEY, JSON.stringify(session));
      window.dispatchEvent(new CustomEvent('vtvl-operator-changed', { detail: session }));
    } catch { /* ignore */ }
    registerOperatorSession(normEmail, unit.code, title);
  }
  return session;
}

export function updateOperatorSessionUnit(unitCode: string): OperatorSession | null {
  const cur = getCurrentOperatorSession();
  if (!cur) return null;
  const unit = findHcmuteUnit(unitCode);
  const updated: OperatorSession = {
    ...cur,
    unitCode: unit.code,
    unitNameVi: unit.nameVi,
    hasSelectedUnit: true,
    lastActiveAt: new Date().toLocaleString('vi-VN')
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CURRENT_OPERATOR_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('vtvl-operator-changed', { detail: updated }));
    } catch { /* ignore */ }
    registerOperatorSession(updated.email, unit.code, updated.title);
  }
  return updated;
}

export function clearCurrentOperatorSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CURRENT_OPERATOR_KEY);
    window.dispatchEvent(new CustomEvent('vtvl-operator-changed', { detail: null }));
  }
}

export function getAllEmailSessions(): EmailSessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EMAIL_RECORDS_KEY);
    let list: EmailSessionRecord[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    list = list.map((item) => ({
      ...item,
      email: normalizeEmail(item.email)
    }));

    // Đồng bộ phiên hiện tại nếu chưa nằm trong danh sách
    const curRaw = localStorage.getItem(CURRENT_OPERATOR_KEY);
    if (curRaw) {
      try {
        const cur: OperatorSession = JSON.parse(curRaw);
        const curEmail = normalizeEmail(cur.email);
        if (curEmail && !list.some((s) => s.email === curEmail)) {
          const unit = findHcmuteUnit(cur.unitCode);
          list.unshift({
            email: curEmail, unitCode: cur.unitCode, unitNameVi: unit.nameVi, title: cur.title,
            lastSavedAt: cur.lastActiveAt || cur.startedAt || new Date().toLocaleString('vi-VN'), touchedCells: []
          });
          localStorage.setItem(EMAIL_RECORDS_KEY, JSON.stringify(list));
        }
      } catch { /* ignore */ }
    }
    return list;
  } catch {
    return [];
  }
}

export function loadSessionData(
  email: string,
  unitCode: string
): Record<ExcelSheetKey, GenericGridRow[]> {
  if (typeof window === 'undefined') return buildDefaultGridWorkbook(unitCode);
  const normEmail = normalizeEmail(email);
  try {
    const raw = localStorage.getItem(`hcmute_vtvl_session_data_${normEmail}`);
    if (raw) return JSON.parse(raw);
  } catch { /* fallback */ }
  try {
    const rawUnit = localStorage.getItem(`hcmute_vtvl_grid_${unitCode}`);
    if (rawUnit) return JSON.parse(rawUnit);
  } catch { /* fallback */ }
  return buildDefaultGridWorkbook(unitCode);
}

export function getSessionByEmail(email: string, withData = false): EmailSessionRecord | null {
  const normEmail = normalizeEmail(email);
  const all = getAllEmailSessions();
  const found = all.find((s) => s.email === normEmail || s.email.split('@')[0] === normEmail.split('@')[0]);
  if (!found) return null;
  return withData ? { ...found, data: loadSessionData(found.email, found.unitCode) } : found;
}

export function saveEmailSessionData(
  email: string,
  unitCode: string,
  title: string,
  data: Record<ExcelSheetKey, GenericGridRow[]>,
  touchedCells: string[]
): void {
  if (typeof window === 'undefined') return;
  const normEmail = normalizeEmail(email);
  const unit = findHcmuteUnit(unitCode);
  const now = new Date().toLocaleString('vi-VN');

  const sheetSummaries: Partial<Record<ExcelSheetKey, number>> = {};
  let totalRows = 0;
  if (data && typeof data === 'object') {
    for (const [key, rows] of Object.entries(data)) {
      const len = Array.isArray(rows) ? rows.length : 0;
      sheetSummaries[key as ExcelSheetKey] = len;
      totalRows += len;
    }
  }

  const newRecord: EmailSessionRecord = {
    email: normEmail, unitCode, unitNameVi: unit.nameVi,
    title: title.trim() || 'Chuyên viên', lastSavedAt: now,
    touchedCells: touchedCells || [], totalRows, sheetSummaries
  };

  try {
    const all = getAllEmailSessions().filter((s) => s.email !== normEmail);
    all.unshift(newRecord);
    const trimmed = all.slice(0, 30);
    localStorage.setItem(EMAIL_RECORDS_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('vtvl-email-sessions-updated', { detail: trimmed }));
  } catch { /* ignore */ }

  try {
    localStorage.setItem(`hcmute_vtvl_session_data_${normEmail}`, JSON.stringify(data));
  } catch { /* ignore */ }
  try {
    localStorage.setItem(`hcmute_vtvl_grid_${unitCode}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function deleteEmailSession(email: string): boolean {
  if (typeof window === 'undefined') return false;
  const normEmail = normalizeEmail(email);
  try {
    const all = getAllEmailSessions();
    const filtered = all.filter((s) => s.email !== normEmail);
    if (filtered.length === all.length) return false;
    localStorage.setItem(EMAIL_RECORDS_KEY, JSON.stringify(filtered));
    try { localStorage.removeItem(`hcmute_vtvl_session_data_${normEmail}`); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('vtvl-email-sessions-updated', { detail: filtered }));
    return true;
  } catch {
    return false;
  }
}

export function clearAllEmailSessions(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(EMAIL_RECORDS_KEY);
    window.dispatchEvent(new CustomEvent('vtvl-email-sessions-updated', { detail: [] }));
  } catch { /* ignore */ }
}
