import { NextResponse } from 'next/server';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { postServerRest } from '@/services/storage/server-supabase-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { AuditReportResult } from '@/types/vtvl';

export async function POST(req: Request) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { report, unitCode } = body as { report: AuditReportResult; unitCode: string };

    if (!unitCode || unitCode === 'X99') {
      return NextResponse.json({ error: 'Mã đơn vị không hợp lệ.' }, { status: 400 });
    }

    if (!caller.isAdmin && unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Bạn không có quyền đồng bộ kết quả rà soát của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    try {
      findHcmuteUnit(unitCode);
    } catch {
      return NextResponse.json(
        { error: 'Đơn vị không tồn tại trong danh mục 51 đơn vị HCM-UTE.' },
        { status: 400 }
      );
    }

    const checkDefs = [
      { stt: 1, pair: 'A1 ↔ A2', label: 'Mọi nhiệm vụ A1 đều có đầu việc A2', sheet: 'A1' },
      { stt: 2, pair: 'A2 ↔ B1', label: 'Mọi đầu việc A2 đều có thống kê sản lượng & thời gian B1', sheet: 'B1' },
      { stt: 3, pair: 'B1 ↔ DM', label: 'Độ lệch phút/SP thực tế so với chuẩn có giải trình hợp lệ', sheet: 'DM' },
      { stt: 4, pair: 'B2_CT ↔ B2', label: 'Tổng giờ giảm số hóa khớp giữa B2_CT và B2', sheet: 'B2' },
      { stt: 5, pair: 'C1 ↔ C2 ↔ C3', label: 'Danh mục VTVL, khung năng lực bậc 1–5 và FTE đồng bộ', sheet: 'C3' },
      { stt: 6, pair: 'C3 ↔ D1 ↔ D2', label: 'Phương án biên chế D2 khớp chênh lệch giữa C3 và D1', sheet: 'D2' }
    ];

    const kRows = checkDefs.map((def) => {
      const errCount = (report?.issues || []).filter((iss) => iss.sheet === def.sheet && iss.severity === 'fix').length;
      return {
        ma_don_vi: unitCode,
        stt_chi_tieu: def.stt,
        nhom_bieu_doi_soat: def.pair,
        noi_dung_kiem_tra: def.label,
        so_dong_loi: errCount,
        ket_luan: errCount === 0 ? 'ĐẠT' : 'CẦN RÀ SOÁT'
      };
    });
    await postServerRest('k_kiem_tra', kRows, 'ma_don_vi,stt_chi_tieu');

    const evidenceRows = (report?.evidenceItems || []).slice(0, 50).map((ev) => ({
      ma_don_vi: unitCode,
      loai_bang: 'Chua_du_can_cu',
      bieu_nguon: ev.sheet,
      toa_do_o: ev.cellRef,
      ma_tham_chieu: ev.refCode,
      noi_dung_phat_hien: ev.taskOrPositionName,
      nguyen_nhan: ev.reasonHint,
      thoi_han_bo_sung: 'Trước khi trình Hội đồng Trường',
      dau_moi_phu_trach: unitCode
    }));

    if (evidenceRows.length > 0) {
      await postServerRest('ra_soat_chua_du_can_cu', evidenceRows);
    }

    return NextResponse.json({ success: true, message: 'Đồng bộ kết quả rà soát thành công.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi đồng bộ kết quả rà soát.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

