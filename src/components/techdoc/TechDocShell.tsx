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
  const [selectedDocOverride, setSelectedDocOverride] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('canbo@hcmute.edu.vn');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const cur = getCurrentOperatorSession();
    if (cur?.email) setUserEmail(cur.email);
    if (cur?.role) setRoleDefaultDocId(getDefaultDocIdForRole(cur.role));
  }, []);

  useEffect(() => {
    setSelectedDocOverride(null);
  }, [docParam]);

  useEffect(() => {
    const onDocChanged = (ev: Event) => {
      const nextDoc = (ev as CustomEvent<{ doc?: string }>).detail?.doc;
      if (nextDoc) {
        setSelectedDocOverride(nextDoc);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('vtvl-techdoc-changed', onDocChanged);
    return () => window.removeEventListener('vtvl-techdoc-changed', onDocChanged);
  }, []);

  const activeArticle = useMemo(
    () => getTechDocArticleById(selectedDocOverride || docParam || roleDefaultDocId),
    [selectedDocOverride, docParam, roleDefaultDocId]
  );

  const activeIdx = TECHDOC_ALL_ARTICLES.findIndex((a) => a.id === activeArticle.id);
  const prevArticle = activeIdx > 0 ? TECHDOC_ALL_ARTICLES[activeIdx - 1] : null;
  const nextArticle =
    activeIdx >= 0 && activeIdx < TECHDOC_ALL_ARTICLES.length - 1
      ? TECHDOC_ALL_ARTICLES[activeIdx + 1]
      : null;

  const handleSelectArticle = (docId: string) => {
    setSelectedDocOverride(docId);
    router.replace(`/huong-dan?doc=${encodeURIComponent(docId)}`, { scroll: false });
    window.dispatchEvent(new CustomEvent('vtvl-techdoc-changed', { detail: { doc: docId } }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 flex items-start gap-6 print:p-0 print:max-w-none">
      {/* Drawer di động (< lg) — trên Desktop dùng trực tiếp cây trong Menu nghiệp vụ bên trái */}
      <TechDocSidebar
        chapters={TECHDOC_CHAPTERS}
        activeDocId={activeArticle.id}
        activeChapterId={activeArticle.chapterId}
        mobileOpen={mobileOpen}
        onSelectArticle={handleSelectArticle}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Nội dung bài viết chính ở giữa (mở rộng thoáng toàn phần) */}
      <TechDocArticle
        article={activeArticle}
        prevArticle={prevArticle}
        nextArticle={nextArticle}
        userEmail={userEmail}
        onSelectArticle={handleSelectArticle}
        onOpenMobileSidebar={() => setMobileOpen(true)}
      />

      {/* Mục lục bài viết bên phải (#nd-toc, 268px trên >= 1280px) */}
      <TechDocToc articleId={activeArticle.id} />
    </div>
  );
}
