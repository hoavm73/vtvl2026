import { HCMUTE_UNITS, UNIT_CODE_ALIASES, findHcmuteUnit } from '../../src/configs/hcmute-units';
import { getQd2266A1RowsForUnit } from '../../src/configs/hcmute-qd2266-missions';
import { buildFullPl1C1Rows, buildRecommendedC1Rows } from '../../src/configs/hcmute-pl1-builder';
import { buildLegacyTemplateRef, classifyDependentRows, simulateRelationalCleanupAndValidate } from './a1-c1-template-reference.mjs';

export const SEED_FAKE_TOUCHED = new Set(['A1-r0-c2', 'A1-r1-c3', 'C1-r0-c1', 'C1-r1-c2']);
export const REVIEW_ACTION_SET = new Set([
  'cho_tham_dinh', 'dang_tham_dinh', 'can_bo_sung', 'da_gui_lai', 'dat_yeu_cau', 'da_khoa'
]);
const norm = (v) => String(v ?? '').trim();
const upper = (v) => norm(v).toUpperCase();

export function canonicalizeUnit(rawCode) {
  const u = upper(rawCode);
  return UNIT_CODE_ALIASES[u] || u;
}

export function isExactTemplateA1Row(row, tplRows) {
  const ma = upper(row.maNhiemVu ?? row.ma_nhiem_vu);
  const ten = norm(row.tenNhiemVu ?? row.ten_nhiem_vu);
  const canCu = norm(row.canCu ?? row.can_cu_phap_ly);
  const ky = norm(row.ky ?? row.ky_thong_ke);
  const tt = norm(row.trangThai ?? row.trang_thai_nv);
  const nguon = norm(row.nguon ?? row.nguon_nhiem_vu);
  if (!ma || !ten) return false;
  return tplRows.some((t) =>
    upper(t.maNhiemVu) === ma && norm(t.tenNhiemVu) === ten && norm(t.canCu) === canCu &&
    norm(t.ky) === ky && norm(t.trangThai) === tt && norm(t.nguon) === nguon
  );
}

export function isExactTemplateC1Row(row, tplRows) {
  const ma = upper(row.maVtvl ?? row.ma_vtvl);
  const ten = norm(row.tenVtvl ?? row.ten_vtvl_cu_the_don_vi);
  const loai = norm(row.loaiNhanLuc ?? row.loai_nhan_luc);
  const gioPp2 = Number(row.gioChuanPp2 ?? row.gio_chuan_pp2 ?? 0);
  const cheDo = norm(row.cheDoLamViec ?? row.che_do_lam_viec);
  const hasQd = 'quyetDinh' in row && row.quyetDinh !== undefined;
  const hasTt = 'trangThai' in row && row.trangThai !== undefined;
  if (!ma || !ten || Number(row.gioRieng ?? 0) !== 0) return false;
  return tplRows.some((t) =>
    upper(t.maVtvl) === ma && norm(t.tenVtvl) === ten && norm(t.loaiNhanLuc) === loai &&
    Number(t.gioChuanPp2) === gioPp2 && norm(t.cheDoLamViec) === cheDo &&
    (!hasQd || norm(t.quyetDinh) === norm(row.quyetDinh)) && (!hasTt || norm(t.trangThai) === norm(row.trangThai))
  );
}

function isTestLikeTicket(t) {
  const email = norm(t.ownerEmail ?? t.owner_email ?? t.submittedBy ?? '').toLowerCase();
  const name = norm(t.ownerName ?? t.owner_name ?? '').toLowerCase();
  const title = norm(t.tenCongViec ?? t.ten_cong_viec ?? '').toLowerCase();
  const id = norm(t.id ?? t.surveyId ?? t.sourceTicketId ?? '').toLowerCase();
  return Boolean(t.isTestData ?? t.is_test_data) || title === 'test' ||
    id.includes('test-probe') || id.includes('bench') || email.startsWith('qa.') || email.includes('probe@') || name.startsWith('qa.');
}

