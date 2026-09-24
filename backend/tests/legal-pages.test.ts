import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/client', () => ({ db: { query: mocks.query } }));

import { getLegalPage, sanitizeLegalHtml, updateLegalPage } from '../src/db/legal-pages';

describe('legal pages', () => {
  beforeEach(() => mocks.query.mockReset());
  it('keeps supported formatting and removes unsafe markup', () => {
    expect(
      sanitizeLegalHtml(
        '<h1>Title</h1><blockquote>Quote</blockquote><p><strong>Text</strong> <a href="mailto:test@example.com">Mail</a></p><script>alert(1)</script><img src="x" onerror="bad">',
      ),
    ).toBe(
      '<h1>Title</h1><blockquote>Quote</blockquote><p><strong>Text</strong> <a href="mailto:test@example.com">Mail</a></p>',
    );
  });
  it('removes unsafe link schemes', () => {
    expect(sanitizeLegalHtml('<a href="javascript:alert(1)">Bad</a>')).toBe('<a>Bad</a>');
  });
  it('returns a mapped public page', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          slug: 'privacy',
          title: 'Privacy Policy',
          content_html: '<p>Hello</p>',
          published: true,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
    await expect(getLegalPage('privacy')).resolves.toEqual({
      slug: 'privacy',
      title: 'Privacy Policy',
      contentHtml: '<p>Hello</p>',
      published: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mocks.query.mock.calls[0]?.[1]).toEqual(['privacy']);
  });
  it('sanitizes content before updating a page', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          slug: 'imprint',
          title: 'Imprint',
          content_html: '<p>Safe</p>',
          published: true,
          updated_at: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });
    await updateLegalPage('imprint', {
      title: 'Imprint',
      contentHtml: '<p>Safe</p><script>bad()</script>',
      published: true,
    });
    expect(mocks.query.mock.calls[0]?.[1]).toEqual(['imprint', 'Imprint', '<p>Safe</p>', true]);
  });
  it('returns null when an unknown page is updated', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      updateLegalPage('unknown', { title: 'Unknown', contentHtml: '', published: false }),
    ).resolves.toBeNull();
  });
});
