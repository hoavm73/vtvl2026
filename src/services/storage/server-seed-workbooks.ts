import { ServerWorkbook } from './server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';

interface SeedUnitConfig {
  unitCode: string;
  email: string;
  roleLabel: string;
  revision: number;
  minutesAgo: number;
}

const SEED_CONFIGS: SeedUnitConfig[] = [
  { unitCode: 'CNTT', email: 'cntt@hcmute.edu.vn', roleLabel: 'Thư ký khoa / Trợ lý đào tạo', revision: 1, minutesAgo: 2 },
  { unitCode: 'TCNS', email: 'tcns@hcmute.edu.vn', roleLabel: 'Chuyên viên Phòng TCNS', revision: 1, minutesAgo: 35 },
  { unitCode: 'CK', email: 'ck@hcmute.edu.vn', roleLabel: 'Phó Trưởng khoa Cơ khí', revision: 1, minutesAgo: 90 },
  { unitCode: 'GTNL', email: 'gtnl@hcmute.edu.vn', roleLabel: 'Trưởng khoa Giao thông năng lượng', revision: 1, minutesAgo: 180 },
  { unitCode: 'DDT', email: 'ddt@hcmute.edu.vn', roleLabel: 'Giảng viên chính Khoa Điện - Điện tử', revision: 1, minutesAgo: 320 },
  { unitCode: 'GDQPAN', email: 'gdqpan@hcmute.edu.vn', roleLabel: 'Cán bộ quản lý GDQP&AN', revision: 1, minutesAgo: 480 },
  { unitCode: 'QTTHTT', email: 'qtthtt@hcmute.edu.vn', roleLabel: 'Chuyên viên Truyền thông', revision: 1, minutesAgo: 600 },
  { unitCode: 'DT', email: 'dt@hcmute.edu.vn', roleLabel: 'Chuyên viên Quản lý Đào tạo', revision: 1, minutesAgo: 720 },
  { unitCode: 'KHTC', email: 'khtc@hcmute.edu.vn', roleLabel: 'Kế toán viên chính', revision: 1, minutesAgo: 900 },
  { unitCode: 'HCTH', email: 'hcth@hcmute.edu.vn', roleLabel: 'Chuyên viên Tổng hợp', revision: 1, minutesAgo: 1200 }
];

export function getInitialSeedWorkbooks(): ServerWorkbook[] {
  const baseTime = Date.now();

  return SEED_CONFIGS.map((cfg) => {
    const unit = findHcmuteUnit(cfg.unitCode);
    const wbId = `wb_${cfg.unitCode}_2026`;
    const defaultData = buildDefaultGridWorkbook(cfg.unitCode);
    const updatedTime = new Date(baseTime - cfg.minutesAgo * 60 * 1000).toLocaleString('vi-VN');
    const createdTime = new Date(baseTime - (cfg.minutesAgo + 1440) * 60 * 1000).toLocaleString('vi-VN');

    return {
      id: wbId,
      unitId: cfg.unitCode,
      unitNameVi: unit.nameVi,
      reportingPeriod: '01/10/2025–30/9/2026',
      status: 'draft',
      currentRevision: cfg.revision,
      data: defaultData,
      touchedCells: ['A1-r0-c2', 'A1-r1-c3', 'C1-r0-c1', 'C1-r1-c2'],
      createdAt: createdTime,
      updatedAt: updatedTime,
      participants: [
        {
          id: `part_${cfg.unitCode}_1`,
          sessionId: `sess_${cfg.unitCode}`,
          workbookId: wbId,
          displayName: cfg.roleLabel,
          email: cfg.email,
          emailNormalized: cfg.email.toLowerCase(),
          roleLabel: cfg.roleLabel,
          startedAt: createdTime,
          updatedAt: updatedTime
        }
      ],
      revisions: [
        {
          id: `rev_${cfg.unitCode}_${cfg.revision}`,
          workbookId: wbId,
          revision: cfg.revision,
          data: defaultData,
          actorEmail: cfg.email.toLowerCase(),
          actorTitle: cfg.roleLabel,
          changeSummary: `Cập nhật biểu mẫu lần ${cfg.revision}`,
          createdAt: updatedTime
        }
      ]
    };
  });
}

