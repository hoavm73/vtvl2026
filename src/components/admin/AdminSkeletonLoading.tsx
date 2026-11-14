'use client';

import React from 'react';

export function AdminSkeletonLoading() {
  return (
    <main className="min-h-screen bg-[#f8fafc] py-4 sm:py-6 px-3 sm:px-6">
      <div className="max-w-[1680px] mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-2xs space-y-4 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-5 w-48 bg-slate-200 rounded-md" />
                <div className="h-3 w-72 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-36 bg-slate-200 rounded-xl" />
              <div className="h-10 w-28 bg-slate-200 rounded-xl" />
            </div>
          </div>

          {/* Stats Bar Skeleton */}
          <div className="flex flex-wrap gap-2.5 py-1">
            <div className="h-7 w-28 bg-slate-100 rounded-lg" />
            <div className="h-7 w-32 bg-slate-100 rounded-lg" />
            <div className="h-7 w-44 bg-slate-100 rounded-lg" />
            <div className="h-7 w-24 bg-slate-100 rounded-lg" />
          </div>

          {/* Tabs Bar Skeleton */}
          <div className="flex gap-4 border-b border-[#e2e8f0] pb-2">
            <div className="h-8 w-44 bg-slate-200 rounded-md" />
            <div className="h-8 w-44 bg-slate-100 rounded-md" />
            <div className="h-8 w-44 bg-slate-100 rounded-md" />
            <div className="h-8 w-44 bg-slate-100 rounded-md" />
          </div>

          {/* Table Skeleton */}
          <div className="space-y-3 pt-2">
            <div className="h-10 w-full bg-slate-100 rounded-xl" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 w-full bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between px-4">
                <div className="h-4 w-1/4 bg-slate-200 rounded" />
                <div className="h-4 w-1/6 bg-slate-200 rounded" />
                <div className="h-4 w-1/8 bg-slate-200 rounded" />
                <div className="h-8 w-24 bg-slate-200 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
