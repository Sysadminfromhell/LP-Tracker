export type LegalPageSlug = 'privacy' | 'privacy-data' | 'privacy-rights' | 'imprint';
export interface LegalPageSummary {
  slug: LegalPageSlug;
  title: string;
  published: boolean;
  updatedAt: string;
}
export interface LegalPage extends LegalPageSummary {
  contentHtml: string;
}
export interface LegalPagesResponse {
  pages: LegalPage[];
}
export interface LegalPageResponse {
  page: LegalPage;
}
export interface UpdateLegalPageRequest {
  title: string;
  contentHtml: string;
  published: boolean;
}
