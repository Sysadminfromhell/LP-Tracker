export interface LegalPageSummary {
  slug: string;
  title: string;
  published: boolean;
  updatedAt: string;
}
export interface LegalPage extends LegalPageSummary {
  contentHtml: string;
}
export interface LegalPagesResponse {
  pages: LegalPageSummary[];
}
export interface LegalPageResponse {
  page: LegalPage;
}
export interface UpdateLegalPageRequest {
  title: string;
  contentHtml: string;
  published: boolean;
}
