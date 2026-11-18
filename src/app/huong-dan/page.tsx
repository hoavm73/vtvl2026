import React, { Suspense } from 'react';
import { TechDocShell } from '@/components/techdoc/TechDocShell';
import { PageWorkspaceSkeleton } from '@/components/ui/Skeleton';

export default function HuongDanDonViPage() {
  return (
    <Suspense fallback={<PageWorkspaceSkeleton />}>
      <TechDocShell />
    </Suspense>
  );
}
