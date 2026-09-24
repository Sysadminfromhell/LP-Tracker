import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type {
  LegalPage as LegalPageData,
  LegalPageResponse,
  LegalPageSlug,
} from '@lp-tracker/contracts';
import PublicLegalLinks from '../components/PublicLegalLinks';

const LEGAL_NAV_ITEMS: Array<{
  slug: LegalPageSlug;
  label: string;
  to: string;
}> = [
  {
    slug: 'privacy',
    label: 'Privacy Policy',
    to: '/privacy',
  },
  {
    slug: 'privacy-data',
    label: 'Processed Data',
    to: '/privacy/data',
  },
  {
    slug: 'privacy-rights',
    label: 'Your Rights',
    to: '/privacy/rights',
  },
  {
    slug: 'imprint',
    label: 'Imprint',
    to: '/imprint',
  },
];

interface LegalPageProps {
  slug: LegalPageSlug;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Update date unavailable';
  }
  return `Last updated ${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)}`;
}

function LegalNavigation({ activeSlug }: { activeSlug: LegalPageSlug }) {
  const navigate = useNavigate();
  return (
    <header className="legal-page-topbar">
      <button className="legal-home-link" type="button" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <nav className="legal-page-nav" aria-label="Legal pages">
        {LEGAL_NAV_ITEMS.map((item) => (
          <Link
            key={item.slug}
            className={item.slug === activeSlug ? 'is-active' : ''}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default function LegalPage({ slug }: LegalPageProps) {
  const [page, setPage] = useState<LegalPageData | null>(null);
  const [failedSlug, setFailedSlug] = useState<LegalPageSlug | null>(null);
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
        setFailedSlug(null);
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.name === 'AbortError') {
          return;
        }
        setFailedSlug(slug);
      });
    return () => {
      controller.abort();
    };
  }, [slug]);

  if (failedSlug === slug) {
    return (
      <main className="page legal-page">
        <section className="legal-shell">
          <LegalNavigation activeSlug={slug} />
          <div className="legal-status-card">
            <span className="eyebrow">LEGAL INFORMATION</span>
            <h1>Page unavailable</h1>
            <p>This legal page is currently not published.</p>
          </div>
          <footer className="public-page-footer legal-page-footer">
            <PublicLegalLinks />
          </footer>
        </section>
      </main>
    );
  }
  if (!page || page.slug !== slug) {
    return (
      <main className="page legal-page">
        <section className="legal-shell">
          <LegalNavigation activeSlug={slug} />
          <div className="legal-status-card">
            <span className="eyebrow">LEGAL INFORMATION</span>
            <p>Loading page...</p>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main className="page legal-page">
      <section className="legal-shell">
        <LegalNavigation activeSlug={slug} />
        <article className="legal-document">
          <div className="legal-document-meta">
            <span>LEGAL INFORMATION</span>
            <time dateTime={page.updatedAt}>{formatUpdatedAt(page.updatedAt)}</time>
          </div>
          <div
            className="legal-document-content"
            dangerouslySetInnerHTML={{ __html: page.contentHtml }}
          />
        </article>
        <footer className="public-page-footer legal-page-footer">
          <PublicLegalLinks />
        </footer>
      </section>
    </main>
  );
}
