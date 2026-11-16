import { findHcmuteUnit } from '@/configs/hcmute-units';
import { ServerWorkbook } from './server-workbook-store';

const getSupaUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const getSupaKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const VALID_NHOM_LA_MA = new Set(['I', 'II', 'III', 'IV', 'V', 'VI']);
const VALID_LOAI_NL = new Set(['Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ']);
const VALID_PP = new Set(['PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3']);
const VALID_TAC_DONG = new Set(['Số hóa', 'Cải tiến quy trình', 'Thuê dịch vụ/đặt hàng', 'Tự chủ', 'Xã hội hóa', 'Công việc mới phát sinh']);

function dbHeaders(prefer?: string, userToken?: string): Record<string, string> {
  const key = getSupaKey() || (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const h: Record<string, string> = { apikey: key, Authorization: `Bearer ${userToken || key}`, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  return h;
}

async function upsertRowsStrict(table: string, rows: unknown[], conflictCol: string): Promise<void> {
  if (!rows.length) return;
  const res = await fetch(`${getSupaUrl()}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictCol)}`, {
    method: 'POST', headers: dbHeaders('resolution=merge-duplicates,return=minimal'), body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`RELATIONAL_SYNC_FAILED:${table}:${res.status}`);
}

async function pruneStaleSinglePk(table: string, unitCode: string, pkCol: string, activeIds: Set<string>): Promise<void> {
  const res = await fetch(`${getSupaUrl()}/rest/v1/${table}?ma_don_vi=eq.${encodeURIComponent(unitCode)}&select=${encodeURIComponent(pkCol)}`, { headers: dbHeaders(), cache: 'no-store' });
  if (!res.ok) return;
  const rows = (await res.json()) as Record<string, unknown>[];
  const stale = rows.map((r) => String(r[pkCol] ?? '').trim()).filter((id) => id && !activeIds.has(id));
  for (let i = 0; i < stale.length; i += 40) {
    const chunk = stale.slice(i, i + 40).map((v) => `"${encodeURIComponent(v.replace(/"/g, ''))}"`).join(',');
    await fetch(`${getSupaUrl()}/rest/v1/${table}?ma_don_vi=eq.${encodeURIComponent(unitCode)}&${pkCol}=in.(${chunk})`, { method: 'DELETE', headers: dbHeaders('return=minimal') });
  }
}

async function pruneStaleCompositeYear(table: string, unitCode: string, yearCol: string, activeKeys: Set<string>): Promise<void> {
  const res = await fetch(`${getSupaUrl()}/rest/v1/${table}?ma_don_vi=eq.${encodeURIComponent(unitCode)}&select=ma_vtvl,${yearCol}`, { headers: dbHeaders(), cache: 'no-store' });
  if (!res.ok) return;
  for (const r of (await res.json()) as Record<string, unknown>[]) {
    const vtvl = String(r.ma_vtvl || '').trim(), yr = String(r[yearCol] ?? '').trim();
    if (vtvl && yr && !activeKeys.has(`${vtvl}::${yr}`)) {
      await fetch(`${getSupaUrl()}/rest/v1/${table}?ma_don_vi=eq.${encodeURIComponent(unitCode)}&ma_vtvl=eq.${encodeURIComponent(vtvl)}&${yearCol}=eq.${encodeURIComponent(yr)}`, { method: 'DELETE', headers: dbHeaders('return=minimal') });
    }
  }
}

export function buildWorkbookRelationalPayload(wb: ServerWorkbook) {
  const unitCode = (wb.unitId || '').trim().toUpperCase(), unit = findHcmuteUnit(unitCode), nowIso = new Date().toISOString();
  const touchedSet = new Set(wb.touchedCells || []);
  const a1Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.A1 || []) {
    const code = String(r.maNhiemVu || '').trim();
    if (code) a1Rows.set(code, { ma_nhiem_vu: code, ma_don_vi: unitCode, ten_nhiem_vu: String(r.tenNhiemVu || code).trim(), can_cu_phap_ly: String(r.canCu || 'QĐ 2266/QĐ-ĐHCNKT').trim(), ky_thong_ke: String(r.ky || wb.reportingPeriod || '01/10/2025–30/9/2026').trim(), trang_thai_nv: String(r.trangThai || 'Tiếp tục thực hiện').trim(), nguon_nhiem_vu: r.nguon ? String(r.nguon).trim() : null, updated_at: nowIso });
  }
  const c1Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.C1 || []) {
    const code = String(r.maVtvl || '').trim(), cheDo = String(r.cheDoLamViec || 'Phổ biến (40 giờ/tuần)');
    if (code) c1Rows.set(code, { ma_vtvl: code, ma_don_vi: unitCode, nhom_vtvl_4: String(r.nhomVtvl4 || 'II. Nhóm VTVL Chuyên môn, nghiệp vụ'), ten_khung_vtvl_truong: String(r.tenKhung || r.tenVtvl || code), ten_vtvl_cu_the_don_vi: String(r.tenVtvl || code), bac_nghe_nghiep_su_dung: String(r.bacNgheNghiep || 'Bậc 3'), ma_ngach_chuc_danh: r.maNgach ? String(r.maNgach) : null, loai_nhan_luc: VALID_LOAI_NL.has(String(r.loaiNhanLuc || '')) ? String(r.loaiNhanLuc) : 'Viên chức', che_do_lam_viec: cheDo, gio_chuan_pp2: Number(r.gioChuanPp2) === 1760 || cheDo.includes('Đặc thù') ? 1760 : 1904, phuong_phap: VALID_PP.has(String(r.phuongPhap || '')) ? String(r.phuongPhap) : 'PP2', updated_at: nowIso });
  }
  const a2Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.A2 || []) {
    const code = String(r.maCongViec || '').trim(), nv = String(r.maNhiemVu || '').trim(), vtvl = String(r.maVtvl || '').trim();
    if (code && a1Rows.has(nv) && c1Rows.has(vtvl)) a2Rows.set(code, { ma_cong_viec: code, ma_don_vi: unitCode, ma_nhiem_vu: nv, ma_vtvl: vtvl, ten_cong_viec: String(r.tenCongViec || code), ten_san_pham: String(r.sanPham || 'Sản phẩm / Hồ sơ'), nhom_la_ma: VALID_NHOM_LA_MA.has(String(r.nhomLaMa || '')) ? String(r.nhomLaMa) : 'I', don_vi_tinh: String(r.dvt || 'Sản phẩm'), yeu_cau_chat_luong: r.chatLuong ? String(r.chatLuong) : null, updated_at: nowIso });
  }
  const b1Rows = new Map<string, Record<string, unknown>>(), canCuRows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.B1 || []) {
    const cv = String(r.maCongViec || '').trim(), a2Match = a2Rows.get(cv), vtvl = String(r.maVtvl || a2Match?.ma_vtvl || '').trim();
    if (!cv || !a2Match || !c1Rows.has(vtvl)) continue;
    const prev = b1Rows.get(cv), soSp = (Number(prev?.so_sp_nam) || 0) + Math.max(0, Number(r.soSpNam) || 0), phut = Math.max(0, Number(r.phutThucTe) || Number(prev?.phut_sp_do_thuc_te) || 0);
    b1Rows.set(cv, { ma_cong_viec: cv, ma_don_vi: unitCode, ma_vtvl: vtvl, so_sp_nam: soSp, phut_sp_do_thuc_te: phut, gio_bo_sung_nam: (Number(prev?.gio_bo_sung_nam) || 0) + Math.max(0, Number(r.gioBoSung) || 0), gio_sp_tinh: (Number(prev?.gio_sp_tinh) || 0) + Math.max(0, Number(r.gioSp) || 0), gio_tong_tinh: (Number(prev?.gio_tong_tinh) || 0) + Math.max(0, Number(r.gioTong) || 0), nguon_so_luong: r.nguon ? String(r.nguon) : (prev?.nguon_so_luong || null), nguon_thoi_gian: r.ppThucTe ? String(r.ppThucTe) : (prev?.nguon_thoi_gian || null), canh_bao_cot_r: String(r.canhBao || 'ĐẠT'), giai_trinh_cot_s: r.giaiTrinhKhacChuan ? String(r.giaiTrinhKhacChuan) : null, updated_at: nowIso });
    canCuRows.set(cv, { ma_don_vi: unitCode, ma_cong_viec: cv, ma_vtvl: vtvl, ten_cong_viec: String(a2Match.ten_cong_viec || cv), so_sp_goi_y: soSp, phut_sp_goi_y: Number(r.phutChuan || phut) || 0, muc_do_phuc_tap: 'Thông thường', nguon_can_cu_goi_y: String(r.nguon || 'Định mức chuẩn HCM-UTE'), da_sua_thuc_te: touchedSet.has(`B1:${r.id}:soSpNam`) || touchedSet.has(`B1:${r.id}:phutThucTe`), updated_at: nowIso });
  }
  const b2CtRows = new Map<string, Record<string, unknown>>();
  (wb.data?.B2_CT || []).forEach((r, idx) => {
    const cv = String(r.maCongViec || '').trim(), a2Match = a2Rows.get(cv), vtvl = String(r.maVtvl || a2Match?.ma_vtvl || '').trim();
    if (!cv || !a2Match || !c1Rows.has(vtvl)) return;
    const id = String(r.id || `b2ct-${unitCode}-${cv}-${idx + 1}`).trim();
    b2CtRows.set(id, { id_tac_dong: id, ma_don_vi: unitCode, ma_cong_viec: cv, ma_vtvl: vtvl, loai_tac_dong: VALID_TAC_DONG.has(String(r.loaiTacDong || '')) ? String(r.loaiTacDong) : 'Số hóa', khau_tac_dong: r.congDoan ? String(r.congDoan) : null, gio_giam_hop_le: Number(r.gioBienDong) || 0, can_cu_minh_chung: r.vanBan ? String(r.vanBan) : null, updated_at: nowIso });
  });
  const b2Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.B2 || []) {
    const cv = String(r.maCongViec || '').trim(), a2Match = a2Rows.get(cv), vtvl = String(r.maVtvl || a2Match?.ma_vtvl || '').trim();
    if (cv && a2Match && c1Rows.has(vtvl)) b2Rows.set(cv, { ma_cong_viec: cv, ma_don_vi: unitCode, ma_vtvl: vtvl, gio_giam_so_hoa: Number(r.gioGiam) || 0, gio_viec_moi: Number(r.gioMoi) || 0, gio_tac_dong_rong: (Number(r.gioGiam) || 0) + (Number(r.gioMoi) || 0), updated_at: nowIso });
  }
  const c2Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.C2 || []) {
    const vtvl = String(r.maVtvl || '').trim();
    if (!vtvl || !c1Rows.has(vtvl)) continue;
    const prev = c2Rows.get(vtvl), compText = [r.nhomNangLuc, r.tenNangLuc, r.capDoYeuCau].filter(Boolean).join(': ');
    c2Rows.set(vtvl, { ma_vtvl: vtvl, ma_don_vi: unitCode, muc_tieu_vi_tri: String(r.tenVtvl || prev?.muc_tieu_vi_tri || vtvl), trach_nhiem_chinh: [prev?.trach_nhiem_chinh, r.moTaChiTiet].filter(Boolean).join('; ') || String(r.tenNangLuc || vtvl), khung_nang_luc_bac: [prev?.khung_nang_luc_bac, compText].filter(Boolean).join(' | ') || String(r.bacNgheNghiep || 'Bậc 3'), yeu_cau_trinh_do_chuyen_mon: String(r.bacNgheNghiep || 'Đại học / Bậc 3'), updated_at: nowIso });
  }
  const c3Rows = new Map<string, Record<string, unknown>>();
  for (const r of wb.data?.C3 || []) {
    const vtvl = String(r.maVtvl || '').trim();
    if (vtvl && c1Rows.has(vtvl)) c3Rows.set(vtvl, { ma_vtvl: vtvl, ma_don_vi: unitCode, phuong_phap: VALID_PP.has(String(r.phuongPhap || '')) ? String(r.phuongPhap) : 'PP2', gio_b1_nam: Number(r.gioB1) || 0, gio_tac_dong_b2: Number(r.gioB2) || 0, gio_rong_nam: Number(r.gioRong) || 0, gio_chuan_pp2: Number(r.gioPp2) || 1904, nguoi_quy_doi_pp2: Number(r.nguoiQuyDoi) || 0, nguoi_dinh_bien_pp1: Number(r.nguoiPp1) || 0, nguoi_can_bo_tri: Number(r.nguoiCanBoTri) || 0, updated_at: nowIso });
  }
  const d1Rows = new Map<string, Record<string, unknown>>();
  (wb.data?.D1 || []).forEach((r, idx) => {
    const vtvl = String(r.maVtvl || '').trim(), hoTen = String(r.hoTen || '').trim();
    if (!vtvl || !hoTen || !c1Rows.has(vtvl)) return;
    const id = String(r.id || `d1-${unitCode}-${vtvl}-${idx + 1}`).trim();
    d1Rows.set(id, { ma_nguon_luc: id, ma_don_vi: unitCode, ma_vtvl: vtvl, ho_va_ten: hoTen, chuc_danh_hien_giu: String(r.ngachVienChuc || 'Chuyên viên'), ma_ngach_chuc_danh: String(r.maSoNgach || 'V.01.03'), loai_nhan_luc: VALID_LOAI_NL.has(String(r.loaiHopDong || '')) ? String(r.loaiHopDong) : 'Viên chức', ty_le_phan_bo_chinh: 100, updated_at: nowIso });
  });
  const duBaoRows: Record<string, unknown>[] = [], duBaoKeys = new Set<string>();
  for (const r of wb.data?.DU_BAO || []) {
    const vtvl = String(r.maVtvl || '').trim(), yr = parseInt(String(r.nam || ''), 10);
    if (!vtvl || !c1Rows.has(vtvl) || yr < 2027 || yr > 2031 || duBaoKeys.has(`${vtvl}::${yr}`)) continue;
    duBaoKeys.add(`${vtvl}::${yr}`);
    duBaoRows.push({ ma_vtvl: vtvl, nam_du_bao: yr, ma_don_vi: unitCode, ty_le_thay_doi_kl_pct: Number(r.bienDong) || 0, nhu_cau_fte_du_kien: Math.max(0, Number(r.nguoiCanBoTriNam) || 1), thuyet_minh_du_bao: [r.noiDungThayDoi, r.canCuNguon].filter(Boolean).join(' — ') || null });
  }
  const d2Rows: Record<string, unknown>[] = [], d2Keys = new Set<string>();
  for (const r of wb.data?.D2 || []) {
    const vtvl = String(r.maVtvl || '').trim(), yr = parseInt(String(r.nam || ''), 10);
    if (!vtvl || !c1Rows.has(vtvl) || yr < 2027 || yr > 2031 || d2Keys.has(`${vtvl}::${yr}`)) continue;
    d2Keys.add(`${vtvl}::${yr}`);
    const need = Number(r.soNguoiCanBoTri) || 0, have = Number(r.soNguoiCoTheBoTri) || 0;
    d2Rows.push({ ma_vtvl: vtvl, nam_phuong_an: yr, ma_don_vi: unitCode, so_nguoi_can_bo_tri: need, so_nguoi_hien_co: have, chenh_lech: need - have, phuong_an_dieu_chinh: String(r.nguonGiaiTrinh || r.trangThai || 'Giữ ổn định') });
  }
  const kRows = new Map<number, Record<string, unknown>>();
  for (const r of wb.data?.K || []) {
    const stt = parseInt(String(r.stt || ''), 10);
    if (stt >= 1 && stt <= 6) kRows.set(stt, { ma_don_vi: unitCode, stt_chi_tieu: stt, nhom_bieu_doi_soat: String(r.nhomBieu || `Chỉ tiêu ${stt}`), noi_dung_kiem_tra: String(r.chiTieu || ''), so_dong_loi: Math.max(0, parseInt(String(r.soDongLoi || 0), 10) || 0), ket_luan: String(r.ketLuan || 'ĐẠT'), updated_at: nowIso });
  }
  const sessionMap = new Map<string, Record<string, unknown>>(), partRows: Record<string, unknown>[] = [];
  for (const p of wb.participants || []) {
    const sid = p.sessionId || `sess_${wb.id}`;
    sessionMap.set(sid, { id: sid, workbook_id: wb.id, access_scope: 'editor', last_active_at: nowIso });
    partRows.push({ id: p.id || `part_${wb.id}_${p.emailNormalized}`, session_id: sid, workbook_id: wb.id, display_name: p.displayName || 'Chuyên viên', email: p.email, email_normalized: p.emailNormalized || p.email.toLowerCase(), role_label: p.roleLabel || 'Chuyên viên', updated_at: nowIso });
  }

  return {
    unitCode,
    unitRow: { ma_don_vi: unitCode, ten_don_vi_vi: wb.unitNameVi || unit.nameVi || unitCode, ten_don_vi_en: unit.nameEn || wb.unitNameVi || unitCode, khoi_don_vi: unit.group || 'phong-ban', is_active: true, updated_at: nowIso },
    a1_nhiem_vu: Array.from(a1Rows.values()), c1_vtvl: Array.from(c1Rows.values()), a2_cong_viec: Array.from(a2Rows.values()),
    b1_khoi_luong: Array.from(b1Rows.values()), b2_ct_tac_dong: Array.from(b2CtRows.values()), b2_thay_doi: Array.from(b2Rows.values()),
    c2_nang_luc: Array.from(c2Rows.values()), c3_nhu_cau: Array.from(c3Rows.values()), d1_nhan_luc: Array.from(d1Rows.values()),
    du_bao_5_nam: duBaoRows, d2_phuong_an: d2Rows, k_kiem_tra: Array.from(kRows.values()), can_cu_goi_y: Array.from(canCuRows.values()),
    workbook: { id: wb.id, unit_id: unitCode, reporting_period: wb.reportingPeriod || '01/10/2025–30/9/2026', status: wb.status || 'draft', current_revision: Math.max(1, wb.currentRevision || 1), data: wb.data, touched_cells: wb.touchedCells || [], is_deleted: Boolean(wb.isDeleted), updated_at: nowIso },
    workbook_sessions: Array.from(sessionMap.values()), session_participants: partRows,
    workbook_revisions: (wb.revisions || []).slice(0, 5).map((r) => ({ id: r.id || `rev_${wb.id}_${r.revision}`, workbook_id: wb.id, revision: Math.max(1, r.revision || 1), data: r.data, actor_email: r.actorEmail || 'tcns@hcmute.edu.vn', actor_title: r.actorTitle || null, change_summary: r.changeSummary || null })),
    activeKeys: {
      a1: Array.from(a1Rows.keys()), c1: Array.from(c1Rows.keys()), a2: Array.from(a2Rows.keys()),
      b1: Array.from(b1Rows.keys()), b2_ct: Array.from(b2CtRows.keys()), b2: Array.from(b2Rows.keys()),
      c2: Array.from(c2Rows.keys()), c3: Array.from(c3Rows.keys()), d1: Array.from(d1Rows.keys()),
      du_bao: Array.from(duBaoKeys), d2: Array.from(d2Keys), can_cu_goi_y: Array.from(canCuRows.keys())
    }
  };
}

