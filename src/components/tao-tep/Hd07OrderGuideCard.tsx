'use client';

import React, { useState, useMemo } from 'react';
import { BookOpenCheck, FileText, Layers, Download, Award, Briefcase, Database, Eye, Copy, Check, X, ListOrdered } from 'lucide-react';
import { HD07_12_STEP_ORDER, HD07_CONSTANTS, HD07_EIGHT_STEPS_PROCESS, HD07_SIX_PRODUCT_GROUPS } from '@/configs/hcmute-hd07-catalog';
import { ND232_2026_VTVL_CATALOG, Nd232PositionCatalogItem } from '@/configs/hcmute-nd232-catalog';
import { DM_CHUC_DANH_TT31_TABLE, ERD_ENTITIES_CATALOG } from '@/configs/hcmute-erd-tables';
import { HcmuteUnit, SplitResultSummary } from '@/types/vtvl';

interface Props {
  unit: HcmuteUnit;
  splitResult: SplitResultSummary | null;
}

type GroupFilter = 'ALL' | Nd232PositionCatalogItem['appendix'];

export function Hd07OrderGuideCard({ unit, splitResult }: Props) {
  const [tab, setTab] = useState<'8buoc' | 'nd232' | 'erd' | 'tt31' | '12buoc' | '6nhom'>('8buoc');
  const [appendixFilter, setAppendixFilter] = useState<GroupFilter>('ALL');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [copiedToTrinh, setCopiedToTrinh] = useState(false);

  const filteredNd232 =
    appendixFilter === 'ALL'
      ? ND232_2026_VTVL_CATALOG
      : ND232_2026_VTVL_CATALOG.filter((item) => item.appendix === appendixFilter);

  const toTrinhText = useMemo(() => {
    const fteTotal = splitResult ? splitResult.totalStandardFte : unit.defaultStaffCount;
    const vtvlCount = splitResult ? splitResult.vtvlCount : 8;
    const taskCount = splitResult ? splitResult.taskCount : 8;

    return `TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM
ĐƠN VỊ: ${unit.nameVi.toUpperCase()} (${unit.code})
--------------------------------------------------
Số: ....../TTr-${unit.code}
Tp. Hồ Chí Minh, ngày 07 tháng 11 năm 2026

TỜ TRÌNH
Về việc thẩm định, phê duyệt danh mục vị trí việc làm cụ thể tại đơn vị (Phụ lục II HD 1907/HD-ĐHCNKT),
bổ nhiệm chức danh nhà giáo theo Thông tư số 31/2026/TT-BGDĐT và phương án biên chế 2027–2031

Kính gửi:
- Ban Giám hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE);
- Phòng Tổ chức - Nhân sự (TCNS).

Căn cứ Luật Nhà giáo số 73/2025/QH15; Nghị định số 232/2026/NĐ-CP của Chính phủ;
Căn cứ Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026 của Bộ trưởng Bộ Giáo dục và Đào tạo;
Căn cứ Hướng dẫn số 02 (số 1907/HD-ĐHCNKT ngày 17/6/2026) của Hiệu trưởng Trường Đại học Công nghệ Kỹ thuật TP.HCM về việc thực hiện xây dựng danh mục vị trí - năng lực vị trí việc làm giai đoạn 2026–2030;
Căn cứ Hướng dẫn số 07-HD/BTCTW về xây dựng, quản lý vị trí việc làm và cơ cấu viên chức;

${unit.nameVi} (${unit.nameEn}) kính trình Ban Giám hiệu và Phòng Tổ chức - Nhân sự thẩm định bộ hồ sơ Vị trí việc làm của đơn vị với các kết quả chính như sau:

1. Danh mục vị trí việc làm cụ thể tại đơn vị và Bậc nghề nghiệp sử dụng (theo Phụ lục I & Phụ lục II Hướng dẫn số 1907/HD-ĐHCNKT):
- Phân loại theo 04 nhóm vị trí việc làm của Trường: (I) Nhóm VTVL Quản lý (Không áp dụng bậc); (II) Nhóm VTVL Chuyên môn, nghiệp vụ (Giảng viên cao cấp: Bậc 5; Giảng viên chính: Bậc 4; Giảng viên: Bậc 3; Nghiên cứu viên hạng III: Bậc 3; Chuyên viên / Thư ký khoa: Từ bậc 3 đến bậc 4); (III) Nhóm VTVL Hỗ trợ (Trợ giảng: Bậc 3; Nhân sự phụ trách xưởng/phòng thí nghiệm: Bậc 2; Thủ quỹ: Bậc 2); (IV) Nhóm VTVL Phục vụ (Nhân viên kỹ thuật, lái xe, bảo vệ, lễ tân: Từ bậc 1 đến bậc 2).
- Đặt "Tên VTVL cụ thể tại đơn vị" theo đúng công thức của Trường: [Khung VTVL của Trường] + [lĩnh vực phụ trách hoặc đánh số thứ tự].

2. Kết quả định lượng khối lượng công việc và xác định nhu cầu nhân lực:
- Kỳ thống kê khối lượng công việc (Biểu B1, B2_CT): ${HD07_CONSTANTS.STATISTICAL_PERIOD}; Thời điểm chốt nhân lực D1: ${HD07_CONSTANTS.STAFF_CUTOFF_DATE}.
- Tổng số vị trí việc làm (Biểu 3. C1_VTVL): ${vtvlCount} vị trí; Tổng số đầu việc gắn sản phẩm chuẩn (Biểu 2. A2 & 4. B1): ${taskCount} công việc.
- Tổng nhu cầu nhân lực xác định theo phương pháp kết hợp PP1, PP2 (Biểu 8. C3_NhuCau): ${fteTotal} người (FTE).

${unit.nameVi} kính trình Ban Giám hiệu và Phòng Tổ chức - Nhân sự xem xét, thẩm định./.

Nơi nhận:                                      ${unit.headTitleVi.toUpperCase()}
- Như trên;                                    (Ký và ghi rõ họ tên)
- Lưu: VT, ${unit.code}.`;
  }, [unit, splitResult]);

  const handleDownloadToTrinh = () => {
    const blob = new Blob([toTrinhText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `To_Trinh_VTVL_${unit.code}_HD1907_ND232_20261107.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToTrinh = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(toTrinhText);
    }
    setCopiedToTrinh(true);
    setTimeout(() => setCopiedToTrinh(false), 2000);
  };

  const tabBtnClass = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors ${
      active ? 'bg-[var(--primary)] text-white shadow-2xs' : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border-subtle)] hover:border-[var(--primary)]'
    }`;

  return (
    <div className="surface-canvas rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-[var(--primary)]" />
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">Quy trình 08 bước &amp; 10 biểu HD 07-HD/BTCTW · Khung 38 VTVL HCM-UTE · TT 31/2026/TT-BGDĐT</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setTab('8buoc')} className={tabBtnClass(tab === '8buoc')}><ListOrdered className="w-3.5 h-3.5" /><span>Quy trình 08 bước &amp; 10 biểu HD 07</span></button>
          <button type="button" onClick={() => setTab('nd232')} className={tabBtnClass(tab === 'nd232')}><Briefcase className="w-3.5 h-3.5" /><span>Khung 38 VTVL Trường (04 nhóm)</span></button>
          <button type="button" onClick={() => setTab('erd')} className={tabBtnClass(tab === 'erd')}><Database className="w-3.5 h-3.5" /><span>Bảng chuẩn ERD (18 bảng)</span></button>
          <button type="button" onClick={() => setTab('tt31')} className={tabBtnClass(tab === 'tt31')}><Award className="w-3.5 h-3.5" /><span>DM_CHUC_DANH_TT31 (28 mã)</span></button>
          <button type="button" onClick={() => setTab('12buoc')} className={tabBtnClass(tab === '12buoc')}>12 bước nhập bảng</button>
          <button type="button" onClick={() => setTab('6nhom')} className={tabBtnClass(tab === '6nhom')}>06 nhóm SP (I–VI)</button>
        </div>
      </div>

      {tab === '8buoc' && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)]">
                <th className="py-2 px-3 text-left">Bước (Quy trình 08 bước HD 07)</th>
                <th className="py-2 px-3 text-left">Phụ lục</th>
                <th className="py-2 px-3 text-left">Biểu sử dụng (10 biểu A1–D2)</th>
                <th className="py-2 px-3 text-left">Giai đoạn Web</th>
                <th className="py-2 px-3 text-left">Kết quả đầu ra &amp; Điều kiện được tính</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {HD07_EIGHT_STEPS_PROCESS.map((item) => (
                <tr key={item.step}>
                  <td className="py-2 px-3 font-bold text-[var(--foreground)]">{item.title}</td>
                  <td className="py-2 px-3 font-semibold text-[var(--primary)] whitespace-nowrap">{item.appendix}</td>
                  <td className="py-2 px-3 font-bold text-[var(--primary)] whitespace-nowrap">{item.sheets}</td>
                  <td className="py-2 px-3 font-semibold whitespace-nowrap">{item.webStage}</td>
                  <td className="py-2 px-3 text-[11px] text-[var(--ink-muted)]"><span className="text-[var(--foreground)] font-medium">{item.result}</span> <span className="block italic mt-0.5">Điều kiện: {item.condition}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'nd232' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'I. Quản lý', 'II. Chuyên môn, nghiệp vụ', 'III. Hỗ trợ', 'IV. Phục vụ'] as const).map((ap) => (
                <button key={ap} type="button" onClick={() => setAppendixFilter(ap)} className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${appendixFilter === ap ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-secondary)] text-[var(--ink-muted)] border border-[var(--border-subtle)]'}`}>
                  {ap === 'ALL' ? `Tất cả 04 nhóm (${ND232_2026_VTVL_CATALOG.length} vị trí khung)` : ap}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-[var(--ink-muted)]">Phụ lục I — Hướng dẫn số 02 (1907/HD-ĐHCNKT ngày 17/6/2026)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] max-h-80">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)] sticky top-0">
                  <th className="py-2 px-2.5 text-left">TT</th>
                  <th className="py-2 px-2.5 text-left">Nhóm VTVL (04 nhóm)</th>
                  <th className="py-2 px-2.5 text-left">Tên khung VTVL của Trường</th>
                  <th className="py-2 px-2.5 text-left">Giới hạn Bậc nghề nghiệp</th>
                  <th className="py-2 px-2.5 text-left">Công thức đặt Tên VTVL cụ thể tại đơn vị</th>
                  <th className="py-2 px-2.5 text-left">Loại hình đơn vị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredNd232.map((item) => (
                  <tr key={item.maDanhMucNd232}>
                    <td className="py-2 px-2.5 font-bold text-[var(--primary)] whitespace-nowrap">{item.ttToanTruong} <span className="text-[10px] text-[var(--ink-muted)]">({item.ttTrongNhom})</span></td>
                    <td className="py-2 px-2.5 font-semibold whitespace-nowrap">{item.appendix}</td>
                    <td className="py-2 px-2.5 font-bold text-[var(--foreground)]">{item.positionName}</td>
                    <td className="py-2 px-2.5 font-semibold text-[var(--fix)] whitespace-nowrap">{item.careerLevel}</td>
                    <td className="py-2 px-2.5 text-[11px] font-medium text-[var(--foreground)]">{item.namingFormulaRule}</td>
                    <td className="py-2 px-2.5 text-[11px] text-[var(--ink-muted)]">{item.hcmuteUnitsHint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'erd' && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] max-h-80">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)] sticky top-0">
                <th className="py-2 px-3 text-left">Bảng thực thể (ERD)</th>
                <th className="py-2 px-3 text-left">Sheet Excel (.xlsx)</th>
                <th className="py-2 px-3 text-left">Khóa chính (PK) &amp; Khóa ngoại (FK)</th>
                <th className="py-2 px-3 text-right">Số cột</th>
                <th className="py-2 px-3 text-left">Các trường dữ liệu chuẩn &amp; Căn cứ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {ERD_ENTITIES_CATALOG.map((ent) => (
                <tr key={ent.tableCode}>
                  <td className="py-2 px-3 whitespace-nowrap"><code className="font-bold text-[var(--primary)]">{ent.tableCode}</code><span className="block text-[11px] text-[var(--ink-muted)]">{ent.tableNameVi}</span></td>
                  <td className="py-2 px-3 font-semibold whitespace-nowrap">{ent.excelSheet}</td>
                  <td className="py-2 px-3 text-[11px]"><span className="font-bold text-[var(--fix)]">PK: {ent.primaryKey}</span>{ent.foreignKeys !== '—' && <span className="block text-[var(--ink-muted)]">FK: {ent.foreignKeys}</span>}</td>
                  <td className="py-2 px-3 text-right font-bold tabular-nums">{ent.columnCount}</td>
                  <td className="py-2 px-3 text-[11px] text-[var(--ink-muted)]"><span className="text-[var(--foreground)]">{ent.keyColumnsSummary}</span><span className="block italic mt-0.5">{ent.legalBasis}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tt31' && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] max-h-80">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)] sticky top-0">
                <th className="py-2 px-3 text-left">PK (ma_so_chuc_danh)</th>
                <th className="py-2 px-3 text-left">ten_chuc_danh (TT 31/2026/TT-BGDĐT)</th>
                <th className="py-2 px-3 text-left">Điều khoản</th>
                <th className="py-2 px-3 text-left">Loại VC</th>
                <th className="py-2 px-3 text-left">Hệ số lương</th>
                <th className="py-2 px-3 text-left">Chuyển tiếp &amp; Ghi chú bổ nhiệm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {DM_CHUC_DANH_TT31_TABLE.map((row) => (
                <tr key={row.maSoChucDanh}>
                  <td className="py-2 px-3 font-bold text-[var(--primary)] whitespace-nowrap">{row.maSoChucDanh}</td>
                  <td className="py-2 px-3 font-bold text-[var(--foreground)]">{row.tenChucDanh}</td>
                  <td className="py-2 px-3 text-[11px] whitespace-nowrap">{row.khoanDieuTt31}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{row.loaiVienChuc}</td>
                  <td className="py-2 px-3 font-semibold text-[var(--fix)] whitespace-nowrap">{row.khungHeSoLuong}</td>
                  <td className="py-2 px-3 text-[11px] text-[var(--ink-muted)]">{row.ghiChuBoNhiem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === '12buoc' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {HD07_12_STEP_ORDER.map((item) => (
            <div key={item.step} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-2.5 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-[var(--primary)] text-white font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums mt-0.5">{item.step}</span>
              <div><code className="font-bold text-[var(--primary)] text-[11px]">{item.sheet}</code><p className="text-[var(--foreground)] leading-snug mt-0.5">{item.title}</p></div>
            </div>
          ))}
        </div>
      )}

      {tab === '6nhom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {HD07_SIX_PRODUCT_GROUPS.map((g) => (
            <div key={g.roman} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-2.5 space-y-1">
              <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-[var(--primary)]" /><strong className="text-[var(--foreground)]">{g.name}</strong></div>
              <p className="text-[11px] text-[var(--ink-muted)]">Ví dụ: {g.examples}</p>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[var(--ink-muted)]">
          <FileText className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <span>Dự thảo <strong>Tờ trình thẩm định Đề án VTVL [{unit.code}]</strong> (theo HD 1907/HD-ĐHCNKT, NĐ 232/2026 &amp; TT 31/2026):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowPreviewModal((p) => !p)} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] text-[var(--foreground)] font-bold text-xs cursor-pointer">
            <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>{showPreviewModal ? 'Đóng xem trước' : 'Xem trước Tờ trình'}</span>
          </button>
          <button type="button" onClick={handleCopyToTrinh} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] text-[var(--foreground)] font-bold text-xs cursor-pointer">
            {copiedToTrinh ? <><Check className="w-3.5 h-3.5 text-[var(--ok)]" /><span className="text-[var(--ok)]">Đã sao chép văn bản</span></> : <><Copy className="w-3.5 h-3.5 text-[var(--primary)]" /><span>Sao chép nội dung</span></>}
          </button>
          <button type="button" onClick={handleDownloadToTrinh} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl bg-[var(--primary)] text-white font-bold text-xs cursor-pointer shadow-2xs">
            <Download className="w-3.5 h-3.5" />
            <span>Tải tệp Tờ trình (.txt)</span>
          </button>
        </div>
      </div>

      {showPreviewModal && (
        <div role="region" aria-label="Xem trước nội dung dự thảo Tờ trình" className="rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-secondary)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
            <strong className="text-xs sm:text-sm font-bold text-[var(--foreground)]">Xem trước nội dung dự thảo Tờ trình — {unit.nameVi} ({unit.code})</strong>
            <button type="button" onClick={() => setShowPreviewModal(false)} aria-label="Đóng khung xem trước" className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--sheet)] cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-[var(--sheet)] border border-[var(--border-subtle)] rounded-xl p-4 max-h-80 overflow-y-auto text-[var(--foreground)]">{toTrinhText}</pre>
        </div>
      )}
    </div>
  );
}
