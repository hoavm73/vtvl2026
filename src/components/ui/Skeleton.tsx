'use client';

import React from 'react';

export function InlineSkeleton({ className = 'h-4 w-16' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-md bg-[#e2ecf7] animate-pulse align-middle ${className}`}
    />
  );
}

export function PageWorkspaceSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={statusText || 'Đang tải không gian làm việc'}
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 animate-pulse"
    >
      {/* Header banner skeleton */}
      <div className="rounded-[20px] bg-white border border-[#e2e8f0] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#dbe8f5] shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-5 w-52 max-w-full rounded-md bg-[#dbe8f5]" />
              <div className="h-3.5 w-72 max-w-full rounded-md bg-[#eef4fb]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 rounded-[10px] bg-[#dbe8f5]" />
            <div className="h-9 w-32 rounded-[10px] bg-[#eef4fb]" />
          </div>
        </div>
        {statusText && (
          <p className="text-xs font-medium text-[#476885]">{statusText}</p>
        )}
      </div>

      {/* KPI summary strip skeleton */}
      <div className="rounded-[16px] bg-white border border-[#e2e8f0] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 space-y-2">
            <div className="h-3 w-24 rounded bg-[#eef4fb]" />
            <div className="h-6 w-16 rounded-md bg-[#dbe8f5]" />
            <div className="h-2.5 w-28 rounded bg-[#f1f6fc]" />
          </div>
        ))}
      </div>

      {/* Toolbar & table/list rows skeleton */}
      <div className="rounded-[16px] bg-white border border-[#e2e8f0] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#eef3f8]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 rounded-lg bg-[#dbe8f5]" />
            <div className="h-8 w-28 rounded-lg bg-[#eef4fb]" />
            <div className="h-8 w-24 rounded-lg bg-[#eef4fb]" />
          </div>
          <div className="h-9 w-56 max-w-full rounded-lg bg-[#eef4fb]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-xl border border-[#eef3f8] bg-[#f8fbff] px-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-5 w-20 rounded-md bg-[#dbe8f5] shrink-0" />
                <div className="h-4 w-2/3 max-w-md rounded bg-[#e2ecf7]" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-6 w-20 rounded-full bg-[#e2ecf7]" />
                <div className="h-8 w-20 rounded-lg bg-[#dbe8f5]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Đang tải danh sách phiếu" className="divide-y divide-[#eef3f8] animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="relative pl-5 pr-4 py-4 space-y-2.5">
          <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[#dbe8f5]" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-28 rounded-md bg-[#dbe8f5]" />
              <div className="h-5 w-20 rounded-md bg-[#eef4fb]" />
              <div className="h-5 w-24 rounded-md bg-[#eef4fb]" />
            </div>
            <div className="h-5 w-24 rounded-full bg-[#e2ecf7]" />
          </div>
          <div className="h-4 w-3/4 rounded bg-[#dbe8f5]" />
          <div className="h-3 w-1/2 rounded bg-[#eef4fb]" />
        </div>
      ))}
    </div>
  );
}

export function TimelineListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Đang tải nhật ký hoạt động" className="relative pl-5 space-y-4 animate-pulse">
      <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="relative pb-3 border-b border-[#f1f5f9] last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="absolute -left-5 top-1.5 w-3 h-3 rounded-full ring-4 bg-[#cbd5e1] ring-[#eef4fb]" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-5 w-24 rounded-full bg-[#dbe8f5]" />
              <div className="h-4 w-32 rounded bg-[#eef4fb]" />
            </div>
            <div className="h-4 w-2/3 rounded bg-[#dbe8f5]" />
            <div className="h-3 w-1/2 rounded bg-[#eef4fb]" />
          </div>
          <div className="h-3.5 w-24 rounded bg-[#eef4fb] shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Đang tải bảng dữ liệu" className="border-t border-[#e2e8f0] divide-y divide-[#eef3f8] animate-pulse">
      <div className="h-10 bg-[#f8fafc] px-3 flex items-center gap-4">
        <div className="h-3.5 w-1/4 rounded bg-[#dbe8f5]" />
        <div className="h-3.5 w-20 rounded bg-[#eef4fb]" />
        <div className="h-3.5 w-28 rounded bg-[#eef4fb]" />
        <div className="ml-auto h-3.5 w-20 rounded bg-[#eef4fb]" />
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="px-3 py-3 flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="h-4 w-60 max-w-full rounded bg-[#dbe8f5]" />
            <div className="h-3 w-40 rounded bg-[#eef4fb]" />
          </div>
          <div className="h-4 w-10 rounded bg-[#eef4fb] shrink-0" />
          <div className="h-5 w-24 rounded-full bg-[#dbe8f5] shrink-0" />
          <div className="h-8 w-24 rounded-lg bg-[#e2ecf7] shrink-0" />
        </div>
      ))}
    </div>
  );
}