function addRef(map, code, isTest, reason) {
  const k = upper(code);
  if (!k) return;
  if (!map.has(k)) map.set(k, { real: [], test: [] });
  const list = isTest ? map.get(k).test : map.get(k).real;
  if (!list.includes(reason)) list.push(reason);
}

export function buildExternalRefIndex(ctx) {
  const missionRefs = new Map();
  const vtvlRefs = new Map();
  const units = new Set([upper(ctx.rawUnitCode), upper(ctx.canonicalUnitCode)]);

  for (const r of ctx.wbData?.A2 || []) {
    const srcId = norm(r.sourceTicketId);
    if (!srcId && !norm(r.id).startsWith('a2-tkt-')) continue;
    const label = `A2 ticket ${srcId || r.id} ("${norm(r.tenCongViec)}")`;
    const isTest = norm(r.tenCongViec).toLowerCase() === 'test';
    addRef(missionRefs, r.maNhiemVu, isTest, label);
    addRef(vtvlRefs, r.maVtvl, isTest, label);
    addRef(vtvlRefs, r.maVtvlPhoiHop, isTest, `${label} [phối hợp]`);
  }
  for (const t of ctx.tickets || []) {
    if (!units.has(upper(t.unitCode ?? t.unit_code))) continue;
    const isTest = isTestLikeTicket(t);
    const label = `staff_work_tickets ${t.id} (${norm(t.status)})`;
    addRef(missionRefs, t.maNhiemVu ?? t.ma_nhiem_vu, isTest, label);
    addRef(vtvlRefs, t.maVtvl ?? t.ma_vtvl, isTest, label);
    addRef(vtvlRefs, t.maVtvlPhoiHop ?? t.ma_vtvl_phoi_hop, isTest, `${label} [phối hợp]`);
  }
  for (const [sid, list] of Object.entries(ctx.surveyVersions || {})) {
    const snap = Array.isArray(list) ? list[list.length - 1]?.snapshot : undefined;
    if (!snap || !units.has(upper(snap.unitCode))) continue;
    const label = `work_survey_versions ${sid}${(ctx.mergeLinks || {})[sid]?.length ? '+merge' : ''}`;
    const isTest = isTestLikeTicket({ ...snap, id: sid });
    addRef(missionRefs, snap.maNhiemVu, isTest, label);
    addRef(vtvlRefs, snap.maVtvl, isTest, label);
    addRef(vtvlRefs, snap.maVtvlPhoiHop, isTest, label);
  }
  for (const rel of ctx.workRelationships || []) {
    const sid = norm(rel.sourceSurveyId ?? rel.source_survey_id);
    if (sid.includes('bench') || norm(rel.id).includes('bench')) continue;
    const hU = upper(rel.hostUnitCode ?? rel.host_unit_code), tU = upper(rel.targetUnitCode ?? rel.target_unit_code);
    const isQATest = sid.includes('SDH') || sid.includes('CK');
    if (units.has(hU)) {
      addRef(missionRefs, rel.sourceMissionCode ?? rel.source_mission_code, isQATest, `work_relationships ${rel.id}`);
      addRef(vtvlRefs, rel.hostVtvlCode ?? rel.host_vtvl_code, isQATest, `work_relationships ${rel.id}`);
    }
    if (units.has(tU)) addRef(vtvlRefs, rel.targetVtvlCode ?? rel.target_vtvl_code, isQATest, `work_relationships ${rel.id}`);
  }
  for (const a of ctx.vtvlAssignments || []) {
    if (units.has(upper(a.unit_code ?? a.unitCode))) addRef(vtvlRefs, a.ma_vtvl ?? a.maVtvl, false, `user_vtvl_assignments (${norm(a.user_email ?? a.userEmail)})`);
  }
  for (const n of ctx.sldvNgach || []) {
    if (units.has(upper(n.ma_don_vi))) addRef(vtvlRefs, n.ma_vtvl_xep_vao, false, `sldv_phan_bo_ngach (${n.id})`);
  }
  return { missionRefs, vtvlRefs };
}

