import { GenericGridRow } from './excel-grid-types';

/**
 * Chuẩn hóa & tự động tính toán Biểu 7. C2_NangLuc (7 cột A–G) và Biểu 9. D1_NhanLuc (11 cột A–K)
 * khớp 100% công thức trong tệp Excel HD07 (TCNS_HCMUTE_Bo_bieu_HD07.xlsx), giữ tương thích ngược dữ liệu cũ.
 */
export function normalizeC2Rows(
  c2Rows: GenericGridRow[] | undefined,
  c1Positions: GenericGridRow[]
): GenericGridRow[] {
  const c1NameByCode = new Map(
    c1Positions.map((c) => [String(c.maVtvl || '').trim().toUpperCase(), String(c.tenVtvl || '')])
  );

  const normalized: GenericGridRow[] = (Array.isArray(c2Rows) ? c2Rows : []).map((r) => {
    const codeUpper = String(r.maVtvl || '').trim().toUpperCase();
    const matchedName = c1NameByCode.get(codeUpper);
    const hasHd07Fields =
      r.trachNhiem !== undefined ||
      r.nangLucChung !== undefined ||
      r.chuyenMon !== undefined ||
      r.lanhDao !== undefined ||
      r.canCu !== undefined ||
      r.nguonBanMoTa !== undefined;

    if (hasHd07Fields) {
      return { ...r, ...(matchedName ? { tenVtvl: matchedName } : {}) };
    }

    // Tương thích ngược từ dữ liệu C2 cũ (moTaChiTiet / tenNangLuc / bacNgheNghiep)
    const legacyDetail = String(r.moTaChiTiet || '').trim();
    const legacyName = String(r.tenNangLuc || '').trim();
    const legacyLevel = String(r.bacNgheNghiep || '').trim();
    const isQl = codeUpper.includes('.QL');
    return {
      ...r,
      ...(matchedName ? { tenVtvl: matchedName } : {}),
      trachNhiem: legacyName || legacyDetail || '',
      nangLucChung: legacyDetail ? legacyDetail.split('|')[0]?.trim() || '' : '',
      chuyenMon: legacyDetail.includes('|')
        ? legacyDetail.split('|').slice(1).join('|').trim()
        : (legacyLevel || legacyDetail || ''),
      lanhDao: isQl ? 'Điều hành, phân công và giải trình trong phạm vi đơn vị' : 'Không áp dụng',
      canCu: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP; QĐ 2266/QĐ-ĐHCNKT',
      nguonBanMoTa: ''
    };
  });

  // Đồng bộ liên kết 1-1 từ C1!A sang C2!A như công thức ='6. C1_VTVL'!A3
  const seenC2 = new Set(normalized.map((r) => String(r.maVtvl || '').trim().toUpperCase()).filter(Boolean));
  c1Positions.forEach((c, idx) => {
    const code = String(c.maVtvl || '').trim();
    const codeUpper = code.toUpperCase();
    if (!codeUpper || seenC2.has(codeUpper)) return;
    seenC2.add(codeUpper);
    normalized.push({
      id: `c2-sync-${code}-${idx + 1}`,
      maVtvl: code,
      tenVtvl: String(c.tenVtvl || ''),
      trachNhiem: '',
      nangLucChung: '',
      chuyenMon: '',
      lanhDao: '',
      canCu: '',
      nguonBanMoTa: ''
    });
  });

  return normalized;
}

const isBlank = (v: unknown): boolean => v === '' || v === null || v === undefined;

