import { db } from './client';
import type { LegalPage, LegalPageSlug, LegalPageSummary } from '@lp-tracker/contracts';

import sanitizeHtml from 'sanitize-html';

export function sanitizeLegalHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'blockquote', 'a'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}

interface Row {
  slug: LegalPageSlug;
  title: string;
  content_html: string;
  published: boolean;
  updated_at: Date;
}
function map(row: Row): LegalPage {
  return {
    slug: row.slug,
    title: row.title,
    contentHtml: row.content_html,
    published: row.published,
    updatedAt: row.updated_at.toISOString(),
  };
}
function summary(row: Row): LegalPageSummary {
  const page = map(row);
  return {
    slug: page.slug,
    title: page.title,
    published: page.published,
    updatedAt: page.updatedAt,
  };
}

export async function getLegalPages(includeUnpublished = false): Promise<LegalPage[]> {
  const result = await db.query<Row>(
    `SELECT slug, title, content_html, published, updated_at FROM legal_pages ${includeUnpublished ? '' : 'WHERE published = TRUE'} ORDER BY slug`,
  );
  return result.rows.map(map);
}
export async function getLegalPage(
  slug: string,
  includeUnpublished = false,
): Promise<LegalPage | null> {
  const result = await db.query<Row>(
    `SELECT slug, title, content_html, published, updated_at FROM legal_pages WHERE slug = $1 ${includeUnpublished ? '' : 'AND published = TRUE'}`,
    [slug],
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}
export async function updateLegalPage(
  slug: string,
  input: { title: string; contentHtml: string; published: boolean },
): Promise<LegalPage | null> {
  const result = await db.query<Row>(
    `UPDATE legal_pages SET title = $2, content_html = $3, published = $4, updated_at = NOW() WHERE slug = $1 RETURNING slug, title, content_html, published, updated_at`,
    [slug, input.title.trim(), sanitizeLegalHtml(input.contentHtml), input.published],
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}
export { summary as legalPageSummary };
