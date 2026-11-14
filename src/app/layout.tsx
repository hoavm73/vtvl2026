import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#004776'
};

export const metadata: Metadata = {
  title: 'Vị trí việc làm — Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)',
  description:
    'Hệ thống Vị trí việc làm theo quy trình 08 bước, 10 biểu chuẩn Hướng dẫn số 07-HD/BTCTW của Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE).'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col overflow-x-clip relative">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
