import { NextResponse } from 'next/server';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { MISSIONS_BY_GROUP } from '@/configs/hcmute-hd07-catalog';
import { postServerRest } from '@/services/storage/server-supabase-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { SplitResultSummary, UnitScaleMetrics, NgachAllocationRow, ProposedVtvlRow } from '@/types/vtvl';

export async function POST(req: Request) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const summary: SplitResultSummary = body.summary;
    const extra = body.extra as {
      scaleMetrics?: UnitScaleMetrics;
      ngachAllocations?: NgachAllocationRow[];
      proposedPositions?: ProposedVtvlRow[];
    } | undefined;

    if (!summary?.unitCode) {
      return NextResponse.json({ error: 'Mã đơn vị không hợp lệ.' }, { status: 400 });
    }

    if (!caller.isAdmin && summary.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Bạn không có quyền đồng bộ hồ sơ cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    try {
      findHcmuteUnit(summary.unitCode);
    } catch {
      return NextResponse.json(
        { error: 'Đơn vị không tồn tại trong danh mục 51 đơn vị HCM-UTE.' },
        { status: 400 }
      );
    }

    const c1Rows = (summary.positionBreakdown || []).map((p) => {
      const fwMatch = ND232_2026_VTVL_CATALOG.find((f) => f.positionName === (p.frameworkTitle || p.vtvlName));
      return {
        ma_vtvl: p.vtvlCode,
        ma_don_vi: summary.unitCode,
        ma_danh_muc_nd232: fwMatch?.maDanhMucNd232 || null,
        nhom_vtvl_4: p.vtvlGroup4 || 'II. Nhóm VTVL Chuyên môn, nghiệp vụ',
        ten_khung_vtvl_truong: p.frameworkTitle || p.vtvlName,
        ten_vtvl_cu_the_don_vi: p.vtvlName,
        bac_nghe_nghiep_su_dung: p.careerLevel || 'Bậc 3',
        ma_ngach_chuc_danh: p.ngachCode,
        loai_nhan_luc: 'Viên chức',
        che_do_lam_viec: p.workingRegime,
        gio_chuan_pp2: p.standardHoursYear,
        phuong_phap: p.method,
        gio_b1_nam: p.b1HoursYear,
        gio_b2_tac_dong: p.b2NetHoursYear,
        gio_rong_nam: p.netHoursYear,
        nhu_cau_fte: p.recommendedFte
      };
    });

    const a1Rows = (MISSIONS_BY_GROUP[summary.kind] || []).map((m) => ({
      ma_nhiem_vu: `${summary.unitCode}-${m.missionSuffix}`,
      ma_don_vi: summary.unitCode,
      ten_nhiem_vu: m.missionName,
      can_cu_phap_ly: m.legalBasis,
      ky_thong_ke: '01/10/2025–30/9/2026',
      trang_thai_nv: m.status,
      nguon_nhiem_vu: m.source
    }));

    const c3Rows = (summary.positionBreakdown || []).map((p) => ({
      ma_vtvl: p.vtvlCode,
      ma_don_vi: summary.unitCode,
      phuong_phap: p.method,
      gio_b1_nam: p.b1HoursYear,
      gio_tac_dong_b2: p.b2NetHoursYear,
      gio_rong_nam: p.netHoursYear,
      gio_chuan_pp2: p.standardHoursYear,
      nguoi_quy_doi_pp2: p.recommendedFte,
      nguoi_dinh_bien_pp1: p.method.includes('PP1') ? 1 : 0,
      nguoi_can_bo_tri: p.recommendedFte
    }));

    await postServerRest('c1_vtvl', c1Rows, 'ma_vtvl');
    await postServerRest('a1_nhiem_vu', a1Rows, 'ma_nhiem_vu');
    await postServerRest('c3_nhu_cau', c3Rows, 'ma_vtvl');

    if (extra?.scaleMetrics) {
      const sm = extra.scaleMetrics;
      await postServerRest(
        'sldv_quy_mo_don_vi',
        {
          ma_don_vi: summary.unitCode,
          so_sinh_vien_quy_doi: sm.studentCount,
          so_nganh_ctdt: sm.programCount,
          so_lop_hoc_phan_nam: sm.courseSectionCount,
          so_phong_tn_xuong: sm.labWorkshopCount,
          so_de_tai_nckh_nam: sm.researchTopicCount,
          so_van_ban_ho_so_nam: sm.adminDocCount,
          he_so_quy_mo: sm.scaleMultiplier
        },
        'ma_don_vi'
      );
    }

    if (extra?.ngachAllocations && extra.ngachAllocations.length > 0) {
      const posMap = new Map((extra.proposedPositions || []).map((pos) => [pos.id, `${summary.unitCode}-${pos.vtvlSuffix}`]));
      const ngachRows = extra.ngachAllocations
        .map((ng) => ({
          id: `${summary.unitCode}-${ng.id}`,
          ma_don_vi: summary.unitCode,
          ma_ngach: ng.ngachCode,
          ten_ngach: ng.ngachName,
          so_nguoi: ng.count,
          ma_vtvl_xep_vao: posMap.get(ng.targetPositionId) || c1Rows[0]?.ma_vtvl || `${summary.unitCode}-GV-01`,
          la_dong_tach: Boolean(ng.isSplitRow),
          ghi_chu: ng.note || null
        }))
        .filter((r) => c1Rows.some((c) => c.ma_vtvl === r.ma_vtvl_xep_vao));
      if (ngachRows.length > 0) {
        await postServerRest('sldv_phan_bo_ngach', ngachRows, 'id');
      }
    }

    await postServerRest(
      't_tien_do',
      {
        ma_don_vi: summary.unitCode,
        ten_don_vi: summary.unitNameVi,
        phien_ban: `v${summary.version}`,
        so_nhiem_vu_a1: summary.missionCount,
        so_cong_viec_a2: summary.taskCount,
        so_vtvl_c1: summary.vtvlCount,
        tong_fte_c3: summary.totalStandardFte,
        email_nguoi_thuc_hien: summary.actorEmail || null,
        chuc_vu_nguoi_thuc_hien: summary.actorTitle || null,
        trang_thai_ra_soat: 'Đã khởi tạo và đồng bộ qua API máy chủ',
        du_lieu_ho_so_json: {
          unitFileName: summary.unitFileName,
          actorEmail: summary.actorEmail || '',
          actorTitle: summary.actorTitle || '',
          positionBreakdown: summary.positionBreakdown
        }
      },
      'ma_don_vi'
    );

    return NextResponse.json({ success: true, message: 'Đồng bộ hồ sơ máy chủ thành công.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi đồng bộ hồ sơ máy chủ.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

