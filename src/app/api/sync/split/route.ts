import { NextResponse } from 'next/server';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { MISSIONS_BY_GROUP } from '@/configs/hcmute-hd07-catalog';
import { postServerRestRequired } from '@/services/storage/server-supabase-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getWorkbookById, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { invalidateUnitMutationCache } from '@/services/storage/runtime-cache';
import { MAX_WORKBOOK_PAYLOAD_BYTES, readBoundedJsonBody } from '@/services/auth/payload-limiter';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { toHeavyBusyResponse, withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';
import { SplitResultSummary, UnitScaleMetrics, NgachAllocationRow, ProposedVtvlRow } from '@/types/vtvl';

export async function POST(req: Request) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_WORKBOOK_PAYLOAD_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
  }
  try {
    const body = parsed.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const summary: SplitResultSummary = body.summary;
    const extra = body.extra as {
      scaleMetrics?: UnitScaleMetrics;
      ngachAllocations?: NgachAllocationRow[];
      proposedPositions?: ProposedVtvlRow[];
    } | undefined;

    if (!summary?.unitCode) {
      return NextResponse.json({ error: 'Mã đơn vị không hợp lệ.' }, { status: 400 });
    }

    const headerSpoof = (req.headers.get('x-actor-email') || '').trim().toLowerCase();
    const bodySpoof = (summary.actorEmail || '').trim().toLowerCase();
    if (
      (headerSpoof && headerSpoof !== caller.email.toLowerCase()) ||
      (bodySpoof && bodySpoof !== caller.email.toLowerCase())
    ) {
      return NextResponse.json(
        { error: 'Không được phép giả mạo danh tính người thực hiện.', code: 'FORBIDDEN_ACTOR_SPOOFING' },
        { status: 403 }
      );
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
        { error: 'Đơn vị không tồn tại trong danh mục 39 đơn vị HCM-UTE.' },
        { status: 400 }
      );
    }

    const rateErr = enforceApiRateLimit('workbook_write', summary.unitCode);
    if (rateErr) return rateErr;

    return await withHeavyMutationBudget({ kind: 'workbook_save', unitCode: summary.unitCode, actorEmail: caller.email }, async () => {

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

    await postServerRestRequired('c1_vtvl', c1Rows, 'ma_vtvl');
    await postServerRestRequired('a1_nhiem_vu', a1Rows, 'ma_nhiem_vu');
    await postServerRestRequired('c3_nhu_cau', c3Rows, 'ma_vtvl');

    if (extra?.scaleMetrics) {
      const sm = extra.scaleMetrics;
      await postServerRestRequired(
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
        await postServerRestRequired('sldv_phan_bo_ngach', ngachRows, 'id');
      }
    }

    await syncServerWorkbooksFromSupabase().catch(() => {});
    const existingWb = getWorkbookById(`wb_${summary.unitCode}_2026`);
    const preservedServerWorkbook = existingWb
      ? { ...existingWb, revisions: Array.isArray(existingWb.revisions) ? existingWb.revisions.slice(0, 3) : [] }
      : undefined;

    await postServerRestRequired(
      't_tien_do',
      {
        ma_don_vi: summary.unitCode,
        ten_don_vi: summary.unitNameVi,
        phien_ban: `v${summary.version}`,
        so_nhiem_vu_a1: summary.missionCount,
        so_cong_viec_a2: summary.taskCount,
        so_vtvl_c1: summary.vtvlCount,
        tong_fte_c3: summary.totalStandardFte,
        email_nguoi_thuc_hien: caller.email,
        chuc_vu_nguoi_thuc_hien: summary.actorTitle || caller.role,
        trang_thai_ra_soat: 'Đã khởi tạo và đồng bộ qua API máy chủ',
        du_lieu_ho_so_json: {
          ...(preservedServerWorkbook ? { serverWorkbook: preservedServerWorkbook } : {}),
          unitFileName: summary.unitFileName,
          actorEmail: caller.email,
          actorTitle: summary.actorTitle || caller.role,
          positionBreakdown: summary.positionBreakdown
        }
      },
      'ma_don_vi'
    );

    invalidateUnitMutationCache(summary.unitCode);

    return NextResponse.json({ success: true, message: 'Đồng bộ hồ sơ máy chủ thành công.' });
    });
  } catch (error: unknown) {
    const busy = toHeavyBusyResponse(error);
    if (busy) return busy;
    const errObj = error as { table?: string; status?: number; message?: string };
    const failedTable = errObj?.table || 'unknown';
    const status = errObj?.status && errObj.status >= 500 && errObj.status < 600 ? 502 : 500;
    return NextResponse.json(
      {
        error: `Lỗi đồng bộ hồ sơ máy chủ tại bảng [${failedTable}].`,
        code: 'PERSISTENCE_FAILED',
        table: failedTable
      },
      { status }
    );
  }
}
