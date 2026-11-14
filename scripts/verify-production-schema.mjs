#!/usr/bin/env node
/**
 * scripts/verify-production-schema.mjs
 *
 * Kiểm tra trạng thái cơ sở dữ liệu Supabase qua OpenAPI metadata và HEAD request.
 * Tuyệt đối không tải dòng dữ liệu nhạy cảm hay PII.
 */

import fs from 'fs';
import path from 'path';

// Đọc file .env.local nếu có
let envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
let envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if ((!envUrl || !envKey) && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  if (!envUrl) {
    const m = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    if (m) envUrl = m[1].trim();
  }
  if (!envKey) {
    const s = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
    const a = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
    envKey = s ? s[1].trim() : (a ? a[1].trim() : '');
  }
}

if (!envUrl || !envKey) {
  console.error('❌ Lỗi: Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_KEY.');
  process.exit(1);
}

const EXPECTED_30_TABLES = [
  'dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham',
  'c1_vtvl', 't_tien_do', 's_nhat_ky', 'user_accounts', 'staff_work_tickets',
  'coordinated_tasks', 'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong',
  'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc',
  'du_bao_5_nam', 'd2_phuong_an', 'k_kiem_tra', 'sldv_quy_mo_don_vi',
  'sldv_phan_bo_ngach', 'can_cu_goi_y', 'ra_soat_chua_du_can_cu',
  'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions', 'audit_logs'
];

export const EXPECTED_48_UNITS = [
  'CK', 'GTNL', 'DDT', 'CNTT', 'HHKHSS', 'XD', 'KT', 'DTTT', 'MTTT', 'CTL',
  'KHUD', 'NN', 'VSPKT', 'VDTQT', 'SDH', 'QTTHTT', 'TCNS', 'DT', 'QHQT', 'QHDN',
  'KHTC', 'KHCN', 'HCTH', 'CTSV', 'KTDBCL', 'QTCSVC', 'QLDTXDDT', 'KTX', 'TYT',
  'PHBP', 'TCKHGDKT', 'HLDHS', 'STKNCCCN', 'TTTTMT', 'TTCNTT', 'GDQPAN', 'GDTC',
  'CNPM', 'THKTTH', 'TTNN', 'TTVD', 'TTRBTM', 'TTKTTH', 'KTCNMT', 'NCUDKTXD',
  'VPDU', 'CDT', 'DTN'
];

export const LEGACY_36_CODES = [
  'FME', 'FEET', 'FEEE', 'FIT', 'FCFT', 'FCE', 'FE', 'FAE', 'FGAM', 'FPI',
  'FAS', 'FFL', 'ITE', 'IIE', 'CISAT', 'INC', 'ITC', 'STC', 'TPC', 'CFL',
  'VGC', 'SRC', 'ESC', 'EETC', 'CERAC', 'BMC', 'AAO', 'OIA', 'ERO', 'FPO',
  'STIAO', 'OGA', 'SAO', 'QAO', 'EMO', 'CPM'
];

export const DELETED_EXTRA_CODES = ['IDDF', 'TRTC', 'HDT', 'BGH', 'FFT'];

