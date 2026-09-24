import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { LegalPage as LegalPageData } from '@lp-tracker/contracts';

export default function LegalPage() {
  const params = useParams();
  const slug = params.slug ? `privacy-${params.slug}` : 'privacy';
  const [page, setPage] = useState<LegalPageData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setPage(null);
    setError(false);
    void fetch(`/api/legal-pages/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('not found');
        return ((await r.json()) as { page: LegalPageData }).page;
      })
      .then(setPage)
      .catch(() => setError(true));
  }, [slug]);
  if (error)
    return (
      <main className="page">
        <div className="status-screen">This page is not available.</div>
      </main>
    );
  if (!page)
    return (
      <main className="page">
        <div className="status-screen">Loading page...</div>
      </main>
    );
  return (
    <main className="page legal-page">
      <article className="legal-page-content">
        <div dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
        <Link to="/">Back to home</Link>
      </article>
    </main>
  );
}