export function normalizeD1Rows(
  d1Rows: GenericGridRow[] | undefined,
  c1Positions: GenericGridRow[],
  unitNameVi: string
): GenericGridRow[] {
  if (!Array.isArray(d1Rows)) return [];
  const c1HoursByCode = new Map(
    c1Positions.map((c) => [String(c.maVtvl || '').trim().toUpperCase(), Number(c.gioChuanPp2) || 0])
  );

  // Bước 1: chuẩn hóa các cột nhập và đếm tần suất Mã nguồn lực (COUNTIF($A$3:$A$1586, A3))
  const prepped = d1Rows.map((r) => {
    const maNguonLuc = String(r.maNguonLuc ?? r.hoTen ?? '').trim();
    const loaiNhanLuc = String(
      r.loaiNhanLuc ??
      (String(r.loaiHopDong || '').includes('111') ? 'Hợp đồng lao động' : r.loaiHopDong ? 'Viên chức' : '')
    ).trim();
    const noiTinhBc = String(r.noiTinhBc ?? (r.hoTen ? unitNameVi : '')).trim();
    const nguon = String(r.nguon ?? r.ghiChu ?? '').trim();
    const trangThai = String(r.trangThai ?? (r.hoTen ? 'Đã kiểm chứng' : '')).trim();
    return { r, maNguonLuc, loaiNhanLuc, noiTinhBc, nguon, trangThai };
  });

  const codeCounts = new Map<string, number>();
  for (const item of prepped) {
    if (!item.maNguonLuc) continue;
    const key = item.maNguonLuc.toUpperCase();
    codeCounts.set(key, (codeCounts.get(key) || 0) + 1);
  }

  // Bước 2: tính Cột D (Giờ quy đổi/năm) và Cột J (Cảnh báo 5 điều kiện chuẩn HD07)
  return prepped.map(({ r, maNguonLuc, loaiNhanLuc, noiTinhBc, nguon, trangThai }) => {
    const codeUpper = String(r.maVtvl || '').trim().toUpperCase();
    const rawGioRieng = r.gioRieng;
    const hasGioRieng = !isBlank(rawGioRieng) && !Number.isNaN(Number(rawGioRieng)) && Number(rawGioRieng) > 0;
    const c1Std = codeUpper ? (c1HoursByCode.get(codeUpper) || 0) : 0;

    // Công thức Cột D: =IF(B="","",IF(ISNUMBER(K),K,IFERROR(INDEX(C1!E,MATCH(B,C1!A,0)),"")))
    const gioQuyDoiNam: number | '' = !codeUpper
      ? ''
      : hasGioRieng
      ? Number(rawGioRieng)
      : (c1Std > 0 ? c1Std : '');

    const rawChoVtvl = r.gioChoVtvl;
    const rawViecKhac = r.gioViecKhac;
    const gioChoVtvl: number | '' = isBlank(rawChoVtvl) ? '' : Number(rawChoVtvl);
    const gioViecKhac: number | '' = isBlank(rawViecKhac) ? '' : Number(rawViecKhac);

    // Công thức Cột J (5 điều kiện theo đúng thứ tự ưu tiên HD07)
    let canhBao = '';
    if (maNguonLuc) {
      const dupCount = codeCounts.get(maNguonLuc.toUpperCase()) || 0;
      if (dupCount > 1) {
        canhBao = 'TRÙNG MÃ NGUỒN LỰC';
      } else if (!noiTinhBc) {
        canhBao = 'THIẾU NƠI TÍNH BIÊN CHẾ';
      } else if (
        gioQuyDoiNam === '' ||
        gioChoVtvl === '' ||
        gioViecKhac === '' ||
        !nguon ||
        trangThai !== 'Đã kiểm chứng'
      ) {
        canhBao = 'Chưa đủ căn cứ';
      } else if (Number(gioChoVtvl) + Number(gioViecKhac) > Number(gioQuyDoiNam)) {
        canhBao = 'Vượt quỹ giờ';
      } else {
        canhBao = 'Đạt';
      }
    }

    return {
      ...r,
      maNguonLuc,
      loaiNhanLuc,
      gioQuyDoiNam,
      gioChoVtvl,
      gioViecKhac,
      noiTinhBc,
      nguon,
      trangThai,
      canhBao,
      gioRieng: rawGioRieng ?? ''
    };
  });
}
