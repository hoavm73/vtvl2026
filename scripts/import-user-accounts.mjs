// @ts-check
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('LỖI: Chưa tìm thấy biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

// 1. Ánh xạ đơn vị từ file Excel sang mã và tên chuẩn hệ thống
/** @type {Record<string, { code: string, nameVi: string }>} */
const UNIT_MAP = {
  'Ban An ninh trật tự': { code: 'BANTT', nameVi: 'Ban An ninh trật tự' },
  'Ban giám hiệu': { code: 'BGH', nameVi: 'Ban Giám hiệu' },
  'Ban quản lý Ký túc xá': { code: 'KTX', nameVi: 'Ban Quản lý Ký túc xá' },
  'Khoa Chính trị và Luật': { code: 'CTL', nameVi: 'Khoa Chính trị và Luật' },
  'Khoa Cơ khí': { code: 'CK', nameVi: 'Khoa Cơ khí' },
  'Khoa Công nghệ Thông tin': { code: 'CNTT', nameVi: 'Khoa Công nghệ Thông tin' },
  'Khoa Đào tạo Tiên tiến': { code: 'DTTT', nameVi: 'Khoa Đào tạo Tiên tiến' },
  'Khoa Điện - Điện tử': { code: 'DDT', nameVi: 'Khoa Điện - Điện tử' },
  'Khoa Giao thông và Năng lượng': { code: 'GTNL', nameVi: 'Khoa Giao thông năng lượng' },
  'Khoa Hóa học và Khoa học sự sống': { code: 'HHKHSS', nameVi: 'Khoa Hoá học và khoa học sự sống' },
  'Khoa Khoa học ứng dụng': { code: 'KHUD', nameVi: 'Khoa Khoa học Ứng dụng' },
  'Khoa Kinh tế': { code: 'KT', nameVi: 'Khoa Kinh tế' },
  'Khoa Mỹ thuật và Truyền thông': { code: 'MTTT', nameVi: 'Khoa Mỹ thuật và Truyền thông' },
  'Khoa Ngoại ngữ': { code: 'NN', nameVi: 'Khoa Ngoại ngữ' },
  'Khoa Xây dựng': { code: 'XD', nameVi: 'Khoa Xây dựng' },
  'Phân hiệu Trường ĐH CNKT TPHCM tại Bình Phước': { code: 'PHBP', nameVi: 'Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước' },
  'Phòng Công tác Sinh viên': { code: 'CTSV', nameVi: 'Phòng Công tác Sinh viên' },
  'Phòng Đào tạo': { code: 'DT', nameVi: 'Phòng Đào tạo' },
  'Phòng Hành chính - Tổng hợp': { code: 'HCTH', nameVi: 'Phòng Hành chính - Tổng hợp' },
  'Phòng Kế hoạch Tài chính': { code: 'KHTC', nameVi: 'Phòng Kế hoạch Tài chính' },
  'Phòng Khảo thí và Đảm bảo chất lượng': { code: 'KTDBCL', nameVi: 'Phòng Khảo thí và Đảm bảo Chất lượng' },
  'Phòng Khoa học Công nghệ': { code: 'KHCN', nameVi: 'Phòng Khoa học Công nghệ' },
  'Phòng Quan hệ Doanh nghiệp': { code: 'QHDN', nameVi: 'Phòng Quan hệ Doanh nghiệp' },
  'Phòng Quan hệ Quốc tế': { code: 'QHQT', nameVi: 'Phòng Quan hệ Quốc tế' },
  'Phòng Quản lý Đầu tư xây dựng và Đấu thầu': { code: 'QLDTXDDT', nameVi: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu' },
  'Phòng Quản trị Cơ sở vật chất': { code: 'QTCSVC', nameVi: 'Phòng Quản trị cơ sở vật chất' },
  'Phòng Quản trị thương hiệu và Truyền thông': { code: 'QTTHTT', nameVi: 'Phòng Quản trị thương hiệu và Truyền thông' },
  'Phòng Tổ chức - Nhân sự': { code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự' },
  'Tạp chí Khoa học giáo dục kỹ thuật': { code: 'TCKHGDKT', nameVi: 'Tạp chí Khoa học Giáo dục Kỹ thuật' },
  'Trạm Y tế': { code: 'TYT', nameVi: 'Trạm Y tế' },
  'Trung tâm Công nghệ phần mềm': { code: 'CNPM', nameVi: 'Trung tâm Công nghệ phần mềm' },
  'Trung tâm Giáo dục Quốc phòng và An ninh': { code: 'GDQPAN', nameVi: 'Trung tâm Giáo dục Quốc phòng và An ninh' },
  'Trung tâm Giáo dục Thể chất': { code: 'GDTC', nameVi: 'Trung tâm Giáo dục Thể chất' },
  'Trung tâm Học liệu và Dạy học số': { code: 'HLDHS', nameVi: 'Trung tâm Học liệu và Dạy học số' },
  'Trung tâm Ngoại ngữ (tự chủ)': { code: 'TTNN', nameVi: 'Trung tâm Ngoại ngữ' },
  'Trung tâm Sáng tạo khởi nghiệp và Chuyển giao công nghệ': { code: 'STKNCCCN', nameVi: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ' },
  'Trung tâm Thông tin - Máy tính': { code: 'TTTTMT', nameVi: 'Trung tâm Thông tin - Máy tính' },
  'Văn phòng Đảng ủy': { code: 'VPDU', nameVi: 'Văn phòng Đảng ủy' },
  'Viện Đào tạo Quốc tế': { code: 'VDTQT', nameVi: 'Viện Đào tạo quốc tế' },
  'Viện Sau Đại học': { code: 'SDH', nameVi: 'Viện Sau đại học' },
  'Viện Sư phạm kỹ thuật': { code: 'VSPKT', nameVi: 'Viện Sư phạm Kỹ thuật' }
};

async function main() {
  console.log('--- KHỞI ĐỘNG NẠP DANH SÁCH TÀI KHOẢN VÀO CSDL ---');
  
  // 1. Đảm bảo BANTT và BGH đã có trong dm_don_vi
  const ensureUnitsRes = await fetch(`${SUPABASE_URL}/rest/v1/dm_don_vi`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify([
      {
        ma_don_vi: 'BANTT',
        ten_don_vi_vi: 'Ban An ninh trật tự',
        ten_don_vi_en: 'Office of Campus Security and Order',
        khoi_don_vi: 'phong-ban',
        linh_vuc: 'bantt.hcmute.edu.vn',
        chuc_danh_thu_truong_vi: 'Trưởng ban',
        chuc_danh_thu_truong_en: 'Head of the Office of Campus Security and Order',
        so_nhan_su_mac_dinh: 30
      },
      {
        ma_don_vi: 'BGH',
        ten_don_vi_vi: 'Ban Giám hiệu',
        ten_don_vi_en: 'Presidential Board',
        khoi_don_vi: 'phong-ban',
        linh_vuc: 'bgh.hcmute.edu.vn',
        chuc_danh_thu_truong_vi: 'Hiệu trưởng',
        chuc_danh_thu_truong_en: 'President',
        so_nhan_su_mac_dinh: 4
      }
    ])
  });
  console.log('Đảm bảo danh mục đơn vị BANTT & BGH:', ensureUnitsRes.status === 201 || ensureUnitsRes.status === 200 ? 'OK' : ensureUnitsRes.statusText);

  // 2. Lấy dữ liệu tài khoản hiện có trên Supabase để bảo tồn avatar, password_hash
  const curRes = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  /** @type {any[]} */
  const existingAccounts = await curRes.json();
  const existingMap = new Map();
  if (Array.isArray(existingAccounts)) {
    existingAccounts.forEach(a => existingMap.set(a.email.toLowerCase().trim(), a));
  }
  console.log(`Số tài khoản hiện có trên CSDL: ${existingMap.size}`);

  // 3. Đọc file Excel
  const wb = XLSX.readFile('DS phan quyen.xls');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  /** @type {any[]} */
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Đã đọc ${rows.length} dòng từ tệp DS phan quyen.xls`);

  const nowIso = new Date().toISOString();
  /** @type {any[]} */
  const recordsToUpsert = [];

  for (const r of rows) {
    const rawUnit = (r['Ten don vi'] || '').trim();
    const rawName = (r['Họ và tên'] || '').trim();
    const rawRole = (r['Nhóm Quyền'] || '').trim();
    const rawEmail = (r['Email'] || '').trim().toLowerCase();

    const unitInfo = UNIT_MAP[rawUnit];
    if (!unitInfo) {
      throw new Error(`Không tìm thấy ánh xạ đơn vị cho: "${rawUnit}"`);
    }

    let role = 'staff';
    let title = 'Cán bộ – Giảng viên';

    if (rawRole === 'Lãnh đạo trường') {
      role = 'admin';
      title = 'Quản trị viên toàn trường';
    } else if (rawRole === 'Lãnh đạo đơn vị') {
      role = 'unit_leader';
      title = 'Lãnh đạo đơn vị';
    } else {
      role = 'staff';
      title = 'Cán bộ – Giảng viên';
    }

    const exist = existingMap.get(rawEmail);

    recordsToUpsert.push({
      email: rawEmail,
      display_name: rawName,
      unit_code: unitInfo.code,
      unit_name_vi: unitInfo.nameVi,
      role: role,
      title: title,
      auth_provider: exist?.auth_provider || 'email',
      avatar_url: exist?.avatar_url || null,
      status: exist?.status || 'active',
      has_selected_unit: true,
      password_hash: exist?.password_hash || null,
      created_at: exist?.created_at || nowIso,
      last_active_at: nowIso
    });
  }

  // Đảm bảo giữ tài khoản Quản trị viên mặc định tcns@hcmute.edu.vn nếu chưa có trong excel
  if (!recordsToUpsert.find(r => r.email === 'tcns@hcmute.edu.vn')) {
    const existTcns = existingMap.get('tcns@hcmute.edu.vn');
    recordsToUpsert.push({
      email: 'tcns@hcmute.edu.vn',
      display_name: 'Phòng Tổ chức – Nhân sự',
      unit_code: 'TCNS',
      unit_name_vi: 'Phòng Tổ chức - Nhân sự',
      role: 'admin',
      title: 'Quản trị viên toàn trường',
      auth_provider: existTcns?.auth_provider || 'email',
      avatar_url: existTcns?.avatar_url || null,
      status: 'active',
      has_selected_unit: true,
      password_hash: existTcns?.password_hash || null,
      created_at: existTcns?.created_at || nowIso,
      last_active_at: nowIso
    });
  }

  console.log(`Chuẩn bị nạp ${recordsToUpsert.length} tài khoản vào Supabase theo từng đợt (chunks)...`);

  // 4. Batch upsert chunks of 100
  const CHUNK_SIZE = 100;
  for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(chunk)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Lỗi nạp đợt ${i} - ${i + chunk.length}: ${res.status} ${errText}`);
    }
    console.log(`✓ Đã nạp thành công đợt: ${i + 1} -> ${Math.min(i + CHUNK_SIZE, recordsToUpsert.length)}`);
  }

  // 5. Cập nhật local file cache .data/server_accounts.json
  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const accountsFile = path.join(dataDir, 'server_accounts.json');

  const localRecords = recordsToUpsert.map(r => ({
    email: r.email,
    displayName: r.display_name,
    unitCode: r.unit_code,
    unitNameVi: r.unit_name_vi,
    role: r.role,
    title: r.title,
    authProvider: r.auth_provider,
    avatarUrl: r.avatar_url,
    status: r.status,
    hasSelectedUnit: r.has_selected_unit,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at
  }));

  fs.writeFileSync(accountsFile, JSON.stringify(localRecords, null, 2), 'utf8');
  console.log(`✓ Đã đồng bộ ${localRecords.length} tài khoản vào tệp cache cục bộ .data/server_accounts.json`);

  // 6. Thống kê tổng hợp sau khi nạp
  const finalRes = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?select=role`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  /** @type {{ role: string }[]} */
  const allFinal = await finalRes.json();
  const counts = { admin: 0, unit_leader: 0, staff: 0 };
  allFinal.forEach(a => {
    // @ts-ignore
    if (counts[a.role] !== undefined) counts[a.role]++;
  });

  console.log('\n======================================================');
  console.log(' KẾT QUẢ ĐỒNG BỘ CƠ SỞ DỮ LIỆU HOÀN TẤT THÀNH CÔNG');
  console.log('======================================================');
  console.log(`Tổng số tài khoản trong Database: ${allFinal.length}`);
  console.log(`- Quản trị viên (admin - Ban Giám hiệu & TCNS): ${counts.admin}`);
  console.log(`- Lãnh đạo đơn vị (unit_leader): ${counts.unit_leader}`);
  console.log(`- Cán bộ, giảng viên, nhân viên (staff): ${counts.staff}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('LỖI THỰC THI:', err);
  process.exit(1);
});
