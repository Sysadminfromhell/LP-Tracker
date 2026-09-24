import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type {
  LegalPage as LegalPageData,
  LegalPageResponse,
  LegalPageSlug,
} from '@lp-tracker/contracts';

interface LegalPageProps {
  slug: LegalPageSlug;
}

export default function LegalPage({ slug }: LegalPageProps) {
  const [page, setPage] = useState<LegalPageData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/legal-pages/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as LegalPageResponse;
      })
      .then((data) => {
        setPage(data.page);
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.name === 'AbortError') {
          return;
        }

        setError(true);
      });

    return () => {
      controller.abort();
    };
  }, [slug]);
  if (error) {
    return (
      <main className="page">
        <div className="status-screen">This page is not available.</div>
      </main>
    );
  }
  if (!page) {
    return (
      <main className="page">
        <div className="status-screen">Loading page...</div>
      </main>
    );
  }
  return (
    <main className="page legal-page">
      <article className="legal-page-content">
        <div dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
        <Link to="/">Back to home</Link>
      </article>
    </main>
  );
}
