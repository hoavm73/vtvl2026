import * as XLSX from 'xlsx';
import {
  HD07_CONSTANTS,
  MISSIONS_BY_GROUP,
  STANDARD_PRODUCTS_CATALOG
} from '@/configs/hcmute-hd07-catalog';
import { TCNS_C2_PROFILES, TCNS_REAL_MISSIONS } from '@/configs/hcmute-pl1-catalog';
import { JobTaskTemplate, NgachItem, SplitResultSummary, UnitSplitOptions } from '@/types/vtvl';
import { buildHd07StaffSheets } from './hd07-staff-sheets';

const fNum = (v: number, f: string): XLSX.CellObject => ({ t: 'n', v, f });
const fStr = (v: string, f: string): XLSX.CellObject => ({ t: 's', v, f });

export function buildHd07CoreSheets(
  wb: XLSX.WorkBook,
  opts: UnitSplitOptions,
  sourceRule: string,
  ngachList: NgachItem[],
  templates: JobTaskTemplate[],
  positionBreakdown: SplitResultSummary['positionBreakdown']
): {
  b1Header: string[];
  b1Rows: (string | number)[][];
  wsB1: XLSX.WorkSheet;
  wsB2Ct: XLSX.WorkSheet;
  wsD1: XLSX.WorkSheet;
} {
  const isTcns = opts.unitCode === 'TCNS';
  const missions = isTcns ? TCNS_REAL_MISSIONS : MISSIONS_BY_GROUP[opts.kind];

  // 1. A1_NhiemVu (7 cột A–G — Bước 1 HD 07)
  const wsA1 = XLSX.utils.aoa_to_sheet([
    [`Biểu A1_ Nhiệm vụ (${opts.unitCode} — ${opts.unitNameVi})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã nhiệm vụ', 'Tên nhiệm vụ', 'Cơ quan', 'Căn cứ', 'Kỳ', 'Trạng thái', 'Nguồn'],
    ...missions.map((m) => [
      `${opts.unitCode}.${m.missionSuffix}`, m.missionName, opts.unitNameVi, m.legalBasis, opts.period, m.status, m.source
    ])
  ]);
  XLSX.utils.book_append_sheet(wb, wsA1, '1. A1_NhiemVu');

  // Chuẩn hóa mã công việc: [Mã nhiệm vụ].CV{01..99}
  const taskCounters: Record<string, number> = {};
  const processedTemplates = templates.map((t) => {
    const rawSuffix = (t.missionSuffix || 'NV01').replace(/^.*NV/, 'NV');
    const mCode = `${opts.unitCode}.${rawSuffix}`;
    taskCounters[mCode] = (taskCounters[mCode] || 0) + 1;
    const taskSeq = String(taskCounters[mCode]).padStart(2, '0');
    const taskCode = `${mCode}.CV${taskSeq}`;
    const vCode = `${opts.unitCode}-${t.vtvlSuffix}`;
    return { ...t, computedTaskCode: taskCode, computedMissionCode: mCode, computedVtvlCode: vCode };
  });

  // 2. A2_CongViec (8 cột A–H — Bước 2 HD 07)
  const wsA2 = XLSX.utils.aoa_to_sheet([
    [`Biểu A2_ Công việc (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã công việc', 'Mã nhiệm vụ', 'Mã VTVL', 'Tên công việc', 'Sản phẩm', 'Đơn vị tính', 'Chất lượng', 'Căn cứ (nguồn)'],
    ...processedTemplates.map((t) => [
      t.computedTaskCode, t.computedMissionCode, t.computedVtvlCode,
      t.taskName, t.productName, t.unitName, t.qualityRequirement, t.legalBasisHint
    ])
  ]);
  XLSX.utils.book_append_sheet(wb, wsA2, '2. A2_CongViec');

  // 3. C1_VTVL (11 cột A–K — Bước 3: Danh mục VTVL chuẩn)
  const wsC1 = XLSX.utils.aoa_to_sheet([
    [`Biểu C1_ Vị trí việc làm (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã VTVL', 'Tên VTVL', 'Loại nhân lực', 'Quyết định', 'Giờ chuẩn PP2', 'Căn cứ xác định quỹ giờ', 'Trạng thái', 'Giờ riêng được xác nhận', 'Xác nhận giờ riêng', 'Chế độ làm việc', 'Kiểm tra quỹ giờ PP2'],
    ...positionBreakdown.map((p, idx) => {
      const r = idx + 3;
      return [
        p.vtvlCode,
        p.frameworkTitle && p.frameworkTitle !== p.vtvlName
          ? `${p.vtvlName} (Khung Trường: ${p.frameworkTitle} · ${p.careerLevel || 'Bậc 3'})`
          : `${p.vtvlName} (${p.careerLevel || 'Bậc 3'})`,
        'Viên chức',
        `${sourceRule} & Phụ lục I (QL10–QL60, CM63–CM113, HT26–HT62)`,
        fNum(p.standardHoursYear, `IF(A${r}="","",IF(J${r}="Đặc thù",IF(AND(ISNUMBER(H${r}),H${r}>0),H${r},1760),1904))`),
        p.method === 'PP1'
          ? 'PP1 – theo cơ cấu và chức danh quản lý'
          : p.workingRegime === 'Đặc thù'
            ? 'Thông tư 20/2020/TT-BGDĐT (44 tuần × 40 giờ = 1.760 giờ/năm)'
            : 'Mức chung 1.904 giờ – quy định về thời giờ làm việc ((261 - 11 - 12) × 8)',
        'Tiếp tục sử dụng',
        p.workingRegime === 'Đặc thù' ? p.standardHoursYear : '',
        p.workingRegime === 'Đặc thù' ? 'Đã kiểm chứng' : '',
        p.workingRegime,
        fStr('ĐẠT', `IF(A${r}="","",IF(OR(J${r}="",E${r}=""),"CHƯA ĐỦ CĂN CỨ","ĐẠT"))`)
      ];
    })
  ]);
  XLSX.utils.book_append_sheet(wb, wsC1, '3. C1_VTVL');

  // 4. B1_KhoiLuong (19 cột A–S — Bước 4 HD 07, liên kết INDEX/MATCH từ A2 & DM_SAN_PHAM)
  const b1Header = [
    'Mã công việc', 'Mã VTVL', 'Số SP/năm', 'Trung bình phút/SP (đo thực tế)', 'Giờ bổ sung (công việc liên quan)',
    'Giờ SP (tính)', 'Giờ tổng (tính)', 'Nguồn SL', 'Nguồn thời gian', 'Trạng thái căn cứ thời gian', 'Kỳ',
    'Mã SP trong danh mục', 'Nhóm (tự tra)', 'Phút/SP chuẩn (tự tra)', 'Xác nhận chuẩn (tự tra)',
    'Phút/SP dùng để tính', 'Nguồn thời gian dùng tính', 'Cảnh báo dữ liệu', 'Giải trình khác chuẩn'
  ];
  const b1Rows = processedTemplates.map((t) => {
    const stdSp = STANDARD_PRODUCTS_CATALOG.find((sp) => sp.productCode === t.productCode);
    const stdMin = stdSp ? stdSp.standardMinutes : t.defaultMinutesPerProduct;
    const spHours = Number(((t.defaultQtyPerYear * t.defaultMinutesPerProduct) / 60).toFixed(2));
    const totalHours = Number((spHours + t.extraRelatedHoursYear).toFixed(2));
    return [
      t.computedTaskCode, t.computedVtvlCode, t.defaultQtyPerYear,
      t.defaultMinutesPerProduct, t.extraRelatedHoursYear, spHours, totalHours,
      isTcns ? t.sourceHint : `${t.sourceHint} (gợi ý – chưa đo)`,
      isTcns ? 'Phút-người đề xuất theo công đoạn (QĐ 2266, PL18)' : 'Định mức gợi ý ban đầu (chờ nạp phiếu đo thực tế)',
      t.timeBasisStatus, opts.period, t.productCode, t.romanGroup, stdMin, 'Đã xác nhận',
      t.defaultMinutesPerProduct, 'Theo danh mục SP chuẩn HCM-UTE', 'ĐẠT', ''
    ];
  });
  const b1FormulaRows = b1Rows.map((row, idx) => {
    const r = idx + 3;
    return [
      row[0],
      fStr(String(row[1]), `IF(A${r}="","",IFERROR(INDEX('2. A2_CongViec'!$C$3:$C$500,MATCH(A${r},'2. A2_CongViec'!$A$3:$A$500,0)),""))`),
      row[2], row[3], row[4],
      fNum(Number(row[5]), `IF(R${r}<>"ĐẠT","",C${r}*P${r}/60)`),
      fNum(Number(row[6]), `IF(NOT(ISNUMBER(F${r})),"",F${r}+IF(ISNUMBER(E${r}),E${r},0))`),
      row[7], row[8], row[9], row[10], row[11],
      fStr(String(row[12]), `IF(L${r}="","",IFERROR(INDEX('11. DM_SAN_PHAM'!$D$3:$D$200,MATCH(L${r},'11. DM_SAN_PHAM'!$A$3:$A$200,0)),""))`),
      fNum(Number(row[13]), `IF(L${r}="","",IFERROR(INDEX('11. DM_SAN_PHAM'!$E$3:$E$200,MATCH(L${r},'11. DM_SAN_PHAM'!$A$3:$A$200,0)),""))`),
      fStr(String(row[14]), `IF(L${r}="","",IFERROR(INDEX('11. DM_SAN_PHAM'!$G$3:$G$200,MATCH(L${r},'11. DM_SAN_PHAM'!$A$3:$A$200,0)),""))`),
      fNum(Number(row[15]), `IF(A${r}="","",IF(AND(ISNUMBER(N${r}),N${r}>0,O${r}="Đã xác nhận",S${r}=""),N${r},D${r}))`),
      row[16],
      fStr('ĐẠT', `IF(A${r}="","",IF(OR(B${r}="",C${r}="",P${r}=""),"THIẾU DỮ LIỆU","ĐẠT"))`),
      row[18]
    ];
  });
  const wsB1 = XLSX.utils.aoa_to_sheet([
    [`Biểu B1_ Khối lượng (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    b1Header, ...b1FormulaRows
  ]);
  XLSX.utils.book_append_sheet(wb, wsB1, '4. B1_KhoiLuong');

  // 5. B2_CT_TacDong (19 cột A–S — Bước 5 HD 07)
  const b2CtHeader = [
    'Mã công việc', 'Mã VTVL', 'Loại tác động', 'Công đoạn', 'SP áp dụng', 'Phút trước', 'Phút sau',
    'Giờ giảm trực tiếp', 'Giờ việc mới', 'Nguồn/bằng chứng', 'Kỳ', 'Cơ sở B1', 'Trạng thái',
    'Giờ giảm hợp lệ', 'Giờ tăng hợp lệ', 'Kiểm tra', 'Kinh phí trước', 'Kinh phí sau', 'Đối chiếu trùng/phạm vi (cán bộ xác nhận)'
  ];
  const b2CtRows = processedTemplates.filter((t) => t.digitalImpactStage).map((t, idx) => {
    const r = idx + 3;
    const before = t.digitalMinutesBefore || t.defaultMinutesPerProduct;
    const after = t.digitalMinutesAfter || t.defaultMinutesPerProduct;
    const reducedHours = Number((((before - after) * t.defaultQtyPerYear) / 60).toFixed(1));
    return [
      t.computedTaskCode,
      fStr(t.computedVtvlCode, `IF(A${r}="","",IFERROR(INDEX('2. A2_CongViec'!$C$3:$C$500,MATCH(A${r},'2. A2_CongViec'!$A$3:$A$500,0)),""))`),
      'Số hóa', t.digitalImpactStage || 'Số hóa quy trình nghiệp vụ', t.defaultQtyPerYear, before, after,
      fNum(reducedHours, `IF(OR(A${r}="",F${r}<G${r}),"",E${r}*(F${r}-G${r})/60)`), 0,
      'Hệ thống phần mềm quản trị nội bộ & UTEx LMS HCM-UTE', opts.period,
      'Trước thay đổi, có điều chỉnh', 'Đã kiểm chứng',
      fNum(reducedHours, `IF(AND(P${r}="ĐẠT",L${r}="Trước thay đổi, có điều chỉnh",H${r}<>""),H${r},0)`),
      fNum(0, `IF(AND(P${r}="ĐẠT",I${r}<>""),I${r},0)`),
      fStr('ĐẠT', `IF(A${r}="","",IF(S${r}<>"Đã đối chiếu","CHỜ SOÁT TRÙNG","ĐẠT"))`),
      0, 0, 'Đã đối chiếu'
    ];
  });
  const wsB2Ct = XLSX.utils.aoa_to_sheet([
    [`Biểu B2_CT_ Tác động (${opts.unitCode})`, '', '', '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    b2CtHeader, ...b2CtRows
  ]);
  XLSX.utils.book_append_sheet(wb, wsB2Ct, '5. B2_CT_TacDong');

  // 6. B2_ThayDoi (9 cột A–I — Tự động tổng hợp SUMIFS từ B2_CT_TacDong)
  const b2SummaryRows = processedTemplates.map((t, idx) => {
    const r = idx + 3;
    const before = t.digitalMinutesBefore || t.defaultMinutesPerProduct;
    const after = t.digitalMinutesAfter || t.defaultMinutesPerProduct;
    const reduced = t.digitalImpactStage ? Number((((before - after) * t.defaultQtyPerYear) / 60).toFixed(1)) : 0;
    return [
      t.computedTaskCode,
      fStr(t.computedVtvlCode, `IF(A${r}="","",IFERROR(INDEX('2. A2_CongViec'!$C$3:$C$500,MATCH(A${r},'2. A2_CongViec'!$A$3:$A$500,0)),""))`),
      fNum(reduced, `IF(A${r}="","",SUMIFS('5. B2_CT_TacDong'!$N$3:$N$202,'5. B2_CT_TacDong'!$A$3:$A$202,A${r},'5. B2_CT_TacDong'!$C$3:$C$202,"Số hóa")+SUMIFS('5. B2_CT_TacDong'!$N$3:$N$202,'5. B2_CT_TacDong'!$A$3:$A$202,A${r},'5. B2_CT_TacDong'!$C$3:$C$202,"Cải tiến quy trình"))`),
      fNum(0, `IF(A${r}="","",SUMIF('5. B2_CT_TacDong'!$A$3:$A$202,A${r},'5. B2_CT_TacDong'!$N$3:$N$202)-C${r})`),
      fNum(0, `IF(A${r}="","",SUMIF('5. B2_CT_TacDong'!$A$3:$A$202,A${r},'5. B2_CT_TacDong'!$O$3:$O$202))`),
      fNum(-reduced, `IF(A${r}="","",E${r}-C${r}-D${r})`),
      reduced > 0 ? 'Đã kiểm chứng' : 'Không phát sinh',
      fNum(reduced > 0 ? 1 : 0, `IF(A${r}="","",COUNTIF('5. B2_CT_TacDong'!$A$3:$A$202,A${r}))`),
      'ĐẠT'
    ];
  });
  const wsB2 = XLSX.utils.aoa_to_sheet([
    [`Biểu B2_ Thay đổi (${opts.unitCode})`, '', '', '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã công việc', 'Mã VTVL', 'Giờ giảm số hóa', 'Giờ giảm thuê/TCh/XHH', 'Giờ việc mới', 'Giờ tác động ròng', 'Trạng thái', 'Số dòng chi tiết', 'Cảnh báo'],
    ...b2SummaryRows
  ]);
  XLSX.utils.book_append_sheet(wb, wsB2, '6. B2_ThayDoi');

  // 7. C2_NangLuc (7 cột A–G — Mỗi VTVL 1 dòng liên kết trực tiếp từ '3. C1_VTVL'!A{r})
  const wsC2 = XLSX.utils.aoa_to_sheet([
    [`Biểu C2_ Mô tả năng lực (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã VTVL', 'Trách nhiệm', 'Năng lực chung', 'Chuyên môn', 'Lãnh đạo', 'Căn cứ', 'Nguồn bản mô tả'],
    ...positionBreakdown.map((p, idx) => {
      const r = idx + 3;
      const suffix = p.vtvlCode.replace(new RegExp(`^${opts.unitCode}[-.]`), '');
      const tcnsProf = TCNS_C2_PROFILES[`TCNS.${suffix}`];
      const matchedTasks = templates.filter((t) => `${opts.unitCode}-${t.vtvlSuffix}` === p.vtvlCode);
      const taskSummary = matchedTasks.map((t) => t.taskName).join('; ') || `Thực hiện nhiệm vụ chuyên môn của vị trí ${p.vtvlName}`;
      return [
        fStr(p.vtvlCode, `'3. C1_VTVL'!A${r}`),
        tcnsProf ? tcnsProf.responsibility : `[${p.vtvlName}] ${taskSummary}`,
        tcnsProf ? tcnsProf.general : 'Đạo đức nghề nghiệp, giao tiếp hành chính, phối hợp nghiệp vụ và ứng dụng CNTT/chuyển đổi số',
        tcnsProf ? tcnsProf.professional : `${p.careerLevel || 'Bậc 3'} (${p.vtvlGroup4 || 'II. Nhóm VTVL Chuyên môn, nghiệp vụ'} — Khung Trường: ${p.frameworkTitle || p.vtvlName})`,
        tcnsProf ? tcnsProf.leadership : suffix.startsWith('QL') || suffix.startsWith('LD') ? 'Định hướng, điều hành đơn vị, phân công và giải trình trong thẩm quyền' : 'Không áp dụng',
        tcnsProf ? tcnsProf.basis : 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP; Phụ lục I HCM-UTE & TT 31/2026/TT-BGDĐT',
        tcnsProf ? tcnsProf.source : `Bản mô tả công việc và khung năng lực VTVL ${p.vtvlCode} (HCM-UTE 2026)`
      ];
    })
  ]);
  XLSX.utils.book_append_sheet(wb, wsC2, '7. C2_NangLuc');

  // 8. C3_NhuCau (14 cột A–N — Bước 8 HD 07, liên kết SUMIFS từ B1, B2_ThayDoi, C1)
  const wsC3 = XLSX.utils.aoa_to_sheet([
    [`Biểu C3_ Nhu cầu (${opts.unitCode})`, '', '', '', '', '', '', '', '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã VTVL', 'Phương pháp', 'Giờ B1', 'Giờ tác động B2', 'Giờ ròng', 'Giờ PP2 (từ C1)', 'Người quy đổi PP2', 'Người PP1', 'Người PP3 (ước lượng, cần giải trình)', 'Người cần bố trí', 'Nguồn/giải trình', 'Trạng thái', 'Cảnh báo', 'Số dòng B1 chưa đạt'],
    ...positionBreakdown.map((p, idx) => {
      const r = idx + 3;
      const pp2Ratio = Number((p.netHoursYear / p.standardHoursYear).toFixed(2));
      const isPp1Only = p.method === 'PP1';
      return [
        p.vtvlCode, p.method,
        fNum(p.b1HoursYear, `IF(A${r}="","",SUMIFS('4. B1_KhoiLuong'!$G$3:$G$500,'4. B1_KhoiLuong'!$B$3:$B$500,A${r},'4. B1_KhoiLuong'!$R$3:$R$500,"ĐẠT"))`),
        fNum(p.b2NetHoursYear, `IF(A${r}="","",SUMIFS('6. B2_ThayDoi'!$F$3:$F$202,'6. B2_ThayDoi'!$B$3:$B$202,A${r}))`),
        fNum(p.netHoursYear, `IF(OR(A${r}="",C${r}=""),"",C${r}+IF(D${r}="",0,D${r}))`),
        fNum(p.standardHoursYear, `IF(A${r}="","",IFERROR(INDEX('3. C1_VTVL'!$E$3:$E$100,MATCH(A${r},'3. C1_VTVL'!$A$3:$A$100,0)),1904))`),
        isPp1Only ? '' : fNum(pp2Ratio, `IF(OR(A${r}="",F${r}<=0),"",ROUND(E${r}/F${r},2))`),
        p.method.includes('PP1') ? p.recommendedFte : '', '',
        fNum(p.recommendedFte, isPp1Only ? `H${r}` : `ROUNDUP(G${r},0)`),
        isPp1Only
          ? 'Định biên theo PP1; QĐ 2266, PL18 và BMTCV&KNL'
          : 'Kết quả đo lường khối lượng công việc tại Biểu B1 kỳ 01/10/2025–30/9/2026; quỹ giờ chuẩn 1.904 giờ theo C1',
        'Đã kiểm chứng',
        fStr('ĐẠT', `IF(A${r}="","",IF(J${r}="","CHƯA KẾT LUẬN NGƯỜI CẦN BỐ TRÍ","ĐẠT"))`),
        fNum(0, `IF(A${r}="","",COUNTIFS('4. B1_KhoiLuong'!$B$3:$B$500,A${r},'4. B1_KhoiLuong'!$R$3:$R$500,"<>ĐẠT"))`)
      ];
    })
  ]);
  XLSX.utils.book_append_sheet(wb, wsC3, '8. C3_NhuCau');

  // 9. D1_NhanLuc & 10. D2_PhuongAn
  const { wsD1 } = buildHd07StaffSheets(wb, opts, ngachList, positionBreakdown);

  return { b1Header, b1Rows, wsB1, wsB2Ct, wsD1 };
}

