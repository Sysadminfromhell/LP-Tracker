export type DiagnosticStatus = 'ok' | 'warning' | 'error';

export interface DiagnosticCheck {
  code: string;
  status: DiagnosticStatus;
  message: string;
  details?: unknown;
}
export interface DiagnosticReport {
  scope: string;
  generatedAt: string;
  status: DiagnosticStatus;
  checks: DiagnosticCheck[];
}
