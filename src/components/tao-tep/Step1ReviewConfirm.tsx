'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowUpRight, FileSpreadsheet, ClipboardCheck } from 'lucide-react';
import { HcmuteUnit, ProposedVtvlRow } from '@/types/vtvl';

export interface Step1ValidationError {
  id: string;
  stage: 1 | 2 | 3 | 4;
  targetId: string;
  label: string;
  message: string;
}

export function validateStep1Data(
  unit: HcmuteUnit,
  actorEmail: string,
  actorTitle: string,
  positions: ProposedVtvlRow[]
): Step1ValidationError[] {
  const errors: Step1ValidationError[] = [];
  if (!unit.code) {
    errors.push({
      id: 'err-unit',
      stage: 1,
      targetId: 'task-1-unit',
      label: 'Bước 1 — Đơn vị thực hiện (A1)',
      message: 'Vui lòng chọn đơn vị thuộc HCM-UTE trong danh mục 48 đơn vị.'
    });
  }
  const emailTrim = actorEmail.trim();
  if (!emailTrim || !emailTrim.includes('@') || !emailTrim.includes('.')) {
    errors.push({
      id: 'err-email',
      stage: 1,
      targetId: 'task-1-actor',
      label: 'Bước 1 — Email công vụ người thực hiện (S_NhatKy)',
      message: 'Vui lòng nhập địa chỉ email công vụ HCM-UTE (ví dụ: ten@hcmute.edu.vn).'
    });
  }
  if (!actorTitle.trim()) {
    errors.push({
      id: 'err-role',
      stage: 1,
      targetId: 'task-1-role',
      label: 'Bước 1 — Chức vụ / Vai trò người thực hiện (S_NhatKy)',
      message: 'Vui lòng nhập hoặc chọn chức vụ, vai trò của người lập hồ sơ tại đơn vị.'
    });
  }
  if (positions.length === 0) {
    errors.push({
      id: 'err-empty-pos',
      stage: 2,
      targetId: 'task-1-add',
      label: 'Bước 2 — Công việc & Sản phẩm đầu ra (A2)',
      message: 'Vui lòng chọn ít nhất 01 vị trí / nhóm công việc từ Khung 38 vị trí của Trường.'
    });
  }
  positions.forEach((pos, idx) => {
    if (!pos.specificName.trim()) {
      errors.push({
        id: `err-name-${pos.id}`,
        stage: 3,
        targetId: `desk-name-${pos.id}`,
        label: `Bước 5 — Vị trí số ${idx + 1} (${unit.code}-${pos.vtvlSuffix || '...'})`,
        message: 'Vui lòng nhập tên vị trí việc làm cụ thể tại đơn vị (theo Biểu 6. C1_DanhMucVTVL).'
      });
    }
    if (!pos.vtvlSuffix.trim()) {
      errors.push({
        id: `err-code-${pos.id}`,
        stage: 3,
        targetId: `desk-code-${pos.id}`,
        label: `Bước 5 — Vị trí số ${idx + 1}`,
        message: 'Vui lòng bổ sung mã hậu tố vị trí việc làm (ví dụ: GV-01, CV-01).'
      });
    }
    if (pos.proposedFte <= 0 || Number.isNaN(pos.proposedFte)) {
      errors.push({
        id: `err-fte-${pos.id}`,
        stage: 3,
        targetId: `desk-fte-${pos.id}`,
        label: `Bước 5 — Vị trí ${pos.specificName || idx + 1}`,
        message: 'Biên chế đề xuất (FTE tại Biểu 8. C3_NhuCau) phải lớn hơn 0 (tối thiểu 0.5 FTE).'
      });
    }
  });
  return errors;
}

/**
 * Kiểm tra lỗi của riêng chặng hiện tại (hoặc toàn bộ khi ở Chặng 5)
 */
export function validateStageData(
  stage: 1 | 2 | 3 | 4 | 5,
  unit: HcmuteUnit,
  actorEmail: string,
  actorTitle: string,
  positions: ProposedVtvlRow[]
): Step1ValidationError[] {
  const all = validateStep1Data(unit, actorEmail, actorTitle, positions);
  if (stage >= 4) return all;
  return all.filter((e) => e.stage === stage);
}

interface Step1ReviewConfirmProps {
  unit: HcmuteUnit;
  actorEmail: string;
  actorTitle: string;
  customDate: string;
  positions: ProposedVtvlRow[];
  loading: boolean;
  onJumpToError: (err: Step1ValidationError) => void;
  onConfirmExport: () => void;
}

