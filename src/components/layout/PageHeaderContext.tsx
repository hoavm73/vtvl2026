'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const HEADER_ACTIONS_SLOT_ID = 'vtvl-header-actions-slot';

export type BreadcrumbIconKey =
  | 'home'
  | 'file'
  | 'unit'
  | 'sheet'
  | 'tickets'
  | 'shield'
  | 'settings'
  | 'book'
  | 'org'
  | 'chart';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: BreadcrumbIconKey;
}

interface PageHeaderContextValue {
  breadcrumbs: BreadcrumbItem[] | null;
  setBreadcrumbs: (items: BreadcrumbItem[] | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue>({
  breadcrumbs: null,
  setBreadcrumbs: () => {}
});

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[] | null>(null);
  return (
    <PageHeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageBreadcrumbs() {
  return useContext(PageHeaderContext).breadcrumbs;
}

/**
 * Thiết lập chuỗi breadcrumb động hiển thị trên thanh tiêu đề trên cùng (cạnh logo HCM-UTE).
 * Truyền khóa phụ thuộc ổn định qua JSON.stringify để tránh vòng lặp render.
 */
export function useSetPageBreadcrumbs(items: BreadcrumbItem[] | null) {
  const { setBreadcrumbs } = useContext(PageHeaderContext);
  const serialized = items ? JSON.stringify(items) : '';
  useEffect(() => {
    if (!serialized) {
      setBreadcrumbs(null);
      return;
    }
    setBreadcrumbs(JSON.parse(serialized) as BreadcrumbItem[]);
    return () => setBreadcrumbs(null);
  }, [serialized, setBreadcrumbs]);
}

/**
 * Đưa cụm nút / bộ lọc nghiệp vụ của trang lên góc phải thanh Header trên cùng (desktop >= lg).
 */
export function PageHeaderActions({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(HEADER_ACTIONS_SLOT_ID));
  }, []);
  if (!slot) return null;
  return createPortal(children, slot);
}

/**
 * Breadcrumb mặc định theo đường dẫn khi trang không khai báo breadcrumb động.
 */
export function getDefaultBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') return [{ label: 'Tổng quan', icon: 'home' }];
  if (pathname.startsWith('/phieu-cong-viec')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Nghiệp vụ cá nhân' }, { label: 'Phiếu khảo sát khối lượng công việc cá nhân', icon: 'file' }];
  }
  if (pathname.startsWith('/nghiep-vu-don-vi')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Hồ sơ đơn vị', icon: 'unit' }];
  }
  if (pathname.startsWith('/bang-tinh')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Nghiệp vụ đơn vị', href: '/nghiep-vu-don-vi' }, { label: 'Bảng tính 10 biểu', icon: 'sheet' }];
  }
  if (pathname.startsWith('/phieu-don-vi')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Nghiệp vụ đơn vị', href: '/nghiep-vu-don-vi' }, { label: 'Quản lý phiếu đơn vị', icon: 'tickets' }];
  }
  if (pathname.startsWith('/admin/tham-dinh')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Thẩm định cấp trường' }, { label: 'Thẩm định hồ sơ Đề án Vị trí việc làm', icon: 'shield' }];
  }
  if (pathname.startsWith('/admin')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Quản trị hệ thống', icon: 'settings' }];
  }
  if (pathname.startsWith('/huong-dan')) {
    return [{ label: 'Tổng quan', href: '/' }, { label: 'Hướng dẫn nghiệp vụ', icon: 'book' }];
  }
  return [{ label: 'Tổng quan', href: '/', icon: 'home' }];
}
