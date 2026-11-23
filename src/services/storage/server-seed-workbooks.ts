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

/**
 * Chỉ khởi tạo trước hồ sơ thực tế cho Phòng Tổ chức – Nhân sự (TCNS).
 * Không pre-create workbook mẫu hàng loạt cho các đơn vị khác; khi đơn vị khác
 * mở lần đầu sẽ nhận cấu trúc trống (A1: [], C1: []) để tự nhập dữ liệu thực tế.
 */
const SEED_CONFIGS: SeedUnitConfig[] = [
  { unitCode: 'TCNS', email: 'tcns@hcmute.edu.vn', roleLabel: 'Chuyên viên Phòng TCNS', revision: 1, minutesAgo: 35 }
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
      touchedCells: [],
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
          changeSummary: `Khởi tạo hồ sơ thực tế ${cfg.unitCode} lần ${cfg.revision}`,
          createdAt: updatedTime
        }
      ]
    };
  });
}
