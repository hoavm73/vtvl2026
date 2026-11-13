import * as XLSX from 'xlsx';
import { HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { NgachItem, SplitResultSummary, UnitSplitOptions } from '@/types/vtvl';

const fNum = (v: number, f: string): XLSX.CellObject => ({ t: 'n', v, f });
const fStr = (v: string, f: string): XLSX.CellObject => ({ t: 's', v, f });

export function buildHd07StaffSheets(
  wb: XLSX.WorkBook,
  opts: UnitSplitOptions,
  ngachList: NgachItem[],
  positionBreakdown: SplitResultSummary['positionBreakdown']
): { wsD1: XLSX.WorkSheet; wsD2: XLSX.WorkSheet } {
  // 9. D1_NhanLuc (11 cột A–K — Bước 7 HD 07)
  const d1Rows: (string | number | XLSX.CellObject)[][] = [];
  let staffSeq = 1;
  const pushD1Row = (vtvlCode: string, pType: string, stdH: number, codeNote: string, regime: string) => {
    const r = d1Rows.length + 3;
    d1Rows.push([
      `${opts.unitCode}-NL${String(staffSeq).padStart(3, '0')}`, vtvlCode, pType,
      fNum(stdH, `IF(B${r}="","",IF(ISNUMBER(K${r}),K${r},IFERROR(INDEX('3. C1_VTVL'!$E$3:$E$100,MATCH(B${r},'3. C1_VTVL'!$A$3:$A$100,0)),1904)))`),
      stdH, 0, opts.unitNameVi,
      `Danh sách nhân sự chốt ngày ${HD07_CONSTANTS.STAFF_CUTOFF_DATE} (${codeNote})`,
      'Đã kiểm chứng',
      fStr('Đạt', `IF(A${r}="","",IF(E${r}+F${r}>D${r},"Vượt quỹ giờ","Đạt"))`),
      regime === 'Đặc thù' ? stdH : ''
    ]);
    staffSeq++;
  };

  if (opts.proposedPositions && opts.proposedPositions.length > 0) {
    opts.proposedPositions.forEach((pos) => {
      const cleanSuffix = pos.vtvlSuffix.replace(new RegExp(`^${opts.unitCode}[-.]`), '');
      const vtvlCode = `${opts.unitCode}-${cleanSuffix}`;
      for (let k = 0; k < Math.min(pos.staffCount, 15); k++) {
        pushD1Row(vtvlCode, 'Viên chức', pos.standardHoursYear, pos.ngachCode, pos.workingRegime);
      }
    });
  } else {
    ngachList.forEach((n) => {
      const count = opts.ngachOverrides[n.code] ?? n.defaultCount;
      const matchingPos = positionBreakdown.find((p) => p.ngachCode === n.code) || positionBreakdown[0];
      for (let k = 0; k < Math.min(count, 15); k++) {
        pushD1Row(matchingPos.vtvlCode, n.personnelType, n.standardHoursPerYear, n.code, n.workingRegime);
      }
    });
  }

  const wsD1 = XLSX.utils.aoa_to_sheet([
    [`Biểu D1_ Nhân lực (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã nguồn lực', 'Mã VTVL', 'Loại nhân lực', 'Giờ quy đổi/năm (tự lấy)', 'Giờ dành cho VTVL', 'Giờ việc khác', 'Nơi tính BC', 'Nguồn', 'Trạng thái', 'Cảnh báo', 'Giờ riêng theo chế độ'],
    ...d1Rows
  ]);
  XLSX.utils.book_append_sheet(wb, wsD1, '9. D1_NhanLuc');

  // 10. D2_PhuongAn (14 cột A–N — Bước 7 HD 07, liên kết DU_BAO_5_NAM, D1_NhanLuc, C3_NhuCau)
  const d2Rows: (string | number | XLSX.CellObject)[][] = [];
  positionBreakdown.forEach((p) => {
    const currentAssigned = Math.max(1, Math.round(p.recommendedFte));
    const pp2Ratio = Number((p.netHoursYear / p.standardHoursYear).toFixed(2));
    HD07_CONSTANTS.FORECAST_YEARS.forEach((yr) => {
      const r = d2Rows.length + 3;
      d2Rows.push([
        p.vtvlCode, yr,
        fNum(p.recommendedFte, `IF(A${r}="","",SUMIFS(DU_BAO_5_NAM!$H$3:$H$500,DU_BAO_5_NAM!$A$3:$A$500,A${r},DU_BAO_5_NAM!$B$3:$B$500,B${r}))`),
        fNum(currentAssigned, `COUNTIFS('9. D1_NhanLuc'!$B$3:$B$500,A${r})`),
        currentAssigned, 0,
        fNum(Number((p.recommendedFte - currentAssigned).toFixed(2)), `C${r}-D${r}`),
        `Phương án biên chế năm ${yr} theo đề án VTVL ${opts.unitCode}`, 'Đã hoàn thành ở đơn vị', 'ĐẠT',
        fNum(pp2Ratio, `IFERROR(INDEX('8. C3_NhuCau'!$G$3:$G$100,MATCH(A${r},'8. C3_NhuCau'!$A$3:$A$100,0)),0)`),
        fNum(p.recommendedFte, `IFERROR(INDEX('8. C3_NhuCau'!$J$3:$J$100,MATCH(A${r},'8. C3_NhuCau'!$A$3:$A$100,0)),0)`),
        'ĐỐI CHIẾU XONG', `Đề án VTVL ${opts.unitCode} năm 2026`
      ]);
    });
  });

  const wsD2 = XLSX.utils.aoa_to_sheet([
    [`Biểu D2_ Phương án (${opts.unitCode})`, '', '', '→ Hướng dẫn điền: HD_DIEN_BIEU'],
    ['Mã VTVL', 'Năm', 'Số người cần bố trí trong năm phương án', 'Số người có thể bố trí (cùng đơn vị tính)', 'Biên chế được giao theo đúng cấp', 'Điều chuyển/bố trí lại', 'Đề nghị điều chỉnh', 'Nguồn/giải trình', 'Trạng thái', 'Cảnh báo', 'PP2: người quy đổi (tham khảo)', 'Người cần bố trí C3 năm cơ sở (tham khảo)', 'Kiểm soát cơ sở đối chiếu', 'Văn bản thẩm định/quyết định (số, ngày, cơ quan)'],
    ...d2Rows
  ]);
  XLSX.utils.book_append_sheet(wb, wsD2, '10. D2_PhuongAn');

  return { wsD1, wsD2 };
}

