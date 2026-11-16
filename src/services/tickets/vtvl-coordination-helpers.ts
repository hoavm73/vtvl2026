import { findHcmuteUnit, QD2266_UNIT_NAMES } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import {
  CoordinatedVtvlEntry,
  TicketFieldDiff,
  WorkSurveySnapshot
} from '@/types/staff-ticket';

export const UNASSIGNED_VTVL_MESSAGE = 'Chưa có người được phân công mã VTVL phối hợp này';
export const PROPOSED_TAB_EMPTY_MESSAGE = 'Chưa có nhiệm vụ được đề xuất phối hợp với vị trí việc làm của bạn.';
export const UNASSIGNED_VIEWER_HINT = 'Tài khoản của bạn hiện chưa được phân công mã VTVL nào trên hệ thống.';

export function normalizeCode(val: unknown): string {
  return String(val ?? '').trim().toUpperCase();
}

export function resolveUnitCodeSafe(code: string): string {
  const clean = normalizeCode(code);
  if (!clean) return '';
  try {
    return findHcmuteUnit(clean).code;
  } catch {
    return clean;
  }
}

export function resolveUnitNameSafe(unitCode: string): string {
  const clean = resolveUnitCodeSafe(unitCode);
  if (!clean) return '';
  try {
    return findHcmuteUnit(clean).nameVi;
  } catch {
    return QD2266_UNIT_NAMES[clean] || clean;
  }
}

export function resolveCatalogVtvlName(maVtvl: string): string {
  const upper = normalizeCode(maVtvl);
  if (!upper) return '';
  const found = ND232_2026_VTVL_CATALOG.find(
    (item) =>
      item.maDanhMucNd232.toUpperCase() === upper ||
      item.linkedCodeHint.toUpperCase() === upper ||
      upper.endsWith(`-${item.linkedCodeHint.toUpperCase()}`) ||
      upper.endsWith(`.${item.linkedCodeHint.toUpperCase()}`)
  );
  return found?.positionName || '';
}

export function makeCompositeVtvlKey(unitCode: string, maVtvl: string): string {
  const unit = resolveUnitCodeSafe(unitCode);
  const vtvl = normalizeCode(maVtvl);
  if (!unit || !vtvl) return '';
  return `${unit}::${vtvl}`;
}

export function makeStableCoordinatedVtvlId(targetUnitCode: string, maVtvl: string): string {
  return `cvtvl-${resolveUnitCodeSafe(targetUnitCode)}-${normalizeCode(maVtvl)}`;
}