export async function syncWorkbookAtomicOrFallback(
  wb: ServerWorkbook, snapshotPayload: Record<string, unknown>, userToken?: string, options?: { simulateTxError?: boolean; requireAtomicRpc?: boolean }
): Promise<{ ok: boolean; atomicRpcUsed: boolean }> {
  if (options?.simulateTxError && process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') {
    throw new Error('TX_ABORTED_MIDWAY: Lỗi giả lập giữa giao dịch đồng bộ bảng tính.');
  }
  const supaUrl = getSupaUrl(), supaKey = getSupaKey();
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !supaUrl || !supaKey || wb.isDeleted) return { ok: true, atomicRpcUsed: false };

  const rel = buildWorkbookRelationalPayload(wb), unitCode = rel.unitCode;
  if (!unitCode) return { ok: false, atomicRpcUsed: false };

  const rpcRes = await fetch(`${supaUrl}/rest/v1/rpc/rpc_sync_workbook_atomic`, {
    method: 'POST', headers: dbHeaders(undefined, userToken),
    body: JSON.stringify({ p_unit_code: unitCode, p_snapshot: snapshotPayload, p_relational: rel, p_simulate_error: Boolean(options?.simulateTxError) })
  });
  if (rpcRes.ok) return { ok: true, atomicRpcUsed: true };
  const errText = await rpcRes.text().catch(() => '');
  if (options?.simulateTxError || options?.requireAtomicRpc || (rpcRes.status !== 404 && !errText.includes('PGRST202'))) {
    throw new Error(`TX_ABORTED_MIDWAY: RPC rpc_sync_workbook_atomic thất bại (HTTP ${rpcRes.status}): ${errText}`);
  }

  const prevRes = await fetch(`${supaUrl}/rest/v1/t_tien_do?ma_don_vi=eq.${encodeURIComponent(unitCode)}`, { headers: dbHeaders(), cache: 'no-store' });
  const prevRows = prevRes.ok ? await prevRes.json().catch(() => []) : [];
  const prevSnapshot = Array.isArray(prevRows) && prevRows[0] ? prevRows[0] : null;
  try {
    await upsertRowsStrict('dm_don_vi', [rel.unitRow], 'ma_don_vi');
    await upsertRowsStrict('t_tien_do', [snapshotPayload], 'ma_don_vi');
    if (wb.data.B2_CT) await pruneStaleSinglePk('b2_ct_tac_dong', unitCode, 'id_tac_dong', new Set(rel.activeKeys.b2_ct));
    if (wb.data.B2) await pruneStaleSinglePk('b2_thay_doi', unitCode, 'ma_cong_viec', new Set(rel.activeKeys.b2));
    if (wb.data.B1) {
      await pruneStaleSinglePk('b1_khoi_luong', unitCode, 'ma_cong_viec', new Set(rel.activeKeys.b1));
      await pruneStaleSinglePk('can_cu_goi_y', unitCode, 'ma_cong_viec', new Set(rel.activeKeys.can_cu_goi_y));
    }
    if (wb.data.C2) await pruneStaleSinglePk('c2_nang_luc', unitCode, 'ma_vtvl', new Set(rel.activeKeys.c2));
    if (wb.data.C3) await pruneStaleSinglePk('c3_nhu_cau', unitCode, 'ma_vtvl', new Set(rel.activeKeys.c3));
    if (wb.data.D1) await pruneStaleSinglePk('d1_nhan_luc', unitCode, 'ma_nguon_luc', new Set(rel.activeKeys.d1));
    if (wb.data.DU_BAO) await pruneStaleCompositeYear('du_bao_5_nam', unitCode, 'nam_du_bao', new Set(rel.activeKeys.du_bao));
    if (wb.data.D2) await pruneStaleCompositeYear('d2_phuong_an', unitCode, 'nam_phuong_an', new Set(rel.activeKeys.d2));
    if (wb.data.A2) await pruneStaleSinglePk('a2_cong_viec', unitCode, 'ma_cong_viec', new Set(rel.activeKeys.a2));
    if (wb.data.A1) await pruneStaleSinglePk('a1_nhiem_vu', unitCode, 'ma_nhiem_vu', new Set(rel.activeKeys.a1));
    if (wb.data.C1) await pruneStaleSinglePk('c1_vtvl', unitCode, 'ma_vtvl', new Set(rel.activeKeys.c1));

    await upsertRowsStrict('a1_nhiem_vu', rel.a1_nhiem_vu, 'ma_nhiem_vu');
    await upsertRowsStrict('c1_vtvl', rel.c1_vtvl, 'ma_vtvl');
    await upsertRowsStrict('a2_cong_viec', rel.a2_cong_viec, 'ma_cong_viec');
    await Promise.all([
      upsertRowsStrict('b1_khoi_luong', rel.b1_khoi_luong, 'ma_cong_viec'),
      upsertRowsStrict('b2_ct_tac_dong', rel.b2_ct_tac_dong, 'id_tac_dong'),
      upsertRowsStrict('b2_thay_doi', rel.b2_thay_doi, 'ma_cong_viec'),
      upsertRowsStrict('c2_nang_luc', rel.c2_nang_luc, 'ma_vtvl'),
      upsertRowsStrict('c3_nhu_cau', rel.c3_nhu_cau, 'ma_vtvl'),
      upsertRowsStrict('d1_nhan_luc', rel.d1_nhan_luc, 'ma_nguon_luc'),
      upsertRowsStrict('du_bao_5_nam', rel.du_bao_5_nam, 'ma_vtvl,nam_du_bao'),
      upsertRowsStrict('d2_phuong_an', rel.d2_phuong_an, 'ma_vtvl,nam_phuong_an'),
      upsertRowsStrict('k_kiem_tra', rel.k_kiem_tra, 'ma_don_vi,stt_chi_tieu'),
      upsertRowsStrict('can_cu_goi_y', rel.can_cu_goi_y, 'ma_don_vi,ma_cong_viec')
    ]);
    await upsertRowsStrict('workbooks', [rel.workbook], 'id');
    await upsertRowsStrict('workbook_sessions', rel.workbook_sessions, 'id');
    await upsertRowsStrict('session_participants', rel.session_participants, 'id');
    await upsertRowsStrict('workbook_revisions', rel.workbook_revisions, 'id');
    return { ok: true, atomicRpcUsed: false };
  } catch (err) {
    if (prevSnapshot) {
      await fetch(`${supaUrl}/rest/v1/t_tien_do?on_conflict=ma_don_vi`, {
        method: 'POST', headers: dbHeaders('resolution=merge-duplicates,return=minimal'), body: JSON.stringify(prevSnapshot)
      }).catch(() => {});
    }
    throw err;
  }
}

export async function syncWorkbookSheetsToRelationalTables(wb: ServerWorkbook): Promise<void> {
  await syncWorkbookAtomicOrFallback(wb, { ma_don_vi: wb.unitId, ten_don_vi: wb.unitNameVi, phien_ban: `v${wb.currentRevision || 1}`, du_lieu_ho_so_json: { serverWorkbook: wb } });
}
