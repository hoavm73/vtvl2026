import { findHcmuteUnit } from '../../src/configs/hcmute-units';
import { getQd2266A1RowsForUnit } from '../../src/configs/hcmute-qd2266-missions';
import { buildFullPl1C1Rows, buildRecommendedC1Rows, createC2RowFromPl1 } from '../../src/configs/hcmute-pl1-builder';
import { TASK_TEMPLATES_BY_GROUP } from '../../src/configs/hcmute-quotas';
import { TCNS_REAL_TASKS } from '../../src/configs/hcmute-pl1-catalog';
import { cleanMissionSuffix } from '../../src/components/excel-grid/excel-grid-code-helpers';
import { recalculateGridFormulas } from '../../src/components/excel-grid/excel-grid-formulas';

const norm = (v) => String(v ?? '').trim();
const upper = (v) => norm(v).toUpperCase();

export const DEP_SHEET_KEYS = ['A2', 'B1', 'B2_CT', 'B2', 'C2', 'C3', 'D1', 'DU_BAO', 'D2'];

export function buildLegacyTemplateRef(rawUnitCode) {
  const rawUc = upper(rawUnitCode);
  const unitDef = findHcmuteUnit(rawUc);
  const isTcns = rawUc === 'TCNS' || unitDef.code === 'TCNS';
  const group = unitDef.group;

  const a1Rec = getQd2266A1RowsForUnit(rawUc, unitDef.nameVi);
  const a1Canon = rawUc === unitDef.code ? a1Rec : getQd2266A1RowsForUnit(unitDef.code, unitDef.nameVi);
  const c1Rec = isTcns ? buildRecommendedC1Rows('TCNS', 'phong-ban') : buildRecommendedC1Rows(rawUc, group);
  const c1Canon = rawUc === unitDef.code ? c1Rec : buildRecommendedC1Rows(unitDef.code, group);
  const c1Full = [...buildFullPl1C1Rows(rawUc), ...(rawUc === unitDef.code ? [] : buildFullPl1C1Rows(unitDef.code))];

  const taskSource = isTcns ? TCNS_REAL_TASKS : (TASK_TEMPLATES_BY_GROUP[group] || TASK_TEMPLATES_BY_GROUP['khoa-vien']);
  const counters = {};
  const a2Tpl = taskSource.map((t, idx) => {
    const rawSuffix = cleanMissionSuffix(t.missionSuffix || a1Rec[idx % Math.max(1, a1Rec.length)]?.maNhiemVu || 'NV01');
    const mCode = `${rawUc}.${rawSuffix}`;
    counters[mCode] = (counters[mCode] || 0) + 1;
    const seq = String(counters[mCode]).padStart(2, '0');
    return { maCongViec: `${mCode}.CV${seq}`, maNhiemVu: mCode, tenCongViec: t.taskName };
  });

  const a2TaskMap = new Map(a2Tpl.map((r, i) => [r.maCongViec, { ...r, idx: i }]));
  const c2Tpl = [...c1Rec, ...c1Canon, ...c1Full].map((c, i) => createC2RowFromPl1(c, i));
  const c2ByVtvl = new Map(c2Tpl.map((r) => [upper(r.maVtvl), r]));
  const tplVtvlSet = new Set([...c1Rec, ...c1Canon, ...c1Full].map((c) => upper(c.maVtvl)));
  const tplMissionSet = new Set([...a1Rec, ...a1Canon].map((a) => upper(a.maNhiemVu)));

  return { unitDef, a1Tpl: [...a1Rec, ...a1Canon], c1Tpl: [...c1Rec, ...c1Canon, ...c1Full], a2TaskMap, c2ByVtvl, tplVtvlSet, tplMissionSet };
}

export function resolveFullVtvlCode(rawVtvl, unitCode) {
  const c = upper(rawVtvl);
  if (!c) return '';
  if (c.includes('.')) return c;
  return `${upper(unitCode)}.${c.replace(/-\w+$/, '')}`;
}

