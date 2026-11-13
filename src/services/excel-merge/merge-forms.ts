import * as XLSX from 'xlsx';

export interface MergeConflictItem {
  taskCode: string;
  taskName: string;
  field: string;
  formAName: string;
  valA: string | number;
  formBName: string;
  valB: string | number;
  allValues: { fileName: string; value: string | number }[];
}

export interface MergeFormsResult {
  mergedFileName: string;
  mergedBlob: Blob;
  unitCode: string;
  oldVersion: number;
  newVersion: number;
  formsMergedCount: number;
  rejectedForms: { fileName: string; reason: string }[];
  updatedTasksCount: number;
  measuredTasksCount: number;
  keptSuggestionCount: number;
  conflicts: MergeConflictItem[];
  logEntriesAdded: string[];
}

export async function mergeSurveyFormsIntoUnit(
  unitFile: File,
  formFiles: File[],
  mergeDate: string
): Promise<MergeFormsResult> {
  const unitBuf = await unitFile.arrayBuffer();
  const unitWb = XLSX.read(unitBuf, { type: 'array' });

  const nameMatch = /^([A-Za-z0-9-]+)_K2526_v(\d+)_(\d{8})\.xlsx$/i.exec(unitFile.name);
  const unitCode = nameMatch ? nameMatch[1].toUpperCase() : unitFile.name.split('_')[0].toUpperCase();
  const oldVersion = nameMatch ? parseInt(nameMatch[2], 10) : 1;
  const newVersion = oldVersion + 1;
  const compactDate = mergeDate.replace(/-/g, '');

  const b1SheetName = unitWb.SheetNames.find((s) => s.includes('B1_KhoiLuong') || s.includes('B1')) || unitWb.SheetNames[0];
  const b1Sheet = unitWb.Sheets[b1SheetName];
  const b1Data = XLSX.utils.sheet_to_json<(string | number)[]>(b1Sheet, { header: 1, defval: '' });

  // Tra cứu tên công việc từ A2 hoặc B1
  const taskNameMap = new Map<string, string>();
  const a2Name = unitWb.SheetNames.find((s) => s.includes('A2'));
  if (a2Name) {
    const a2Rows = XLSX.utils.sheet_to_json<(string | number)[]>(unitWb.Sheets[a2Name], { header: 1, defval: '' });
    for (let r = 2; r < a2Rows.length; r++) {
      const code = String(a2Rows[r][0] || '').trim();
      const name = String(a2Rows[r][3] || code).trim();
      if (code) taskNameMap.set(code, name);
    }
  }

  const taskUpdates = new Map<
    string,
    {
      qty: number | string;
      measuredMin: number | string;
      sourceQty: string;
      sourceTime: string;
      fromFile: string;
      qtyHistory: { fileName: string; value: number | string }[];
      minHistory: { fileName: string; value: number | string }[];
    }
  >();
  const conflicts: MergeConflictItem[] = [];
  const rejectedForms: { fileName: string; reason: string }[] = [];
  let validFormsCount = 0;

  for (const formFile of formFiles) {
    const buf = await formFile.arrayBuffer();
    const fWb = XLSX.read(buf, { type: 'array' });
    const targetSheetName = fWb.SheetNames.find((s) => s.includes('B1') || s.includes('B2')) || fWb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(fWb.Sheets[targetSheetName], { header: 1, defval: '' });

    const headerRow = rows[1] || [];
    const isHd07B1 = String(headerRow[0] || '').includes('Mã công việc');

    // Kiểm tra xem phiếu có thuộc đúng mã đơn vị không
    const firstTaskCode = rows.slice(2).map((r) => String(isHd07B1 ? r[0] : r[3] || '').trim()).find((c) => c.includes('-') || c.includes('.'));
    if (firstTaskCode && !firstTaskCode.toUpperCase().startsWith(`${unitCode}-`) && !firstTaskCode.toUpperCase().startsWith(`${unitCode}.`)) {
      const foreignUnit = firstTaskCode.split(/[-.]/)[0];
      rejectedForms.push({
        fileName: formFile.name,
        reason: `Phiếu thuộc đơn vị [${foreignUnit}], không khớp với tệp gốc của đơn vị [${unitCode}] (đã tự động từ chối gộp).`
      });
      continue;
    }
    validFormsCount++;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const taskCode = String(isHd07B1 ? row[0] : row[3] || '').trim();
      if (!taskCode || (!taskCode.includes('-') && !taskCode.includes('.'))) continue;
      const taskName = taskNameMap.get(taskCode) || taskCode;

      const qty = isHd07B1 ? row[2] : row[8];
      const measuredMin = isHd07B1 ? row[3] : row[10] !== '' ? row[10] : row[11];
      const sourceQty = String(isHd07B1 ? row[7] : row[9] || '').trim();
      const sourceTime = String(isHd07B1 ? row[8] : row[10] !== '' ? 'Phiếu đo bấm giờ thực tế' : 'Phiếu khảo sát đơn vị').trim();

      const prev = taskUpdates.get(taskCode);
      if (prev) {
        const nextQtyHist = [...prev.qtyHistory, ...(qty !== '' ? [{ fileName: formFile.name, value: qty }] : [])];
        const nextMinHist = [...prev.minHistory, ...(measuredMin !== '' ? [{ fileName: formFile.name, value: measuredMin }] : [])];

        if (prev.qty !== '' && qty !== '' && Number(prev.qty) !== Number(qty)) {
          conflicts.push({
            taskCode,
            taskName,
            field: 'Số SP/năm (Cột C)',
            formAName: prev.fromFile,
            valA: prev.qty,
            formBName: formFile.name,
            valB: qty,
            allValues: nextQtyHist
          });
        }
        if (prev.measuredMin !== '' && measuredMin !== '' && Number(prev.measuredMin) !== Number(measuredMin)) {
          conflicts.push({
            taskCode,
            taskName,
            field: 'Trung bình phút/SP (Cột D)',
            formAName: prev.fromFile,
            valA: prev.measuredMin,
            formBName: formFile.name,
            valB: measuredMin,
            allValues: nextMinHist
          });
        }
        taskUpdates.set(taskCode, {
          qty,
          measuredMin,
          sourceQty: sourceQty || prev.sourceQty,
          sourceTime: sourceTime || prev.sourceTime,
          fromFile: formFile.name,
          qtyHistory: nextQtyHist,
          minHistory: nextMinHist
        });
      } else {
        taskUpdates.set(taskCode, {
          qty,
          measuredMin,
          sourceQty: sourceQty || 'Phiếu khảo sát thực tế đơn vị',
          sourceTime: sourceTime || `Nạp từ ${formFile.name}`,
          fromFile: formFile.name,
          qtyHistory: qty !== '' ? [{ fileName: formFile.name, value: qty }] : [],
          minHistory: measuredMin !== '' ? [{ fileName: formFile.name, value: measuredMin }] : []
        });
      }
    }
  }

  let updatedTasksCount = 0;
  let measuredTasksCount = 0;
  let keptSuggestionCount = 0;
  const b1HeaderRow = b1Data[1] || [];
  const isUnitHd07 = String(b1HeaderRow[0] || '').includes('Mã công việc');

  for (let r = 2; r < b1Data.length; r++) {
    const row = b1Data[r];
    const taskCode = String(isUnitHd07 ? row[0] : row[3] || '').trim();
    const upd = taskUpdates.get(taskCode);
    if (!upd) continue;

    if (isUnitHd07) {
      const oldMin = Number(row[3] || 0);
      const newQty = upd.qty !== '' ? Number(upd.qty) : Number(row[2] || 0);
      const newMin = upd.measuredMin !== '' ? Number(upd.measuredMin) : oldMin;
      const extraHours = Number(row[4] || 0);
      const spHours = Number(((newQty * newMin) / 60).toFixed(1));
      const totalHours = Number((spHours + extraHours).toFixed(1));
      const isStillSuggested = newMin === oldMin && upd.sourceTime.includes('chờ nạp phiếu đo');

      row[2] = newQty;
      row[3] = newMin;
      row[5] = spHours;
      row[6] = totalHours;
      row[7] = upd.sourceQty;
      row[8] = isStillSuggested ? 'Mức tham khảo, chưa đo thực tế (giữ nguyên ô cam gợi ý)' : upd.sourceTime;
      row[15] = newMin;
      row[16] = row[8];
      row[17] = newQty > 0 && newMin > 0 ? (isStillSuggested ? 'CHỜ XÁC NHẬN NGUỒN' : 'ĐẠT') : 'THIẾU DỮ LIỆU';
      if (isStillSuggested) keptSuggestionCount++;
      else measuredTasksCount++;
    } else {
      if (upd.qty !== '') row[8] = Number(upd.qty);
      if (upd.sourceQty) row[9] = upd.sourceQty;
      if (upd.measuredMin !== '') { row[10] = Number(upd.measuredMin); measuredTasksCount++; }
    }
    updatedTasksCount++;
  }

  unitWb.Sheets[b1SheetName] = XLSX.utils.aoa_to_sheet(b1Data);

  const kSheetName = unitWb.SheetNames.find((s) => s.includes('K_KiemTra'));
  if (kSheetName) {
    const kData = XLSX.utils.sheet_to_json<(string | number)[]>(unitWb.Sheets[kSheetName], { header: 1, defval: '' });
    if (kData[4] && kData[4].length >= 8) kData[4][7] = keptSuggestionCount === 0 ? 'ĐẠT' : `CÒN ${keptSuggestionCount} DÒNG Ô CAM CHƯA ĐO`;
    unitWb.Sheets[kSheetName] = XLSX.utils.aoa_to_sheet(kData);
  }

  const sSheetName = unitWb.SheetNames.find((s) => s.includes('S_NhatKy'));
  const mergedFileName = `${unitCode}_K2526_v${newVersion}_${compactDate}.xlsx`;
  const formNamesJoined = formFiles.map((f) => f.name).join('; ');
  if (sSheetName) {
    const sData = XLSX.utils.sheet_to_json<(string | number)[]>(unitWb.Sheets[sSheetName], { header: 1, defval: '' });
    sData.push([
      '01/10/2025–30/9/2026', '4. B1_KhoiLuong & 8. C3_NhuCau', unitCode,
      `Nạp và gộp ${validFormsCount} phiếu khảo sát (${updatedTasksCount} công việc · ${conflicts.length} xung đột)`,
      unitFile.name, mergedFileName, `Phiếu đã nạp: ${formNamesJoined}`, `Đầu mối đơn vị ${unitCode}`, mergeDate, `v${newVersion}`
    ]);
    unitWb.Sheets[sSheetName] = XLSX.utils.aoa_to_sheet(sData);
  }

  const outBuf = XLSX.write(unitWb, { bookType: 'xlsx', type: 'array' });
  const mergedBlob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  return {
    mergedFileName, mergedBlob, unitCode, oldVersion, newVersion,
    formsMergedCount: validFormsCount, rejectedForms, updatedTasksCount,
    measuredTasksCount, keptSuggestionCount, conflicts,
    logEntriesAdded: formFiles.map((f) => f.name)
  };
}