export function normalizeCoordinatedVtvls(
  entries?: Partial<CoordinatedVtvlEntry>[],
  fallbackHostUnit?: string
): CoordinatedVtvlEntry[] {
  if (!Array.isArray(entries)) return [];
  const map = new Map<string, CoordinatedVtvlEntry>();
  for (const raw of entries) {
    if (!raw) continue;
    const maVtvl = String(raw.maVtvl || '').trim();
    if (!maVtvl) continue;
    const targetUnitCode = resolveUnitCodeSafe(String(raw.targetUnitCode || fallbackHostUnit || ''));
    const key = makeCompositeVtvlKey(targetUnitCode, maVtvl);
    if (!key) continue;
    const cleanNote = String(raw.note || '').trim();
    const tenVtvl = String(raw.tenVtvl || '').trim() || resolveCatalogVtvlName(maVtvl) || undefined;
    map.set(key, {
      id: makeStableCoordinatedVtvlId(targetUnitCode, maVtvl),
      targetUnitCode,
      targetUnitName: String(raw.targetUnitName || '').trim() || resolveUnitNameSafe(targetUnitCode),
      maVtvl,
      tenVtvl,
      note: cleanNote || undefined
    });
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function extractEffectiveCoordinatedVtvls(
  snapshot: Partial<WorkSurveySnapshot>,
  fallbackHostUnit?: string
): CoordinatedVtvlEntry[] {
  const hostUnit = resolveUnitCodeSafe(String(snapshot.unitCode || fallbackHostUnit || ''));
  const map = new Map<string, CoordinatedVtvlEntry>();

  const primaryCode = String(snapshot.maVtvlPhoiHop || '').trim();
  if (primaryCode && hostUnit) {
    const key = makeCompositeVtvlKey(hostUnit, primaryCode);
    const note = String(snapshot.coordinationNote || '').trim() || undefined;
    map.set(key, {
      id: makeStableCoordinatedVtvlId(hostUnit, primaryCode),
      targetUnitCode: hostUnit,
      targetUnitName: snapshot.unitNameSnapshot || resolveUnitNameSafe(hostUnit),
      maVtvl: primaryCode,
      tenVtvl: snapshot.tenVtvlPhoiHopSnapshot || resolveCatalogVtvlName(primaryCode) || undefined,
      note
    });
  }

  for (const item of normalizeCoordinatedVtvls(snapshot.coordinatedVtvls, hostUnit)) {
    const key = makeCompositeVtvlKey(item.targetUnitCode, item.maVtvl);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        tenVtvl: existing.tenVtvl || item.tenVtvl,
        note: item.note || existing.note
      });
    } else {
      map.set(key, item);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function formatEntryForDiff(e: CoordinatedVtvlEntry): string {
  const vtvlLabel = e.tenVtvl ? `[${e.maVtvl}] ${e.tenVtvl}` : e.maVtvl;
  const unitLabel = `[${e.targetUnitCode}] ${e.targetUnitName || e.targetUnitCode}`;
  return `${unitLabel} · ${vtvlLabel}${e.note ? `\nNội dung phối hợp: ${e.note}` : ''}`;
}

export function appendCoordinatedVtvlDiffs(
  diffs: TicketFieldDiff[],
  prevSnapshot: Partial<WorkSurveySnapshot>,
  currSnapshot: Partial<WorkSurveySnapshot>
): void {
  const prevNote = String(prevSnapshot.coordinationNote || '').trim();
  const currNote = String(currSnapshot.coordinationNote || '').trim();
  if (prevNote !== currNote) {
    diffs.push({
      fieldKey: 'coordinationNote',
      fieldLabel: 'Nội dung phối hợp VTVL',
      changeType: !prevNote ? 'added' : !currNote ? 'deleted' : 'modified',
      previousValue: prevNote || '—',
      currentValue: currNote || 'Đã xóa nội dung'
    });
  }

  const prevList = normalizeCoordinatedVtvls(prevSnapshot.coordinatedVtvls, prevSnapshot.unitCode);
  const currList = normalizeCoordinatedVtvls(currSnapshot.coordinatedVtvls, currSnapshot.unitCode);
  const prevMap = new Map(prevList.map((e) => [e.id, e]));
  const currMap = new Map(currList.map((e) => [e.id, e]));
  const allIds = Array.from(new Set([...prevMap.keys(), ...currMap.keys()]));

  for (const id of allIds) {
    const p = prevMap.get(id);
    const c = currMap.get(id);
    const label = `VTVL phối hợp bổ sung (${id.replace(/^cvtvl-/, '')})`;
    if (!p && c) {
      diffs.push({ fieldKey: `coordVtvl:${id}`, fieldLabel: label, changeType: 'added', previousValue: '—', currentValue: formatEntryForDiff(c) });
    } else if (p && !c) {
      diffs.push({ fieldKey: `coordVtvl:${id}`, fieldLabel: label, changeType: 'deleted', previousValue: formatEntryForDiff(p), currentValue: 'Đã xóa nội dung' });
    } else if (p && c && formatEntryForDiff(p) !== formatEntryForDiff(c)) {
      diffs.push({ fieldKey: `coordVtvl:${id}`, fieldLabel: label, changeType: 'modified', previousValue: formatEntryForDiff(p), currentValue: formatEntryForDiff(c) });
    }
  }
}