async function verifySchema() {
  console.log('🔍 Đang kiểm tra schema Supabase tại:', envUrl);

  const res = await fetch(`${envUrl}/rest/v1/`, {
    headers: {
      apikey: envKey,
      Authorization: `Bearer ${envKey}`
    }
  });

  if (!res.ok) {
    console.error(`❌ Không thể truy vấn metadata OpenAPI: HTTP ${res.status}`);
    process.exit(1);
  }

  const spec = await res.json();
  const definitions = spec.definitions || {};
  const presentTables = Object.keys(definitions);

  console.log(`\n📊 Tổng số bảng hiện diện trên remote: ${presentTables.length}/${EXPECTED_30_TABLES.length}`);

  const missingTables = EXPECTED_30_TABLES.filter(t => !presentTables.includes(t));
  const columnDrifts = [];

  // Kiểm tra cột bổ sung cho c1_vtvl
  if (definitions.c1_vtvl) {
    const props = definitions.c1_vtvl.properties || {};
    if (!props.ma_danh_muc_nd232) {
      columnDrifts.push({ table: 'c1_vtvl', column: 'ma_danh_muc_nd232', status: 'THIẾU' });
    }
  }

  // Kiểm tra cột bổ sung cho t_tien_do
  if (definitions.t_tien_do) {
    const props = definitions.t_tien_do.properties || {};
    if (!props.email_nguoi_thuc_hien) {
      columnDrifts.push({ table: 't_tien_do', column: 'email_nguoi_thuc_hien', status: 'THIẾU' });
    }
    if (!props.chuc_vu_nguoi_thuc_hien) {
      columnDrifts.push({ table: 't_tien_do', column: 'chuc_vu_nguoi_thuc_hien', status: 'THIẾU' });
    }
  }

  // Kiểm tra cột bổ sung cho s_nhat_ky
  if (definitions.s_nhat_ky) {
    const props = definitions.s_nhat_ky.properties || {};
    if (!props.email_nguoi_thuc_hien) {
      columnDrifts.push({ table: 's_nhat_ky', column: 'email_nguoi_thuc_hien', status: 'THIẾU' });
    }
    if (!props.chuc_vu_nguoi_thuc_hien) {
      columnDrifts.push({ table: 's_nhat_ky', column: 'chuc_vu_nguoi_thuc_hien', status: 'THIẾU' });
    }
  }

  // Lấy row count an toàn qua HEAD request (không tải nội dung)
  console.log('\n--- Thống kê số lượng bản ghi (qua HEAD count) ---');
  for (const t of presentTables) {
    try {
      const headRes = await fetch(`${envUrl}/rest/v1/${t}?select=count`, {
        method: 'HEAD',
        headers: {
          apikey: envKey,
          Authorization: `Bearer ${envKey}`,
          Prefer: 'count=exact',
          Range: '0-0'
        }
      });
      const countHeader = headRes.headers.get('content-range');
      const total = countHeader ? countHeader.split('/')[1] : 'N/A';
      console.log(`  ✓ ${t.padEnd(25)} : ${total} dòng`);
    } catch {
      console.log(`  ✓ ${t.padEnd(25)} : (không thể lấy count)`);
    }
  }

  // Kiểm tra danh mục 48 đơn vị chính thức trong dm_don_vi
  console.log('\n--- Kiểm tra danh mục 48 đơn vị chính thức (dm_don_vi) ---');
  let unitDrift = null;
  if (presentTables.includes('dm_don_vi')) {
    try {
      const unitsRes = await fetch(`${envUrl}/rest/v1/dm_don_vi?select=ma_don_vi,ten_don_vi_vi`, {
        headers: {
          apikey: envKey,
          Authorization: `Bearer ${envKey}`
        }
      });
      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        const currentCodes = unitsData.map(u => u.ma_don_vi);
        const missingCodes = EXPECTED_48_UNITS.filter(c => !currentCodes.includes(c));
        const extraCodes = currentCodes.filter(c => !EXPECTED_48_UNITS.includes(c));
        const legacyCodes = currentCodes.filter(c => LEGACY_36_CODES.includes(c));
        const deletedCodes = currentCodes.filter(c => DELETED_EXTRA_CODES.includes(c));

        console.log(`  ✓ Số lượng đơn vị hiện diện: ${currentCodes.length}/48`);
        if (missingCodes.length > 0 || extraCodes.length > 0 || legacyCodes.length > 0 || deletedCodes.length > 0) {
          unitDrift = {
            count: currentCodes.length,
            missing: missingCodes,
            extra: extraCodes,
            legacy: legacyCodes,
            deleted: deletedCodes
          };
          console.log(`  ⚠️ Phát hiện danh mục đơn vị chưa đồng bộ 48 đơn vị:`);
          if (missingCodes.length > 0) console.log(`    - Thiếu ${missingCodes.length} mã: ${missingCodes.join(', ')}`);
          if (legacyCodes.length > 0) console.log(`    - Còn ${legacyCodes.length} mã cũ: ${legacyCodes.join(', ')}`);
          if (deletedCodes.length > 0) console.log(`    - Còn ${deletedCodes.length} mã thừa: ${deletedCodes.join(', ')}`);
        } else {
          console.log('  ✓ Danh mục 48 đơn vị chính xác 100%, không còn mã cũ hay mã thừa.');
        }
      }
    } catch (err) {
      console.log('  ⚠️ Không thể truy vấn chi tiết dm_don_vi:', err.message);
    }
  }

  if (missingTables.length > 0 || columnDrifts.length > 0 || unitDrift !== null) {
    console.log('\n⚠️  PHÁT HIỆN SCHEMA DRIFT CẦN CHẠY MIGRATION:');
    if (missingTables.length > 0) {
      console.log(`  - Thiếu ${missingTables.length} bảng: ${missingTables.join(', ')}`);
    }
    if (columnDrifts.length > 0) {
      console.log('  - Thiếu cột trong bảng hiện có:');
      for (const d of columnDrifts) {
        console.log(`    * ${d.table}.${d.column} (${d.status})`);
      }
    }
    if (unitDrift !== null) {
      console.log(`  - Danh mục đơn vị chưa đồng bộ chuẩn 48 đơn vị (hiện có ${unitDrift.count}/48).`);
      console.log('👉 Vui lòng áp dụng migration đồng bộ 48 đơn vị: supabase/migrations/20261115000000_sync_units_catalog_48.sql');
    }
    if (missingTables.length > 0 || columnDrifts.length > 0) {
      console.log('👉 Vui lòng áp dụng migration schema: supabase/migrations/20261114220000_reconcile_production_schema.sql');
    }
    process.exit(1);
  } else {
    console.log('\n✅ SCHEMA ĐẠT CHUẨN: Đủ 30 bảng, đủ cột và chuẩn hóa đúng 48 đơn vị HCM-UTE.');
    process.exit(0);
  }
}

verifySchema().catch((err) => {
  console.error('❌ Lỗi kiểm tra schema:', err);
  process.exit(1);
});
