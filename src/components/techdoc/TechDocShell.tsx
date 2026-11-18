'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TECHDOC_ALL_ARTICLES,
  TECHDOC_CHAPTERS,
  getDefaultDocIdForRole,
  getTechDocArticleById
} from '@/configs/hcmute-techdoc-roles';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { TechDocSidebar } from './TechDocSidebar';
import { TechDocArticle } from './TechDocArticle';
import { TechDocToc } from './TechDocToc';

export function TechDocShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc');

  const [roleDefaultDocId, setRoleDefaultDocId] = useState<string>('2.1');
  const [userEmail, setUserEmail] = useState<string>('canbo@hcmute.edu.vn');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const cur = getCurrentOperatorSession();
    if (cur?.email) setUserEmail(cur.email);
    if (cur?.role) setRoleDefaultDocId(getDefaultDocIdForRole(cur.role));
  }, []);

  const activeArticle = useMemo(
    () => getTechDocArticleById(docParam || roleDefaultDocId),
    [docParam, roleDefaultDocId]
  );

  const activeIdx = TECHDOC_ALL_ARTICLES.findIndex((a) => a.id === activeArticle.id);
  const prevArticle = activeIdx > 0 ? TECHDOC_ALL_ARTICLES[activeIdx - 1] : null;
  const nextArticle =
    activeIdx >= 0 && activeIdx < TECHDOC_ALL_ARTICLES.length - 1
      ? TECHDOC_ALL_ARTICLES[activeIdx + 1]
      : null;

  const handleSelectArticle = (docId: string) => {
    router.replace(`/huong-dan?doc=${encodeURIComponent(docId)}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 flex items-start gap-5 print:p-0 print:max-w-none">
      {/* Cột 1: Sidebar trái 6 chương */}
      <TechDocSidebar
        chapters={TECHDOC_CHAPTERS}
        activeDocId={activeArticle.id}
        activeChapterId={activeArticle.chapterId}
        mobileOpen={mobileOpen}
        onSelectArticle={handleSelectArticle}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Cột 2: Nội dung bài viết ở giữa */}
      <TechDocArticle
        article={activeArticle}
        prevArticle={prevArticle}
        nextArticle={nextArticle}
        userEmail={userEmail}
        onSelectArticle={handleSelectArticle}
        onOpenMobileSidebar={() => setMobileOpen(true)}
      />

      {/* Cột 3: Mục lục bài viết bên phải (#nd-toc, 268px trên >= 1280px) */}
      <TechDocToc articleId={activeArticle.id} />
    </div>
  );
}