export function Step1ReviewConfirm({
  unit,
  actorEmail,
  actorTitle,
  customDate,
  positions,
  loading,
  onJumpToError,
  onConfirmExport
}: Step1ReviewConfirmProps) {
  const errors = validateStep1Data(unit, actorEmail, actorTitle, positions);
  const totalStaffD1 = positions.reduce((s, p) => s + Number(p.staffCount || 0), 0);
  const totalFteC3 = Number(positions.reduce((s, p) => s + Number(p.proposedFte || 0), 0).toFixed(2));
  const diffFte = Number((totalFteC3 - totalStaffD1).toFixed(2));
  const missingStaffRows = positions.filter((p) => Number(p.staffCount || 0) === 0).length;

  return (
    <div id="task-1-staff" className="space-y-5">
      {/* Khối Kết quả hồ sơ dự kiến trước khi xác nhận (Lớp 3: Nền phụ, không dùng viền hộp lồng nhau) */}
      <div
        className={`rounded-xl p-4 sm:p-5 space-y-4 transition-colors ${
          errors.length > 0
            ? 'surface-secondary'
            : 'surface-tint'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className={`w-5 h-5 shrink-0 ${errors.length > 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]'}`} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
                Kết quả hồ sơ dự kiến
              </span>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                [{unit.code}] {unit.nameVi}
              </h3>
            </div>
          </div>
          {errors.length > 0 ? (
            <button
              type="button"
              onClick={() => onJumpToError(errors[0])}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border border-[var(--fix)]/45 bg-[var(--fix-soft)] text-xs font-bold text-[var(--fix)] cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Trạng thái: Còn {errors.length} mục cần xử lý (Đi tới lỗi)</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ok-soft)] border border-[var(--ok)]/35 text-xs font-bold text-[var(--ok)]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Trạng thái: Hồ sơ hợp lệ — sẵn sàng tạo 4 tệp</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          <div className="space-y-0.5">
            <span className="text-xs text-[var(--ink-muted)] block">Vị trí việc làm (C1)</span>
            <strong className="text-xl font-bold text-[var(--foreground)] tabular-nums">{positions.length}</strong>
          </div>
          <div className="space-y-0.5 sm:border-l sm:border-[var(--border-subtle)] sm:pl-3">
            <span className="text-xs text-[var(--ink-muted)] block">Nhân sự hiện có (D1)</span>
            <strong className="text-xl font-bold text-[var(--foreground)] tabular-nums">{totalStaffD1}</strong>
          </div>
          <div className="space-y-0.5 lg:border-l lg:border-[var(--border-subtle)] lg:pl-3">
            <span className="text-xs text-[var(--ink-muted)] block">Nhân sự đề xuất (C3)</span>
            <strong className="text-xl font-bold text-[var(--primary)] tabular-nums">{totalFteC3} FTE</strong>
          </div>
          <div className="space-y-0.5 sm:border-l sm:border-[var(--border-subtle)] sm:pl-3">
            <span className="text-xs text-[var(--ink-muted)] block">Chênh lệch</span>
            <strong className={`text-xl font-bold tabular-nums ${diffFte > 0 ? 'text-[var(--primary)]' : diffFte < 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]'}`}>
              {diffFte > 0 ? `+${diffFte}` : diffFte}
            </strong>
          </div>
          <div className="space-y-0.5 lg:border-l lg:border-[var(--border-subtle)] lg:pl-3">
            <span className="text-xs text-[var(--ink-muted)] block">Tệp sẽ tạo</span>
            <strong className="text-xl font-bold text-[var(--foreground)] tabular-nums">4 tệp</strong>
          </div>
          <div className="space-y-0.5 sm:border-l sm:border-[var(--border-subtle)] sm:pl-3">
            <span className="text-xs text-[var(--ink-muted)] block">Mục thiếu / Lỗi</span>
            <strong className={`text-xl font-bold tabular-nums ${errors.length > 0 ? 'text-[var(--fix)]' : missingStaffRows > 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]'}`}>
              {errors.length} lỗi · {missingStaffRows} lưu ý
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--ink-muted)]">
          <div>
            <strong>Người thực hiện:</strong>{' '}
            {actorTitle && actorEmail ? `${actorTitle} (${actorEmail})` : <span className="text-[var(--fix)] font-semibold">Chưa nhập đầy đủ tại Bước 1</span>}
          </div>
          <div>
            <strong>Sản phẩm đầu ra ({customDate}):</strong> Tệp đơn vị gốc (17 sheet · 10 biểu A1–D2), Tệp dự thảo, Phiếu khảo sát B1–B2 &amp; Gói .zip
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
          <span className="font-semibold text-[var(--ink-muted)]">Tài liệu &amp; mẫu thực tế chuẩn HCM-UTE đã tích hợp:</span>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/tai-ve/pl1-danh-muc-vtvl-bac-nghe-nghiep-hcmute.docx" download className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] font-bold text-[var(--primary)]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tải Phụ lục I (QL10–QL60, CM63–CM113, HT26–HT62)</span>
            </a>
            <a href="/tai-ve/tcns-hcmute-bo-bieu-hd07.xlsx" download className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] font-bold text-[var(--primary)]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tải mẫu thực tế TCNS_HCMUTE_Bo_bieu_HD07.xlsx</span>
            </a>
          </div>
        </div>
      </div>

      {/* Danh sách lỗi cần xử lý hoặc nút xác nhận xuất bộ biểu */}
      {errors.length > 0 ? (
        <div role="alert" className="rounded-xl border border-[var(--fix)] bg-[var(--fix-soft)] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-sm font-bold text-[var(--fix)]">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Có {errors.length} lỗi cần xử lý trước khi xuất bộ biểu (bấm vào từng dòng để cuộn và đặt con trỏ đúng trường):</span>
            </span>
          </div>
          <ul className="space-y-2">
            {errors.map((err) => (
              <li key={err.id}>
                <button
                  type="button"
                  onClick={() => onJumpToError(err)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--fix)]/30 bg-[var(--sheet)] px-3.5 py-2.5 text-left text-sm hover:border-[var(--fix)] cursor-pointer transition-colors"
                >
                  <div>
                    <strong className="text-[var(--fix)] block">{err.label}</strong>
                    <span className="text-[var(--foreground)]">{err.message}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] shrink-0">
                    <span>Đi tới trường</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-[var(--ok)]/40 bg-[var(--ok-soft)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--ok)]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Toàn bộ thông tin đơn vị, người thực hiện và {positions.length} vị trí việc làm đều hợp lệ.</span>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirmExport}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-deep)] text-white text-sm font-bold shadow-2xs cursor-pointer disabled:opacity-50 shrink-0 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>{loading ? 'Đang khởi tạo bộ 10 biểu…' : 'Xác nhận & Khởi tạo 4 tệp chuẩn HD 07'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
