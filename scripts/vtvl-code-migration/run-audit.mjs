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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Không tìm thấy thông tin kết nối Supabase trong .env.local');
  process.exit(1);
}

async function runAudit() {
  console.log('========================================================================');
  console.log('BÁO CÁO KIỂM TRA HIỆN TRẠNG MÃ VTVL TRÊN SUPABASE (PRE-MIGRATION AUDIT)');
  console.log('========================================================================');

  try {
    const res = await fetch(`${url}/rest/v1/c1_vtvl?select=ma_vtvl,ma_don_vi,ten_vtvl_cu_the_don_vi&order=ma_don_vi,ma_vtvl`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });

    if (!res.ok) {
      console.error(`Lỗi truy vấn C1_VTVL: ${res.status} ${res.statusText}`);
      return;
    }

    const rows = await res.json();
    console.log(`\nTổng số bản ghi trong public.c1_vtvl: ${rows.length}`);

    const simulated = rows.map((r) => {
      const code = String(r.ma_vtvl || '').trim();
      const unit = String(r.ma_don_vi || '').trim().toUpperCase();

      let newCode = code;
      let reason = 'Giữ nguyên (không thuộc nhóm HT)';

      if (/^HT/i.test(code)) {
        newCode = `${unit}.${code.toUpperCase()}`;
        reason = 'Thêm tiền tố {ĐƠN_VỊ}.';
      } else if (new RegExp(`^${unit}-HT`, 'i').test(code)) {
        newCode = `${unit}.${code.substring(unit.length + 1).toUpperCase()}`;
        reason = 'Đổi dấu gạch ngang (-) thành dấu chấm (.)';
      } else if (new RegExp(`^${unit}\\.HT`, 'i').test(code)) {
        newCode = `${unit}.${code.substring(unit.length + 1).toUpperCase()}`;
        reason = 'Đã chuẩn chuẩn {ĐƠN_VỊ}.HT...';
      } else if (/HT/i.test(code) && !code.startsWith(`${unit}.`)) {
        const match = code.match(/HT.*/i);
        newCode = `${unit}.${match ? match[0].toUpperCase() : code}`;
        reason = 'Chuẩn hóa định dạng HT có tiền tố đơn vị';
      }

      return {
        maCu: code,
        maDonVi: unit,
        tenVtvl: r.ten_vtvl_cu_the_don_vi,
        maMoi: newCode,
        canDoi: code !== newCode,
        lyDo: reason
      };
    });

    const needsUpdate = simulated.filter((s) => s.canDoi);
    console.log(`Số lượng mã cần chuyển đổi: ${needsUpdate.length}/${rows.length}`);

    if (needsUpdate.length > 0) {
      console.log('\n--- DANH SÁCH MÃ SẼ ĐƯỢC CHUYỂN ĐỔI ---');
      console.table(needsUpdate.map((n) => ({
        'Mã đơn vị': n.maDonVi,
        'Mã hiện tại': n.maCu,
        'Mã mới': n.maMoi,
        'Thao tác': n.lyDo
      })));
    } else {
      console.log('\nHiện tại không có mã nào cần chuyển đổi hoặc tất cả đã theo định dạng chuẩn.');
    }

    // Kiểm tra trùng lặp mã mới
    const counts = {};
    simulated.forEach((s) => {
      counts[s.maMoi] = (counts[s.maMoi] || 0) + 1;
    });
    const duplicates = Object.entries(counts).filter(([_, c]) => c > 1);

    if (duplicates.length > 0) {
      console.error('\n[CẢNH BÁO NGUY HIỂM] Phát hiện mã mới bị trùng lặp:', duplicates);
    } else {
      console.log('\n[XÁC MINH] Không có mã mới nào bị trùng lặp (100% Unique).');
    }

    console.log('\n========================================================================');
    console.log('KẾT THÚC KIỂM TRA: Script kiểm tra không làm thay đổi bất kỳ dữ liệu nào.');
    console.log('========================================================================');
  } catch (err) {
    console.error('Lỗi kiểm tra:', err.message);
  }
}

runAudit();