export function isTemplateDependentRow(sheetKey, row, rawUnitCode, ref) {
  const id = norm(row.id);
  const maCv = upper(row.maCongViec ?? row.ma_cong_viec);
  const maVtvl = upper(row.maVtvl ?? row.ma_vtvl);
  const fullVtvl = resolveFullVtvlCode(maVtvl, rawUnitCode);

  if (sheetKey === 'A2') {
    const m = ref.a2TaskMap.get(maCv);
    return Boolean(m && id.startsWith('a2-') && !id.startsWith('a2-tkt-') && norm(row.tenCongViec) === norm(m.tenCongViec));
  }
  if (sheetKey === 'B1') {
    const nguon = norm(row.nguon);
    const isTplNguon = nguon === 'Hệ thống S-Link & Sổ theo dõi 2025–2026' || nguon === 'Hệ thống thông tin nội bộ & Sổ theo dõi 2025–2026';
    return Boolean(id.startsWith('b1-') && !id.startsWith('b1-tkt-') && ref.a2TaskMap.has(maCv) && isTplNguon);
  }
  if (sheetKey === 'B2_CT') {
    const cd = norm(row.congDoan);
    const isTplCd = cd === 'Số hóa tiếp nhận và xử lý trên nền tảng S-Link' || cd === 'Số hóa tiếp nhận và xử lý trực tuyến';
    return Boolean(id.startsWith('b2ct-') && isTplCd && norm(row.vanBan) === 'Kế hoạch CĐS HCM-UTE 2026–2030');
  }
  if (sheetKey === 'B2') {
    return Boolean(id.startsWith('b2-') && norm(row.trangThai) === 'Đã kiểm chứng' && norm(row.doiChieuTrung) === 'Đã đối chiếu' && ref.a2TaskMap.has(maCv));
  }
  if (sheetKey === 'C2') {
    const expected = ref.c2ByVtvl.get(maVtvl);
    return Boolean(expected && id.startsWith('c2-') && norm(row.tenNangLuc) === norm(expected.tenNangLuc) && norm(row.moTaChiTiet) === norm(expected.moTaChiTiet));
  }
  if (sheetKey === 'C3') {
    const gt = norm(row.nguonGiaiTrinh);
    const isTplGt = gt === 'Định biên theo PP1; QĐ 2266, PL18 và BMTCV&KNL' || gt.includes('quỹ giờ chuẩn 1.904 giờ theo C1');
    return Boolean(id.startsWith('c3-') && ref.tplVtvlSet.has(fullVtvl) && isTplGt);
  }
  if (sheetKey === 'D1') {
    return Boolean(id.startsWith('d1-') && /^Cán bộ \d+ \(.+\)$/.test(norm(row.hoTen)) && norm(row.ngaySinh) === '1985-05-15' && norm(row.ghiChu) === 'Chốt ngày 30/9/2026');
  }
  if (sheetKey === 'DU_BAO') {
    return Boolean(id.startsWith('dubao-') && norm(row.canCuNguon) === 'Chiến lược phát triển HCM-UTE 2026–2030' && norm(row.noiDungThayDoi).startsWith('Duy trì ổn định nhân lực'));
  }
  if (sheetKey === 'D2') {
    return Boolean(id.startsWith('d2-') && norm(row.nguonGiaiTrinh).startsWith('Phương án cân đối nhân sự') && norm(row.trangThai) === 'Đã hoàn thành ở đơn vị');
  }
  return false;
}

