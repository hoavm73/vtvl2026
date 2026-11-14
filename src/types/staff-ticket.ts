export type TicketStatus = 'Nháp' | 'Đã nộp';

export interface CoordinatedTaskLink {
  id: string;
  targetUnitCode: string;
  targetUnitName: string;
  targetTaskCode: string;
  targetTaskName: string;
  note?: string;
}

export interface StaffWorkTicket {
  id: string;
  unitCode: string;
  ownerEmail: string;
  ownerName: string;
  ownerTitle: string;
  status: TicketStatus;
  /** 1. Mã nhiệm vụ (chọn từ Biểu A1) */
  maNhiemVu: string;
  /** 2. Mã công việc (tự động sinh [maNhiemVu].CVxx) */
  maCongViec: string;
  /** 3. Tên công việc cụ thể */
  tenCongViec: string;
  /** 3a. Mã vị trí việc làm chính (chọn từ Biểu C1) */
  maVtvl: string;
  /** 3b. Mã vị trí việc làm phối hợp (chọn từ Biểu C1, tùy chọn) */
  maVtvlPhoiHop?: string;
  /** 4. Sản phẩm đầu ra (Biểu A2) */
  sanPham: string;
  /** 5. Yêu cầu chất lượng (Biểu A2) */
  chatLuong: string;
  /** 6. Giải trình / Căn cứ nguồn tài liệu (Biểu A2) */
  canCu: string;
  /** 7a. Số lượng sản phẩm tạo ra từ 01/10/2025 đến 30/09/2026 (Biểu B1) */
  soSpNam: number;
  /** 7b. Giải trình nguồn số liệu sản lượng (Biểu B1) */
  nguonSoLieu: string;
  /** 8. Trung bình 1 sản phẩm mất bao nhiêu phút (Biểu B1) */
  phutThucTe: number;
  /** 9. Giờ bổ sung (Biểu B1) */
  gioBoSung: number;
  /** Danh sách công việc phối hợp liên đơn vị (tính năng mở rộng) */
  coordinatedTasks?: CoordinatedTaskLink[];
  createdAt: string;
  updatedAt: string;
}
