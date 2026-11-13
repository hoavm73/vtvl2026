export interface DmChucDanhTt31Row {
  maSoChucDanh: string; // PK: V.07.01.01 .. V.07.02.26 + V.07.01.23
  tenChucDanh: string;
  khoanDieuTt31: string;
  loaiVienChuc: string;
  khungHeSoLuong: string;
  dienChuyenTiep: boolean;
  ghiChuBoNhiem: string;
}

export const DM_CHUC_DANH_TT31_TABLE: DmChucDanhTt31Row[] = [
  // Khoản 9 Điều 2 & Điều 14 — Giảng viên đại học
  { maSoChucDanh: 'V.07.01.01', tenChucDanh: 'Giảng viên cao cấp', khoanDieuTt31: 'K9 Đ2 & Đ14', loaiVienChuc: 'A3.1', khungHeSoLuong: '6,20 – 8,00', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV cao cấp (hạng I) V.07.01.01; GS/PGS theo K3 Đ14 & NĐ 93/2026' },
  { maSoChucDanh: 'V.07.01.02', tenChucDanh: 'Giảng viên chính', khoanDieuTt31: 'K9 Đ2 & Đ14', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV chính (hạng II) V.07.01.02' },
  { maSoChucDanh: 'V.07.01.03', tenChucDanh: 'Giảng viên', khoanDieuTt31: 'K9 Đ2 & Đ14', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV (hạng III) V.07.01.03 hoặc Trợ giảng đủ chuẩn (điểm a K5 Đ15)' },
  // Khoản 5 Điều 15 — Trợ giảng diện chuyển tiếp
  { maSoChucDanh: 'V.07.01.23', tenChucDanh: 'Trợ giảng (diện chuyển tiếp)', khoanDieuTt31: 'Khoản 5 Đ15', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: true, ghiChuBoNhiem: 'Trước 31/3/2026 đủ chuẩn xét sang V.07.01.03; đề án trước 30/6/2026 theo K1 Đ25 NĐ 93/2026' },
  // Khoản 8 Điều 2 & Điều 13 — Giảng viên cao đẳng
  { maSoChucDanh: 'V.09.02.01', tenChucDanh: 'Giảng viên cao cấp (Cao đẳng)', khoanDieuTt31: 'K8 Đ2 & Đ13', loaiVienChuc: 'A3.1', khungHeSoLuong: '6,20 – 8,00', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN cao cấp V.09.02.01 hoặc GV CĐSP cao cấp V.07.08.20' },
  { maSoChucDanh: 'V.09.02.02', tenChucDanh: 'Giảng viên chính (Cao đẳng)', khoanDieuTt31: 'K8 Đ2 & Đ13', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN chính V.09.02.02 hoặc GV CĐSP chính V.07.08.21' },
  { maSoChucDanh: 'V.09.02.03', tenChucDanh: 'Giảng viên (Cao đẳng)', khoanDieuTt31: 'K8 Đ2 & Đ13', loaiVienChuc: 'A1 / A0', khungHeSoLuong: '2,34–4,98 / 2,10–4,89', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ V.09.02.03 (A1), V.09.02.04 (A0) hoặc V.07.08.22 (A1)' },
  // Khoản 7 Điều 2 & Điều 12 — Giáo viên trung cấp (TPC)
  { maSoChucDanh: 'V.09.02.05', tenChucDanh: 'Giáo viên trung cấp hạng I', khoanDieuTt31: 'K7 Đ2 & Đ12', loaiVienChuc: 'A3.2', khungHeSoLuong: '5,75 – 7,55', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN cao cấp (hạng I) V.09.02.05' },
  { maSoChucDanh: 'V.09.02.06', tenChucDanh: 'Giáo viên trung cấp hạng II', khoanDieuTt31: 'K7 Đ2 & Đ12', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN chính (hạng II) V.09.02.06' },
  { maSoChucDanh: 'V.09.02.07', tenChucDanh: 'Giáo viên trung cấp hạng III', khoanDieuTt31: 'K7 Đ2 & Đ12', loaiVienChuc: 'A1 / A0', khungHeSoLuong: '2,34–4,98 / 2,10–4,89', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN lý thuyết V.09.02.07 (A1) hoặc thực hành V.09.02.08 (A0)' },
  // Khoản 6 Điều 2 & Điều 11 — Giáo viên sơ cấp
  { maSoChucDanh: 'V.09.02.11', tenChucDanh: 'Giáo viên sơ cấp hạng I', khoanDieuTt31: 'K6 Đ2 & Đ11', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Theo khoản 1 Điều 11 TT 31/2026/TT-BGDĐT' },
  { maSoChucDanh: 'V.09.02.10', tenChucDanh: 'Giáo viên sơ cấp hạng II', khoanDieuTt31: 'K6 Đ2 & Đ11', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Theo khoản 1 Điều 11 TT 31/2026/TT-BGDĐT' },
  { maSoChucDanh: 'V.09.02.09', tenChucDanh: 'Giáo viên sơ cấp hạng III', khoanDieuTt31: 'K6 Đ2 & Đ11', loaiVienChuc: 'Loại B', khungHeSoLuong: '1,86 – 4,06', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV GDNN (hạng IV) V.09.02.09 (khoản 2 Điều 11)' },
  // Khoản 5 Điều 2 & Điều 10 — Giáo viên dự bị đại học
  { maSoChucDanh: 'V.07.07.17', tenChucDanh: 'Giáo viên dự bị đại học hạng I', khoanDieuTt31: 'K5 Đ2 & Đ10', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV dự bị ĐH hạng I V.07.07.17' },
  { maSoChucDanh: 'V.07.07.18', tenChucDanh: 'Giáo viên dự bị đại học hạng II', khoanDieuTt31: 'K5 Đ2 & Đ10', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV dự bị ĐH hạng II V.07.07.18' },
  { maSoChucDanh: 'V.07.07.19', tenChucDanh: 'Giáo viên dự bị đại học hạng III', khoanDieuTt31: 'K5 Đ2 & Đ10', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV dự bị ĐH hạng III V.07.07.19' },
  // Khoản 4 Điều 2 & Điều 9 — Giáo viên THPT (TPC)
  { maSoChucDanh: 'V.07.05.13', tenChucDanh: 'Giáo viên THPT hạng I', khoanDieuTt31: 'K4 Đ2 & Đ9', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THPT hạng I V.07.05.13' },
  { maSoChucDanh: 'V.07.05.14', tenChucDanh: 'Giáo viên THPT hạng II', khoanDieuTt31: 'K4 Đ2 & Đ9', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THPT hạng II V.07.05.14' },
  { maSoChucDanh: 'V.07.05.15', tenChucDanh: 'Giáo viên THPT hạng III', khoanDieuTt31: 'K4 Đ2 & Đ9', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THPT hạng III V.07.05.15' },
  // Khoản 3 Điều 2 & Điều 8 — Giáo viên THCS
  { maSoChucDanh: 'V.07.04.30', tenChucDanh: 'Giáo viên THCS hạng I', khoanDieuTt31: 'K3 Đ2 & Đ8', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THCS hạng I V.07.04.30' },
  { maSoChucDanh: 'V.07.04.31', tenChucDanh: 'Giáo viên THCS hạng II', khoanDieuTt31: 'K3 Đ2 & Đ8', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THCS hạng II V.07.04.31' },
  { maSoChucDanh: 'V.07.04.32', tenChucDanh: 'Giáo viên THCS hạng III', khoanDieuTt31: 'K3 Đ2 & Đ8', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV THCS hạng III V.07.04.32' },
  // Khoản 2 Điều 2 & Điều 7 — Giáo viên tiểu học
  { maSoChucDanh: 'V.07.03.27', tenChucDanh: 'Giáo viên tiểu học hạng I', khoanDieuTt31: 'K2 Đ2 & Đ7', loaiVienChuc: 'A2.1', khungHeSoLuong: '4,40 – 6,78', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV tiểu học hạng I V.07.03.27' },
  { maSoChucDanh: 'V.07.03.28', tenChucDanh: 'Giáo viên tiểu học hạng II', khoanDieuTt31: 'K2 Đ2 & Đ7', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV tiểu học hạng II V.07.03.28' },
  { maSoChucDanh: 'V.07.03.29', tenChucDanh: 'Giáo viên tiểu học hạng III', khoanDieuTt31: 'K2 Đ2 & Đ7', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV tiểu học hạng III V.07.03.29' },
  // Khoản 1 Điều 2 & Điều 6 — Giáo viên mầm non
  { maSoChucDanh: 'V.07.02.24', tenChucDanh: 'Giáo viên mầm non hạng I', khoanDieuTt31: 'K1 Đ2 & Đ6', loaiVienChuc: 'A2.2', khungHeSoLuong: '4,00 – 6,38', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV mầm non hạng I V.07.02.24' },
  { maSoChucDanh: 'V.07.02.25', tenChucDanh: 'Giáo viên mầm non hạng II', khoanDieuTt31: 'K1 Đ2 & Đ6', loaiVienChuc: 'A1', khungHeSoLuong: '2,34 – 4,98', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV mầm non hạng II V.07.02.25' },
  { maSoChucDanh: 'V.07.02.26', tenChucDanh: 'Giáo viên mầm non hạng III', khoanDieuTt31: 'K1 Đ2 & Đ6', loaiVienChuc: 'A0', khungHeSoLuong: '2,10 – 4,89', dienChuyenTiep: false, ghiChuBoNhiem: 'Chuyển từ GV mầm non hạng III V.07.02.26' }
];

export interface ErdEntitySchemaItem {
  tableCode: string;
  tableNameVi: string;
  excelSheet: string;
  primaryKey: string;
  foreignKeys: string;
  columnCount: number;
  keyColumnsSummary: string;
  legalBasis: string;
}

export const ERD_ENTITIES_CATALOG: ErdEntitySchemaItem[] = [
  { tableCode: 'dm_don_vi', tableNameVi: 'Danh mục 51 đơn vị thuộc/trực thuộc HCM-UTE', excelSheet: 'HUONG_DAN / 14. T_TienDo', primaryKey: 'ma_don_vi', foreignKeys: '—', columnCount: 9, keyColumnsSummary: 'ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, chuc_danh_thu_truong_vi, so_nhan_su_mac_dinh', legalBasis: 'Quy chế Tổ chức và Hoạt động HCM-UTE' },
  { tableCode: 'dm_vtvl_khung_truong', tableNameVi: 'Khung 38 vị trí việc làm của Trường theo 04 nhóm & Giới hạn bậc', excelSheet: '12. CHIA_VUNG_CAP_XA (Phần I)', primaryKey: 'ma_danh_muc_nd232', foreignKeys: 'ma_so_chuc_danh -> dm_chuc_danh_tt31', columnCount: 12, keyColumnsSummary: 'ma_danh_muc_nd232 (HD1907-I..IV), nhom_vtvl_4, ten_khung_vtvl_truong, gioi_han_bac_nghe_nghiep, ds_bac_cho_phep, cong_thuc_ten_cu_the', legalBasis: 'HD số 02 (1907/HD-ĐHCNKT) & Nghị định 232/2026/NĐ-CP' },
  { tableCode: 'dm_chuc_danh_tt31', tableNameVi: 'Danh mục 28 mã số chức danh & xếp lương nhà giáo', excelSheet: '12. CHIA_VUNG_CAP_XA (Phần II)', primaryKey: 'ma_so_chuc_danh', foreignKeys: '—', columnCount: 8, keyColumnsSummary: 'ma_so_chuc_danh (V.07.01.01..V.09.02.11), ten_chuc_danh, khoan_dieu_tt31, loai_vien_chuc, khung_he_so_luong, dien_chuyen_tiep', legalBasis: 'Thông tư 31/2026/TT-BGDĐT ngày 14/4/2026' },
  { tableCode: 'dm_san_pham', tableNameVi: 'Danh mục sản phẩm chuẩn 6 nhóm La Mã (I–VI)', excelSheet: '11. DM_SAN_PHAM / DM_06_NHOM', primaryKey: 'ma_sp_chuan', foreignKeys: '—', columnCount: 11, keyColumnsSummary: 'ma_sp_chuan (SP-I-01..SP-VI-01), ten_loai_sp, nhom_la_ma, phut_sp_chuan, van_ban_xac_nhan', legalBasis: 'Hướng dẫn 07-HD/BTCTW' },
  { tableCode: 'c1_vtvl', tableNameVi: 'Danh mục VTVL cụ thể tại đơn vị, Bậc nghề nghiệp & Quỹ giờ PP2', excelSheet: '3. C1_VTVL', primaryKey: 'ma_vtvl', foreignKeys: 'ma_don_vi -> dm_don_vi; ma_danh_muc_nd232 -> dm_vtvl_khung_truong', columnCount: 16, keyColumnsSummary: 'ma_vtvl, ma_don_vi, nhom_vtvl_4, ten_khung_vtvl_truong, ten_vtvl_cu_the_don_vi, bac_nghe_nghiep_su_dung, gio_chuan_pp2 (1.904h / 1.760h), nhu_cau_fte', legalBasis: 'Phụ lục II 1907/HD-ĐHCNKT, HD 07 & NĐ 232/2026' },
  { tableCode: 'a1_nhiem_vu', tableNameVi: 'Danh mục nhiệm vụ của đơn vị', excelSheet: '1. A1_NhiemVu', primaryKey: 'ma_nhiem_vu', foreignKeys: 'ma_don_vi -> dm_don_vi', columnCount: 8, keyColumnsSummary: 'ma_nhiem_vu ([MA_DV].NV01..99), ma_don_vi, ten_nhiem_vu, can_cu_phap_ly, ky_thong_ke, trang_thai_nv', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 1)' },
  { tableCode: 'a2_cong_viec', tableNameVi: 'Danh mục công việc và sản phẩm đầu ra', excelSheet: '2. A2_CongViec', primaryKey: 'ma_cong_viec', foreignKeys: 'ma_don_vi -> dm_don_vi; ma_nhiem_vu -> a1_nhiem_vu; ma_vtvl -> c1_vtvl; ma_sp_chuan -> dm_san_pham', columnCount: 11, keyColumnsSummary: 'ma_cong_viec ([MA_NV].CV01..99), ma_nhiem_vu, ma_vtvl, ten_cong_viec, ten_san_pham, nhom_la_ma, don_vi_tinh', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 2)' },
  { tableCode: 'b1_khoi_luong', tableNameVi: 'Thống kê sản lượng và thời gian làm việc thực tế (19 cột A–S)', excelSheet: '4. B1_KhoiLuong', primaryKey: 'ma_cong_viec', foreignKeys: 'ma_cong_viec -> a2_cong_viec; ma_don_vi -> dm_don_vi; ma_vtvl -> c1_vtvl; ma_sp_chuan -> dm_san_pham', columnCount: 18, keyColumnsSummary: 'ma_cong_viec, ma_vtvl, so_sp_nam, phut_sp_do_thuc_te, gio_sp_tinh, gio_tong_tinh, canh_bao_cot_r, giai_trinh_cot_s', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 4 — 19 cột A–S)' },
  { tableCode: 'b2_ct_tac_dong', tableNameVi: 'Chi tiết tác động chuyển đổi số, tự chủ, thuê dịch vụ', excelSheet: '5. B2_CT_TacDong', primaryKey: 'id_tac_dong', foreignKeys: 'ma_don_vi -> dm_don_vi; ma_cong_viec -> a2_cong_viec; ma_vtvl -> c1_vtvl', columnCount: 12, keyColumnsSummary: 'id_tac_dong, ma_cong_viec, ma_vtvl, loai_tac_dong, so_sp_ap_dung, phut_truoc, phut_sau, gio_giam_hop_le', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 5 — 19 cột A–S)' },
  { tableCode: 'b2_thay_doi', tableNameVi: 'Tổng hợp tác động ròng từ B2_CT', excelSheet: '6. B2_ThayDoi', primaryKey: 'ma_cong_viec', foreignKeys: 'ma_cong_viec -> a2_cong_viec; ma_don_vi -> dm_don_vi; ma_vtvl -> c1_vtvl', columnCount: 8, keyColumnsSummary: 'ma_cong_viec, ma_vtvl, gio_giam_so_hoa, gio_giam_thue_tc, gio_viec_moi, gio_tac_dong_rong', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 6 — 9 cột A–I)' },
  { tableCode: 'c2_nang_luc', tableNameVi: 'Bản mô tả công việc & Khung năng lực (Bậc 1–5)', excelSheet: '7. C2_NangLuc', primaryKey: 'ma_vtvl', foreignKeys: 'ma_vtvl -> c1_vtvl; ma_don_vi -> dm_don_vi', columnCount: 8, keyColumnsSummary: 'ma_vtvl, ma_don_vi, muc_tieu_vi_tri, trach_nhiem_chinh, khung_nang_luc_bac (Bậc 1–5), yeu_cau_trinh_do_chuyen_mon', legalBasis: 'Nghị định 232/2026/NĐ-CP & Biểu 7 HD07' },
  { tableCode: 'c3_nhu_cau', tableNameVi: 'Xác định nhu cầu nhân lực theo PP1, PP2, PP3', excelSheet: '8. C3_NhuCau', primaryKey: 'ma_vtvl', foreignKeys: 'ma_vtvl -> c1_vtvl; ma_don_vi -> dm_don_vi', columnCount: 11, keyColumnsSummary: 'ma_vtvl, ma_don_vi, phuong_phap, gio_b1_nam, gio_tac_dong_b2, gio_rong_nam, nguoi_quy_doi_pp2, nguoi_can_bo_tri', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 8 — 14 cột A–N)' },
  { tableCode: 'd1_nhan_luc', tableNameVi: 'Nguồn nhân lực hiện có chốt tại 30/9/2026', excelSheet: '9. D1_NhanLuc', primaryKey: 'ma_nguon_luc', foreignKeys: 'ma_don_vi -> dm_don_vi; ma_vtvl -> c1_vtvl', columnCount: 11, keyColumnsSummary: 'ma_nguon_luc ([MA_DV]-NL001..999), ma_don_vi, ma_vtvl, ho_va_ten, ma_ngach_chuc_danh, ty_le_phan_bo_chinh, canh_bao_d1', legalBasis: 'HD 07-HD/BTCTW & Khoản 5 Đ15 TT 31/2026' },
  { tableCode: 'du_bao_5_nam', tableNameVi: 'Dự báo thay đổi nhu cầu nhân lực 5 năm (2027–2031) — 10 cột A–J', excelSheet: '10. DU_BAO_5_NAM', primaryKey: '(ma_vtvl, nam)', foreignKeys: 'ma_vtvl -> c1_vtvl; ma_don_vi -> dm_don_vi', columnCount: 10, keyColumnsSummary: 'ma_vtvl, nam (2027..2031), bien_dong_so_c3, noi_dung_thay_doi, can_cu_nguon, trang_thai_xac_nhan, nguoi_c3_nam_co_so, nguoi_can_bo_tri_trong_nam, kiem_tra_doi_chieu, ghi_chu', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Sheet DU_BAO_5_NAM)' },
  { tableCode: 'd2_phuong_an', tableNameVi: 'Phương án biên chế giai đoạn 2027–2031', excelSheet: '11. D2_PhuongAn', primaryKey: '(ma_vtvl, nam_phuong_an)', foreignKeys: 'ma_vtvl -> c1_vtvl; ma_don_vi -> dm_don_vi', columnCount: 7, keyColumnsSummary: 'ma_vtvl, nam_phuong_an, ma_don_vi, so_nguoi_can_bo_tri, so_nguoi_hien_co, chenh_lech, phuong_an_dieu_chinh', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 10 — 14 cột A–N)' },
  { tableCode: 'k_kiem_tra', tableNameVi: 'Bảng kiểm soát chéo tự động 6 chỉ tiêu (H3:H8)', excelSheet: '13. K_KiemTra', primaryKey: '(ma_don_vi, stt_chi_tieu)', foreignKeys: 'ma_don_vi -> dm_don_vi', columnCount: 7, keyColumnsSummary: 'ma_don_vi, stt_chi_tieu (1..6), nhom_bieu_doi_soat, noi_dung_kiem_tra, so_dong_loi, ket_luan', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 13)' },
  { tableCode: 't_tien_do', tableNameVi: 'Tổng hợp tiến độ hoàn thiện bộ biểu đơn vị', excelSheet: '14. T_TienDo', primaryKey: 'ma_don_vi', foreignKeys: 'ma_don_vi -> dm_don_vi', columnCount: 10, keyColumnsSummary: 'ma_don_vi, ten_don_vi, phien_ban, so_nhiem_vu_a1, so_cong_viec_a2, so_vtvl_c1, tong_fte_c3, trang_thai_ra_soat', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 14)' },
  { tableCode: 's_nhat_ky', tableNameVi: 'Nhật ký phiên bản và lịch sử cập nhật dữ liệu', excelSheet: '15. S_NhatKy', primaryKey: 'id', foreignKeys: 'ma_don_vi -> dm_don_vi', columnCount: 7, keyColumnsSummary: 'id, ma_don_vi, ten_don_vi, hanh_dong, chi_tiet, phien_ban, created_at', legalBasis: 'Hướng dẫn 07-HD/BTCTW (Biểu 15)' }
];
