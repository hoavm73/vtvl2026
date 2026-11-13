import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';

export function recalculateGridFormulas(
  prev: Record<ExcelSheetKey, GenericGridRow[]>,
  unitCode: string,
  unitNameVi: string
): Record<ExcelSheetKey, GenericGridRow[]> {
  const next = { ...prev };

  // 1. Sync tasks from A2 to B1 & B2 if missing, and sync maVtvl
  const existingA2 = next.A2 || [];
  const b1Map = new Map((next.B1 || []).map((r) => [String(r.maCongViec), r]));
  const updatedB1: GenericGridRow[] = existingA2.map((t, idx) => {
    const existing = b1Map.get(String(t.maCongViec));
    const rawQty = existing?.soSpNam;
    const rawMins = existing?.phutThucTe;
    const qty = rawQty !== undefined && rawQty !== null && rawQty !== '' ? Number(rawQty) : '';
    const mins = rawMins !== undefined && rawMins !== null && rawMins !== '' ? Number(rawMins) : '';
    const extra = existing?.gioBoSung !== undefined && existing?.gioBoSung !== null && existing?.gioBoSung !== '' ? Number(existing.gioBoSung) : 0;
    const numQty = typeof qty === 'number' ? qty : 0;
    const numMins = typeof mins === 'number' ? mins : 0;
    const hours = (numQty > 0 && numMins > 0) ? Math.round((numQty * numMins / 60) * 10) / 10 : 0;
    const total = Math.round((hours + extra) * 10) / 10;
    const rawGiaiTrinh = String(existing?.giaiTrinhKhacChuan || '');
    let b1Alert = total > 0 ? 'ĐẠT' : 'CHƯA ĐẠT';
    if (rawGiaiTrinh.trim() !== '' && !rawGiaiTrinh.trim().startsWith('Đã xác nhận:')) {
      b1Alert = 'CHỜ XÁC NHẬN KHÁC CHUẨN';
    }
    return {
      id: existing?.id || `b1-sync-${idx + 1}`,
      maCongViec: t.maCongViec,
      maVtvl: t.maVtvl,
      soSpNam: qty,
      phutThucTe: mins,
      gioBoSung: extra,
      gioSp: hours,
      gioTong: total,
      nguon: existing?.nguon ?? '',
      ppThucTe: existing?.ppThucTe ?? '',
      phutApDung: mins !== '' ? mins : 0,
      canhBao: b1Alert,
      giaiTrinhKhacChuan: rawGiaiTrinh
    };
  });
  next.B1 = updatedB1;

  // 2. Sync B2_CT (maVtvl tra cứu từ A2) & B2 (tổng hợp động theo danh mục công việc biến động)
  const a2VtvlLookup = new Map(existingA2.map((t) => [String(t.maCongViec), String(t.maVtvl || '')]));
  const updatedB2Ct: GenericGridRow[] = (next.B2_CT || []).map((c) => ({
    ...c,
    maVtvl: a2VtvlLookup.get(String(c.maCongViec)) || (c.maVtvl as string) || ''
  }));
  next.B2_CT = updatedB2Ct;

  const b2Map = new Map((next.B2 || []).map((r) => [String(r.maCongViec), r]));
  const activeTaskCodes = Array.from(new Set([
    ...updatedB2Ct.map((c) => String(c.maCongViec || '').trim()).filter(Boolean),
    ...(next.B2 || []).filter((b) => (Number(b.gioMoi) || 0) > 0).map((b) => String(b.maCongViec || '').trim()).filter(Boolean)
  ]));

  const updatedB2: GenericGridRow[] = activeTaskCodes.map((taskCode, idx) => {
    const existing = b2Map.get(taskCode);
    const b1Item = updatedB1.find((b) => b.maCongViec === taskCode);
    const a2Item = existingA2.find((a) => a.maCongViec === taskCode);
    const b1Hours = Number(b1Item?.gioTong) || 0;
    const ctMatches = updatedB2Ct.filter((c) => c.maCongViec === taskCode);
    const sumVar = ctMatches.reduce((acc, c) => acc + (Number(c.gioBienDong) || 0), 0);
    const newHours = Number(existing?.gioMoi) || 0;
    const finalHours = Math.max(0, Math.round((b1Hours + sumVar + newHours) * 10) / 10);
    return {
      id: existing?.id || `b2-${taskCode}-${idx + 1}`,
      maCongViec: taskCode,
      maVtvl: a2Item?.maVtvl || b1Item?.maVtvl || existing?.maVtvl || '',
      gioB1: b1Hours,
      gioGiam: sumVar,
      gioMoi: newHours,
      gioSauTacDong: finalHours,
      tyLeThayDoi: b1Hours > 0 ? `${Math.round((sumVar / b1Hours) * 100)}%` : '0%',
      trangThai: existing?.trangThai || 'Đã kiểm chứng',
      doiChieuTrung: existing?.doiChieuTrung || 'Đã đối chiếu'
    };
  });
  next.B2 = updatedB2;

  // 3. Sync positions from C1 into C3, DU_BAO, D2
  const c1Positions = next.C1 || [];
  const c3Map = new Map((next.C3 || []).map((r) => [String(r.maVtvl), r]));
  const updatedC3: GenericGridRow[] = c1Positions.map((c, idx) => {
    const vCode = String(c.maVtvl);
    const existing = c3Map.get(vCode);
    const stdHours = Number(c.gioChuanPp2) || 1904;
    const sumB1 = updatedB1.filter((b) => b.maVtvl === vCode).reduce((acc, b) => acc + (Number(b.gioTong) || 0), 0);
    const sumB2 = updatedB2.filter((b) => b.maVtvl === vCode).reduce((acc, b) => acc + (Number(b.gioGiam) || 0), 0);
    const netHours = Math.max(0, Math.round(sumB1 + sumB2));
    const isQl = vCode.includes('QL') || vCode.includes('LD') || String(c.canCuQuyGio).includes('PP1') || existing?.phuongPhap === 'PP1';
    const fteCalc = Math.round((netHours / stdHours) * 100) / 100;
    const qlPeople = existing?.nguoiPp1 ? Number(existing.nguoiPp1) : (vCode.includes('QL43') || vCode.includes('PTP') || vCode.includes('PTK') ? 2 : 1);
    const people = isQl ? qlPeople : Math.max(1, Math.ceil(fteCalc));
    const pp1Explain = 'Định biên theo PP1; QĐ 2266, PL18 và BMTCV&KNL';
    const pp2Explain = 'Kết quả đo lường khối lượng công việc tại Biểu B1 kỳ 01/10/2025–30/9/2026; quỹ giờ chuẩn 1.904 giờ theo C1';
    const rawExplain = String(existing?.nguonGiaiTrinh || '').trim();
    const resolvedExplain = (rawExplain === '' || rawExplain === 'a')
      ? (isQl ? pp1Explain : pp2Explain)
      : rawExplain;
    return {
      id: existing?.id || `c3-sync-${idx + 1}`,
      maVtvl: vCode,
      phuongPhap: isQl ? 'PP1' : (existing?.phuongPhap || 'PP2'),
      gioB1: isQl ? '' : Math.round(sumB1),
      gioB2: isQl ? 0 : Math.round(sumB2),
      gioRong: isQl ? '' : netHours,
      gioPp2: stdHours,
      nguoiQuyDoi: isQl ? '' : fteCalc,
      nguoiPp1: isQl ? qlPeople : 0,
      nguoiCanBoTri: people,
      nguonGiaiTrinh: resolvedExplain,
      canhBao: 'ĐẠT'
    };
  });
  next.C3 = updatedC3;

  // 4. DU_BAO_5_NAM (Đồng bộ động nhu cầu năm cơ sở từ C3)
  const updatedDuBao: GenericGridRow[] = (next.DU_BAO || []).map((r) => {
    const vCode = String(r.maVtvl || '');
    const c3Match = updatedC3.find((c) => c.maVtvl === vCode);
    const basePeople = Number(c3Match?.nguoiCanBoTri) || Number(r.nguoiC3) || 1;
    const rawBienDong = r.bienDong;
    const isMissing = rawBienDong === '' || rawBienDong === null || rawBienDong === undefined;
    const diff = isMissing ? 0 : Number(rawBienDong);
    const alert = isMissing ? 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)' : 'ĐẠT';
    return {
      ...r,
      nguoiC3: basePeople,
      nguoiCanBoTriNam: Math.max(0, basePeople + diff),
      kiemTra: alert
    };
  });
  next.DU_BAO = updatedDuBao;

  // 5. D2_PhuongAn (Tự động đồng bộ số người cần bố trí từ 10. DU_BAO_5_NAM)
  const duBaoLookup = new Map(updatedDuBao.map((d) => [`${d.maVtvl}_${d.nam}`, d]));
  const d1Staff = next.D1 || [];

  const updatedD2: GenericGridRow[] = (next.D2 || []).map((r) => {
    const vCode = String(r.maVtvl || '');
    const yr = String(r.nam || '');
    const key = `${vCode}_${yr}`;
    const duBaoItem = duBaoLookup.get(key);
    const countD1 = d1Staff.filter((d) => d.maVtvl === vCode).length;
    const need = duBaoItem ? Number(duBaoItem.nguoiCanBoTriNam) : (Number(r.soNguoiCanBoTri) || 1);
    const count = r.soNguoiCoTheBoTri !== undefined && r.soNguoiCoTheBoTri !== '' ? Number(r.soNguoiCoTheBoTri) : countD1;
    const rawAdjust = r.deNghiDieuChinh;
    const isMissingAdjust = rawAdjust === '' || rawAdjust === null || rawAdjust === undefined;
    const adjustVal = isMissingAdjust ? (need - count) : Number(rawAdjust);
    const d2Alert = isMissingAdjust ? 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)' : 'ĐẠT';

    return {
      ...r,
      soNguoiCanBoTri: need,
      soNguoiCoTheBoTri: count,
      bienCheGiao: r.bienCheGiao ?? count,
      deNghiDieuChinh: isMissingAdjust ? '' : adjustVal,
      nguonGiaiTrinh: r.nguonGiaiTrinh || (duBaoItem?.canCuNguon ? `${duBaoItem.canCuNguon} - ${duBaoItem.noiDungThayDoi}` : `Phương án cân đối nhân sự năm ${yr}`),
      canhBao: d2Alert,
      trangThai: r.trangThai || 'Đã hoàn thành ở đơn vị'
    };
  });
  next.D2 = updatedD2;

  // 6. Dynamic Evaluation of K_KiemTra (6 checks)
  const validMissions = new Set((next.A1 || []).map((m) => String(m.maNhiemVu)));
  const validVtvl = new Set(c1Positions.map((c) => String(c.maVtvl)));
  const validTasks = new Set(existingA2.map((t) => String(t.maCongViec)));

  const k1Errors = existingA2.filter((t) => !validMissions.has(String(t.maNhiemVu)) || !String(t.maCongViec).startsWith(String(t.maNhiemVu))).length;
  const k2Errors = updatedB1.filter((b) => !validVtvl.has(String(b.maVtvl))).length;
  const k3Errors = updatedB1.filter((b) => Number(b.gioTong) <= 0).length;
  const k4Errors = (next.B2_CT || []).filter((c) => !validTasks.has(String(c.maCongViec))).length;
  const k5Errors = d1Staff.filter((d) => !validVtvl.has(String(d.maVtvl))).length;
  const k6Errors = updatedD2.filter((d) => {
    const c3 = updatedC3.find((c) => c.maVtvl === d.maVtvl);
    return Number(d.soNguoiCanBoTri) !== Number(c3?.nguoiCanBoTri);
  }).length;

  next.K = [
    { id: 'k-1', stt: 1, nhomBieu: 'A2 ↔ A1', chiTieu: 'Mã công việc A2 phải kế thừa đúng Mã nhiệm vụ A1 ([Mã NV].CVxx)', bangNguon: '2. A2_CongViec', bangDich: '1. A1_NhiemVu', soDongLoi: k1Errors, nguongChoPhep: '0', ketLuan: k1Errors === 0 ? 'ĐẠT' : 'LỖI' },
    { id: 'k-2', stt: 2, nhomBieu: 'B1 ↔ C1', chiTieu: 'Mã VTVL tại B1 phải tồn tại và kích hoạt tại C1', bangNguon: '4. B1_KhoiLuong', bangDich: '3. C1_VTVL', soDongLoi: k2Errors, nguongChoPhep: '0', ketLuan: k2Errors === 0 ? 'ĐẠT' : 'LỖI' },
    { id: 'k-3', stt: 3, nhomBieu: 'B1 Cảnh báo', chiTieu: 'Khối lượng và thời gian làm việc phải lớn hơn 0', bangNguon: '4. B1_KhoiLuong', bangDich: 'Nội bộ B1', soDongLoi: k3Errors, nguongChoPhep: '0', ketLuan: k3Errors === 0 ? 'ĐẠT' : 'LỖI' },
    { id: 'k-4', stt: 4, nhomBieu: 'B2_CT ↔ B1', chiTieu: 'Mã công việc tác động phải khớp công việc đã khai tại B1', bangNguon: '5. B2_CT_TacDong', bangDich: '4. B1_KhoiLuong', soDongLoi: k4Errors, nguongChoPhep: '0', ketLuan: k4Errors === 0 ? 'ĐẠT' : 'LỖI' },
    { id: 'k-5', stt: 5, nhomBieu: 'D1 ↔ C1', chiTieu: 'Mã VTVL nhân sự đảm nhận phải khớp danh mục VTVL tại C1', bangNguon: '9. D1_NhanLuc', bangDich: '3. C1_VTVL', soDongLoi: k5Errors, nguongChoPhep: '0', ketLuan: k5Errors === 0 ? 'ĐẠT' : 'LỖI' },
    { id: 'k-6', stt: 6, nhomBieu: 'C3 ↔ D2', chiTieu: 'Nhu cầu nhân sự năm cơ sở phải liên thông với phương án D2', bangNguon: '8. C3_NhuCau', bangDich: '11. D2_PhuongAn', soDongLoi: k6Errors, nguongChoPhep: '0', ketLuan: k6Errors === 0 ? 'ĐẠT' : 'LỖI' }
  ];

  // 7. Update T_TienDo
  const totalErrors = k1Errors + k2Errors + k3Errors + k4Errors + k5Errors + k6Errors;
  next.T = [{
    id: 't-1',
    maDonVi: unitCode,
    tenDonVi: unitNameVi,
    soNhiemVu: (next.A1 || []).length,
    soCongViec: existingA2.length,
    soVtvl: c1Positions.length,
    tongFte: updatedC3.reduce((acc, c) => acc + (Number(c.nguoiCanBoTri) || 0), 0),
    trangThai: totalErrors === 0 ? 'Đạt 6/6 chỉ tiêu kiểm tra' : `Phát hiện ${totalErrors} chỉ tiêu cần điều chỉnh`
  }];

  return next;
}

