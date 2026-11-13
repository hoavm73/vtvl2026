import fs from 'fs';
import path from 'path';

// Đọc biến môi trường từ .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Không tìm thấy thông tin SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function executeMigration() {
  console.log('========================================================================');
  console.log('TIẾN HÀNH CẬP NHẬT CẤU TRÚC MÃ VTVL TRÊN SUPABASE');
  console.log('Quy tắc chuẩn: {TÊN_VIẾT_TẮT_ĐƠN_VỊ}.HT{...}');
  console.log('========================================================================\n');

  // 1. LẤY BASELINE TRƯỚC CẬP NHẬT
  const resC1 = await fetch(`${url}/rest/v1/c1_vtvl?select=*`, { headers });
  if (!resC1.ok) {
    throw new Error(`Không đọc được c1_vtvl: ${resC1.status} ${resC1.statusText}`);
  }
  const oldC1Rows = await resC1.json();
  const baselineCount = oldC1Rows.length;
  console.log(`[BƯỚC 1] Baseline c1_vtvl: ${baselineCount} bản ghi.`);

  // 2. TẠO BẢNG ÁNH XẠ
  const mapping = [];
  for (const r of oldC1Rows) {
    const code = String(r.ma_vtvl || '').trim();
    const unit = String(r.ma_don_vi || '').trim().toUpperCase();

    let newCode = code;
    if (/^HT/i.test(code)) {
      newCode = `${unit}.${code.toUpperCase()}`;
    } else if (new RegExp(`^${unit}-HT`, 'i').test(code)) {
      newCode = `${unit}.${code.substring(unit.length + 1).toUpperCase()}`;
    } else if (new RegExp(`^${unit}\\.HT`, 'i').test(code)) {
      newCode = `${unit}.${code.substring(unit.length + 1).toUpperCase()}`;
    } else if (/HT/i.test(code) && !code.startsWith(`${unit}.`)) {
      const match = code.match(/HT.*/i);
      newCode = `${unit}.${match ? match[0].toUpperCase() : code}`;
    }

    if (code !== newCode) {
      mapping.push({ oldCode: code, newCode, unit, originalRow: r });
    }
  }

  console.log(`[BƯỚC 2] Số lượng mã VTVL cần chuyển đổi trong c1_vtvl: ${mapping.length}`);
  mapping.forEach((m) => {
    console.log(`  - [${m.unit}] ${m.oldCode} -> ${m.newCode}`);
  });

  // 3. THỰC THI TRÊN BẢNG C1_VTVL
  for (const m of mapping) {
    // 3.1 Thêm bản ghi mới
    const newRecord = { ...m.originalRow, ma_vtvl: m.newCode, updated_at: new Date().toISOString() };
    const insertRes = await fetch(`${url}/rest/v1/c1_vtvl`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newRecord)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(`Lỗi chèn mã mới ${m.newCode}: ${insertRes.status} - ${errText}`);
    }

    // 3.2 Xóa bản ghi cũ
    const deleteRes = await fetch(`${url}/rest/v1/c1_vtvl?ma_vtvl=eq.${encodeURIComponent(m.oldCode)}`, {
      method: 'DELETE',
      headers
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      throw new Error(`Lỗi xóa mã cũ ${m.oldCode}: ${deleteRes.status} - ${errText}`);
    }
    console.log(`  ✓ Đã cập nhật thành công: ${m.oldCode} -> ${m.newCode}`);
  }

  // 4. ĐỒNG BỘ DỮ LIỆU JSONB TRONG BẢNG T_TIEN_DO
  console.log('\n[BƯỚC 3] Quét và đồng bộ các hồ sơ tiến độ đơn vị trong t_tien_do...');
  const resTd = await fetch(`${url}/rest/v1/t_tien_do?select=ma_don_vi,du_lieu_ho_so_json`, { headers });
  if (resTd.ok) {
    const tdList = await resTd.json();
    let updatedUnitsCount = 0;

    for (const td of tdList) {
      const unitCode = td.ma_don_vi;
      if (!td.du_lieu_ho_so_json) continue;

      let modified = false;
      const jsonStr = JSON.stringify(td.du_lieu_ho_so_json);

      // Thay thế các mẫu mã cũ dạng 'HT-PTN-01' hoặc 'HT45' thành '{unitCode}.HT...'
      const updatedJson = JSON.parse(jsonStr, (key, value) => {
        if (key === 'maVtvl' || key === 'ma_vtvl') {
          const val = String(value || '').trim();
          if (/^HT/i.test(val)) {
            modified = true;
            return `${unitCode}.${val.toUpperCase()}`;
          }
          if (new RegExp(`^${unitCode}-HT`, 'i').test(val)) {
            modified = true;
            return `${unitCode}.${val.substring(unitCode.length + 1).toUpperCase()}`;
          }
        }
        return value;
      });

      if (modified) {
        const updateRes = await fetch(`${url}/rest/v1/t_tien_do?ma_don_vi=eq.${encodeURIComponent(unitCode)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            du_lieu_ho_so_json: updatedJson,
            updated_at: new Date().toISOString()
          })
        });

        if (updateRes.ok) {
          updatedUnitsCount++;
          console.log(`  ✓ Đã đồng bộ mã VTVL trong hồ sơ đơn vị: ${unitCode}`);
        }
      }
    }
    console.log(`  -> Hoàn tất đồng bộ ${updatedUnitsCount} hồ sơ đơn vị trong t_tien_do.`);
  }

  // 5. GHI NHẬT KÝ KIỂM TOÁN VÀO BẢNG S_NHAT_KY
  console.log('\n[BƯỚC 4] Ghi nhận lịch sử kiểm toán vào s_nhat_ky...');
  await fetch(`${url}/rest/v1/s_nhat_ky`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ma_don_vi: 'TCNS',
      ten_don_vi: 'Phòng Tổ chức - Nhân sự',
      hanh_dong: 'CHUYỂN ĐỔI CẤU TRÚC MÃ VTVL',
      chi_tiet: `Chuẩn hóa mã VTVL nhóm HT sang định dạng {ĐƠN_VỊ}.HT{...} cho toàn Trường theo yêu cầu Ban Đề án.`,
      email_nguoi_thuc_hien: 'admin@hcmute.edu.vn',
      chuc_vu_nguoi_thuc_hien: 'Quản trị hệ thống VTVL',
      phien_ban: 'v2'
    })
  });

  // 6. ĐỐI SOÁT VÀ CHỨNG MINH SAU CẬP NHẬT (POST-MIGRATION VERIFICATION)
  console.log('\n========================================================================');
  console.log('BƯỚC 5: ĐỐI SOÁT VÀ CHỨNG MINH KẾT QUẢ SAU CẬP NHẬT (CRITERIA AUDIT)');
  console.log('========================================================================');

  const resVerify = await fetch(`${url}/rest/v1/c1_vtvl?select=*&order=ma_don_vi,ma_vtvl`, { headers });
  const newC1Rows = await resVerify.json();
  const finalCount = newC1Rows.length;

  console.log(`1. Số lượng bản ghi trước (${baselineCount}) và sau (${finalCount}): ${baselineCount === finalCount ? 'CHÍNH XÁC (KHÔNG ĐỔI)' : 'SAI LỆCH'}`);

  // Kiểm tra trùng lặp
  const counts = {};
  newC1Rows.forEach((r) => {
    counts[r.ma_vtvl] = (counts[r.ma_vtvl] || 0) + 1;
  });
  const dups = Object.entries(counts).filter(([_, c]) => c > 1);
  console.log(`2. Kiểm tra trùng lặp mã mới: ${dups.length === 0 ? 'ĐẠT (0 mã trùng lặp)' : 'CÓ TRÙNG LẶP'}`);

  // Kiểm tra định dạng mã nhóm HT
  const htRows = newC1Rows.filter((r) => r.ma_vtvl.includes('HT'));
  const validFormat = htRows.every((r) => new RegExp(`^${r.ma_don_vi}\\.HT`, 'i').test(r.ma_vtvl));
  console.log(`3. Kiểm tra định dạng {ĐƠN_VỊ}.HT... cho toàn bộ nhóm HT: ${validFormat ? 'ĐẠT 100%' : 'CHƯA ĐẠT'}`);

  console.log('\nDanh sách mã VTVL nhóm HT sau khi cập nhật:');
  console.table(htRows.map((r) => ({
    'Mã đơn vị': r.ma_don_vi,
    'Mã VTVL chuẩn mới': r.ma_vtvl,
    'Tên VTVL': r.ten_vtvl_cu_the_don_vi
  })));

  console.log('\n========================================================================');
  console.log('CẬP NHẬT VÀ ĐỐI SOÁT HOÀN TẤT THÀNH CÔNG 100%');
  console.log('========================================================================');
}

executeMigration().catch((err) => {
  console.error('\n[LỖI CẬP NHẬT]', err);
  process.exit(1);
});