export function classifyDependentRows(params) {
  const { rawUnitCode, wbData, isTcns, isHoldUnit, hasReviewStatus, realTouched, refs, refObj } = params;
  const touchedSet = new Set(realTouched || []);
  const bySheet = {};
  const counts = { TEMPLATE_DEPENDENT: 0, UNIT_REAL: 0, REFERENCED: 0, UNKNOWN: 0 };

  for (const key of DEP_SHEET_KEYS) {
    const rows = Array.isArray(wbData[key]) ? wbData[key] : [];
    bySheet[key] = rows.map((row) => {
      const id = norm(row.id) || upper(row.maCongViec || row.maVtvl);
      const hasTkt = Boolean(row.sourceTicketId) || id.startsWith('a2-tkt-') || id.startsWith('b1-tkt-');
      const isTouched = Array.from(touchedSet).some((t) => t.startsWith(`${id}_`) || t.startsWith(`${key}:${id}:`));
      const maNv = upper(row.maNhiemVu);
      const maCv = upper(row.maCongViec);
      const fullVtvl = resolveFullVtvlCode(row.maVtvl, rawUnitCode);
      const isTplDep = isTemplateDependentRow(key, row, rawUnitCode, refObj);
      const extRef = hasTkt || (!isTplDep && Boolean(refs.missionRefs.get(maNv)?.real.length || refs.vtvlRefs.get(fullVtvl)?.real.length));

      let label;
      let reason;
      if (isTcns) {
        label = extRef ? 'REFERENCED' : 'UNIT_REAL';
        reason = extRef ? 'Gắn phiếu thực tế của Phòng TCNS' : 'Dữ liệu thực tế thuộc Phòng TCNS';
      } else if (extRef) {
        label = 'REFERENCED';
        reason = hasTkt ? `Gắn phiếu công việc (${row.sourceTicketId || id})` : 'Có liên kết phiếu/phân công nghiệp vụ';
      } else if (isHoldUnit) {
        label = 'UNKNOWN';
        reason = rawUnitCode === 'GDQPAN' ? 'Tạm giữ toàn bộ GDQPAN chờ đối chứng CSDL & audit log' : 'Chỉnh sửa trên mã alias cũ FIT chưa xác minh nguồn gốc';
      } else if (isTouched || hasReviewStatus) {
        label = 'UNIT_REAL';
        reason = hasReviewStatus ? 'Thuộc hồ sơ đã gửi/thẩm định' : 'Có chỉnh sửa ô trực tiếp bởi đơn vị';
      } else if (isTplDep) {
        label = 'TEMPLATE_DEPENDENT';
        reason = `Sinh tự động từ bộ mẫu A1/C1 (${maCv || fullVtvl || id})`;
      } else {
        label = 'UNKNOWN';
        reason = 'Không khớp hoàn toàn mẫu gốc và chưa đủ chứng cứ nguồn gốc';
      }
      counts[label]++;
      return { id, sheet: key, maNhiemVu: maNv, maVtvl: fullVtvl, maCongViec: maCv, label, reason };
    });
  }
  return { bySheet, counts };
}

export function simulateRelationalCleanupAndValidate(params) {
  const { rawUnitCode, unitNameVi, wbData, a1Classified, c1Classified, depBySheet } = params;
  const keepA1Ids = new Set(a1Classified.filter((x) => x.label !== 'SCHOOL_TEMPLATE').map((x) => x.id));
  const keepC1Ids = new Set(c1Classified.filter((x) => x.label !== 'SCHOOL_TEMPLATE').map((x) => x.id));
  const keepDep = {};
  const neededA1Codes = new Set();
  const neededC1Codes = new Set();

  for (const key of DEP_SHEET_KEYS) {
    const items = depBySheet[key] || [];
    const keptIds = new Set(items.filter((x) => x.label !== 'TEMPLATE_DEPENDENT').map((x) => x.id));
    keepDep[key] = keptIds;
    for (const item of items) {
      if (!keptIds.has(item.id)) continue;
      if (item.maNhiemVu) neededA1Codes.add(item.maNhiemVu);
      if (item.maVtvl) neededC1Codes.add(item.maVtvl);
    }
  }

  for (const row of a1Classified) {
    if (row.label === 'SCHOOL_TEMPLATE' && neededA1Codes.has(row.code)) {
      row.label = 'REFERENCED';
      row.reason = 'Giữ lại theo thứ tự quan hệ vì A2 còn giữ đang tham chiếu';
      keepA1Ids.add(row.id);
    }
  }
  for (const row of c1Classified) {
    if (row.label === 'SCHOOL_TEMPLATE' && neededC1Codes.has(row.code)) {
      row.label = 'REFERENCED';
      row.reason = 'Giữ lại theo thứ tự quan hệ vì A2/B1/C2/D1 còn giữ đang tham chiếu';
      keepC1Ids.add(row.id);
    }
  }

  const nextData = { ...wbData };
  nextData.A1 = (wbData.A1 || []).filter((r) => keepA1Ids.has(norm(r.id) || upper(r.maNhiemVu)));
  nextData.C1 = (wbData.C1 || []).filter((r) => keepC1Ids.has(norm(r.id) || upper(r.maVtvl)));
  for (const key of DEP_SHEET_KEYS) {
    nextData[key] = (wbData[key] || []).filter((r) => keepDep[key].has(norm(r.id) || upper(r.maCongViec || r.maVtvl)));
  }

  const recalculated = recalculateGridFormulas(nextData, rawUnitCode, unitNameVi);
  const kRows = recalculated.K || [];
  const kErrors = {};
  for (const k of kRows) kErrors[`K${k.stt}`] = Number(k.soDongLoi || 0);
  return { kErrors, orphanRisks: ['K1', 'K2', 'K5', 'K6'].filter((k) => (kErrors[k] || 0) > 0) };
}