export function classifyWorkbook(params) {
  const rawUc = upper(params.rawUnitCode);
  const canonUc = canonicalizeUnit(rawUc);
  const unitDef = findHcmuteUnit(canonUc);
  const isTcns = rawUc === 'TCNS' || canonUc === 'TCNS';
  const refObj = buildLegacyTemplateRef(rawUc);
  const allTplA1 = [...refObj.a1Tpl, ...(rawUc === canonUc ? [] : getQd2266A1RowsForUnit(canonUc, unitDef.nameVi))];
  const allTplC1 = [...refObj.c1Tpl, ...(rawUc === canonUc ? [] : [...buildRecommendedC1Rows(canonUc, unitDef.group), ...buildFullPl1C1Rows(canonUc)])];

  const a1Rows = Array.isArray(params.wbData.A1) ? params.wbData.A1 : [];
  const c1Rows = Array.isArray(params.wbData.C1) ? params.wbData.C1 : [];
  const realTouched = (params.touchedCells || []).filter((c) => !SEED_FAKE_TOUCHED.has(c));
  const unitLogs = (params.auditLogs || []).filter((l) =>
    upper(l.unitId ?? l.unit_id) === rawUc || upper(l.unitId ?? l.unit_id) === canonUc || norm(l.workbookId ?? l.workbook_id) === params.workbookId
  );
  const hasReviewStatus = (norm(params.status) !== 'draft' && norm(params.status) !== 'not_persisted') ||
    unitLogs.some((l) => REVIEW_ACTION_SET.has(norm(l.action)) || REVIEW_ACTION_SET.has(norm(l.newValues?.status)));
  const activeActors = (params.participants || [])
    .map((p) => norm(p.emailNormalized ?? p.email).toLowerCase())
    .filter((e) => params.accountMap.has(e) && e !== 'tcns@hcmute.edu.vn');
  const refs = buildExternalRefIndex({ rawUnitCode: rawUc, canonicalUnitCode: canonUc, ...params });

  // Khóa bảo vệ GDQPAN (cùng FIT chưa rõ nguồn gốc) theo nguyên tắc 3 cho đến khi đối chứng CSDL + audit_logs
  const isHoldUnit = rawUc === 'GDQPAN' || rawUc === 'FIT';
  const a1Pruned = a1Rows.length > 0 && a1Rows.length < getQd2266A1RowsForUnit(rawUc, unitDef.nameVi).length;
  const c1Pruned = c1Rows.length > 0 && c1Rows.length < buildRecommendedC1Rows(rawUc, unitDef.group).length;

  const classifyCore = (row, kind) => {
    const code = upper(kind === 'A1' ? (row.maNhiemVu ?? row.ma_nhiem_vu) : (row.maVtvl ?? row.ma_vtvl));
    const id = norm(row.id) || code;
    if (isTcns) return { id, code, label: 'TCNS_REAL', reason: 'Thuộc Phòng Tổ chức – Nhân sự (TCNS)' };

    const exactTpl = kind === 'A1' ? isExactTemplateA1Row(row, allTplA1) : isExactTemplateC1Row(row, allTplC1);
    const refInfo = (kind === 'A1' ? refs.missionRefs : refs.vtvlRefs).get(code);
    const touchedSheet = realTouched.some((c) => c.startsWith(kind.toLowerCase()) || c.startsWith(kind) || c.startsWith(`${id}_`));

    if (!exactTpl) {
      if (rawUc === 'FIT') return { id, code, label: 'UNKNOWN', reason: `Dữ liệu chỉnh tay trên mã cũ FIT (${params.workbookId})` };
      if (hasReviewStatus || touchedSheet || activeActors.length > 0 || refInfo?.real.length) {
        return { id, code, label: 'UNIT_REAL', reason: 'Nội dung khác mẫu QĐ 2266/PL1 và có dấu vết chỉnh sửa của đơn vị' };
      }
      return { id, code, label: 'UNKNOWN', reason: 'Nội dung khác mẫu nhưng thiếu chứng cứ người nhập' };
    }
    if (isHoldUnit) {
      return { id, code, label: 'UNKNOWN', reason: rawUc === 'GDQPAN' ? 'Tạm giữ GDQPAN chờ đối chứng CSDL & audit_logs' : 'Tạm giữ FIT chờ xác nhận' };
    }
    if (hasReviewStatus) return { id, code, label: 'REFERENCED', reason: `Hồ sơ trạng thái [${params.status}], bảo vệ theo quy trình thẩm định` };
    if (touchedSheet) return { id, code, label: 'UNKNOWN', reason: `Khớp mẫu nhưng có touchedCells trên ${kind}` };
    if (refInfo?.real.length) return { id, code, label: 'REFERENCED', reason: `Gắn dữ liệu thực tế: ${refInfo.real[0]}` };
    if (refInfo?.test.length) return { id, code, label: 'UNKNOWN', reason: `Gắn phiếu QA/test chưa xác nhận: ${refInfo.test[0]}` };
    if (kind === 'A1' ? a1Pruned : c1Pruned) return { id, code, label: 'UNKNOWN', reason: `Số dòng ${kind} ít hơn mẫu gốc (nghi đơn vị tự lọc)` };
    return { id, code, label: 'SCHOOL_TEMPLATE', reason: `Khớp 100% mẫu ${kind} (${rawUc}), 0 sửa ô, 0 liên kết` };
  };

  const a1Classified = a1Rows.map((r) => classifyCore(r, 'A1'));
  const c1Classified = c1Rows.map((r) => classifyCore(r, 'C1'));
  const deps = classifyDependentRows({ rawUnitCode: rawUc, wbData: params.wbData, isTcns, isHoldUnit, hasReviewStatus, realTouched, refs, refObj });
  const integrity = simulateRelationalCleanupAndValidate({
    rawUnitCode: rawUc, unitNameVi: unitDef.nameVi, wbData: params.wbData, a1Classified, c1Classified, depBySheet: deps.bySheet
  });

  const a1TplDel = a1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE').length;
  const c1TplDel = c1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE').length;
  const depTplDel = deps.counts.TEMPLATE_DEPENDENT;
  const realCount = a1Classified.filter((x) => x.label === 'TCNS_REAL' || x.label === 'UNIT_REAL').length +
    c1Classified.filter((x) => x.label === 'TCNS_REAL' || x.label === 'UNIT_REAL').length + deps.counts.UNIT_REAL;
  const refCount = a1Classified.filter((x) => x.label === 'REFERENCED').length +
    c1Classified.filter((x) => x.label === 'REFERENCED').length + deps.counts.REFERENCED;
  const unkCount = a1Classified.filter((x) => x.label === 'UNKNOWN').length +
    c1Classified.filter((x) => x.label === 'UNKNOWN').length + deps.counts.UNKNOWN;

  let action = 'NONE_ALREADY_EMPTY';
  if (isTcns) action = 'PROTECT_TCNS_KEEP_ALL';
  else if (isHoldUnit) action = `HOLD_UNVERIFIED_KEEP_ALL (${rawUc})`;
  else if (a1TplDel + c1TplDel + depTplDel > 0 && unkCount + refCount + realCount > 0) action = 'CLEAN_TEMPLATE_ONLY_KEEP_REST';
  else if (a1TplDel + c1TplDel + depTplDel > 0) action = 'CLEAN_ALL_TEMPLATE_INIT_EMPTY';
  else if (unkCount > 0) action = 'HOLD_MANUAL_CONFIRM';

  return {
    sourceKind: params.sourceKind, workbookId: params.workbookId, rawUnitCode: rawUc, canonicalUnitCode: canonUc,
    unitNameVi: unitDef.nameVi, status: params.status || 'draft', currentRevision: params.currentRevision || 0,
    updatedAt: params.updatedAt || null, activeActors, realTouched, unitLogsCount: unitLogs.length,
    a1Before: a1Classified.length, c1Before: c1Classified.length, a1Classified, c1Classified,
    depBySheet: deps.bySheet, depCounts: deps.counts, integrity,
    manifestRow: {
      UnitCode: rawUc, Workbook: params.workbookId, A1Template: a1TplDel, C1Template: c1TplDel,
      DependentTemplate: depTplDel, Real: realCount, Referenced: refCount, Unknown: unkCount, Action: action
    }
  };
}

export function listAllCatalogUnits() { return HCMUTE_UNITS; }
