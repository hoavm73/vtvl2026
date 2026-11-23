import fs from 'fs';
import crypto from 'crypto';
import { createRequire } from 'module';
import { CORE_EXCEL_SHEET_METAS } from '../../src/components/excel-grid/excel-sheet-metas-core';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export function captureWorkbookStructureSnapshot(wbData, templatePaths = ['public/mau/mau_khoa_vien_v1.xlsx', 'public/mau/mau_phong_ban_v1.xlsx']) {
  const sheetKeys = Object.keys(wbData || {}).sort();
  const kRules = (wbData?.K || []).map((k) => ({
    stt: Number(k.stt || 0),
    nguongChoPhep: String(k.nguongChoPhep || '0')
  }));
  const dmSpHash = sha256(JSON.stringify(wbData?.DM_SP || []));
  const coreColumnSpec = Object.fromEntries(
    Object.entries(CORE_EXCEL_SHEET_METAS).map(([k, meta]) => [
      k,
      meta.columns.map((c) => ({ colLetter: c.colLetter, field: c.field, isFormula: Boolean(c.isFormula), formulaHint: c.formulaHint || '' }))
    ])
  );
  const excelTemplates = {};
  for (const fp of templatePaths) {
    if (!fs.existsSync(fp)) continue;
    const book = XLSX.readFile(fp, { cellFormula: true, cellStyles: false });
    let formulaCount = 0;
    const formulaEntries = [];
    for (const sn of book.SheetNames) {
      const sheet = book.Sheets[sn];
      for (const addr of Object.keys(sheet)) {
        if (addr.startsWith('!')) continue;
        if (sheet[addr]?.f) {
          formulaCount += 1;
          formulaEntries.push(`${sn}!${addr}=${sheet[addr].f}`);
        }
      }
    }
    excelTemplates[fp] = {
      sheetsCount: book.SheetNames.length,
      namedRangesCount: book.Workbook?.Names?.length || 0,
      formulaCount,
      formulasSha256: sha256(formulaEntries.sort().join('\n'))
    };
  }
  return {
    sheetKeys,
    kRulesCount: kRules.length,
    kRulesSha256: sha256(JSON.stringify(kRules)),
    dmSpCount: (wbData?.DM_SP || []).length,
    dmSpSha256: dmSpHash,
    coreColumnSpecSha256: sha256(JSON.stringify(coreColumnSpec)),
    excelTemplates
  };
}

export function assertWorkbookStructureUnchanged(before, after, unitCode) {
  const diffs = [];
  if (JSON.stringify(before.sheetKeys) !== JSON.stringify(after.sheetKeys)) diffs.push('sheetKeys');
  if (after.kRulesCount !== 6 || (before.kRulesCount === 6 && before.kRulesSha256 !== after.kRulesSha256)) diffs.push('kRules');
  if (before.dmSpSha256 !== after.dmSpSha256) diffs.push('dmSp');
  if (before.coreColumnSpecSha256 !== after.coreColumnSpecSha256) diffs.push('coreColumnSpec');
  if (JSON.stringify(before.excelTemplates) !== JSON.stringify(after.excelTemplates)) diffs.push('excelTemplates');
  if (diffs.length > 0) {
    throw new Error(`Structure/Formula guard failed for ${unitCode}: changed [${diffs.join(', ')}]`);
  }
  return { ok: true, checkedDimensions: ['sheetKeys', 'kRules', 'dmSp', 'coreColumnSpec', 'excelTemplates'] };
}

export function buildCleanupAuditLogEntry(params) {
  return {
    action: 'REMOVE_A1_C1_SCHOOL_TEMPLATE',
    unitCode: String(params.unitCode || '').toUpperCase(),
    workbookId: String(params.workbookId || ''),
    revBefore: Number(params.revBefore || 0),
    revAfter: Number(params.revAfter || 0),
    a1Cleaned: Number(params.a1Cleaned || 0),
    c1Cleaned: Number(params.c1Cleaned || 0),
    dependentCleanedByTable: params.dependentCleanedByTable || {},
    actorEmail: String(params.actorEmail || 'tcns@hcmute.edu.vn'),
    timestamp: new Date().toISOString(),
    reason: String(params.reason || 'Làm sạch dữ liệu mẫu A1/C1 theo Manifest đã phê duyệt'),
    backupId: String(params.backupId || ''),
    manifestId: String(params.manifestId || '')
  };
}
