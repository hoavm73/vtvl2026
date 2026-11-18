import { TECHDOC_CH1 } from './hcmute-techdoc-ch1';
import { TECHDOC_CH2 } from './hcmute-techdoc-ch2';
import { TECHDOC_CH3 } from './hcmute-techdoc-ch3';
import { TECHDOC_CH4 } from './hcmute-techdoc-ch4';
import { TECHDOC_CH5_TO_6 } from './hcmute-techdoc-ch5to6';
import {
  TechDocArticleData,
  TechDocChapter,
  TECHDOC_CHANGELOG,
  TECHDOC_PORTAL_META
} from './hcmute-techdoc-types';

export * from './hcmute-techdoc-types';
export const TECHDOC_META = TECHDOC_PORTAL_META;
export { TECHDOC_CHANGELOG };

export const TECHDOC_CHAPTERS: TechDocChapter[] = [
  TECHDOC_CH1,
  TECHDOC_CH2,
  TECHDOC_CH3,
  TECHDOC_CH4,
  ...TECHDOC_CH5_TO_6
];

export const TECHDOC_ALL_ARTICLES: TechDocArticleData[] = TECHDOC_CHAPTERS.flatMap(
  (ch) => ch.articles
);

export function getTechDocArticleById(docId?: string | null): TechDocArticleData {
  if (docId) {
    const found = TECHDOC_ALL_ARTICLES.find((a) => a.id === docId);
    if (found) return found;
  }
  return TECHDOC_ALL_ARTICLES.find((a) => a.id === '2.1') || TECHDOC_ALL_ARTICLES[0];
}

export function getDefaultDocIdForRole(role?: string): string {
  if (role === 'admin') return '4.1';
  if (role === 'unit_leader') return '3.1';
  return '2.1';
}

export function formatTechDocMarkdown(article: TechDocArticleData): string {
  const lines: string[] = [
    `# ${article.title}`,
    '',
    `> **Chương:** ${article.chapterLabel} · **Phiên bản:** ${TECHDOC_PORTAL_META.version} · **Ngày cập nhật:** ${TECHDOC_PORTAL_META.updatedAt}`,
    '',
    article.description,
    '',
    article.intro,
    '',
    '## Thao tác nhanh (Dành cho Thầy/Cô)',
    `- **Điều kiện tiên quyết:** ${article.quickAction.prerequisite}`,
    ...article.quickAction.coreSteps.map((s, i) => `${i + 1}. ${s}`),
    ''
  ];

  for (const t of article.tasks) {
    lines.push(`## ${t.title}`, '');
    lines.push('### Mục đích', t.purpose, '');
    lines.push('### Các bước thực hiện', ...t.steps.map((s, i) => `${i + 1}. ${s}`), '');
    lines.push('### Kết quả', t.result, '');
    if (t.note) {
      lines.push('### Lưu ý', t.note, '');
    }
  }

  lines.push('## Sơ đồ quy trình nghiệp vụ', '', '```mermaid', article.mermaidCode, '```', '');
  lines.push('## ⚠️ Các tình huống thường gặp và cách xử lý', '');
  for (const item of article.troubleshooting) {
    lines.push(`### ${item.situation}`, `- **Nguyên nhân:** ${item.cause}`, `- **Cách xử lý:** ${item.solution}`, '');
  }

  return lines.join('\n');
}
