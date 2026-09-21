import { runDatabaseDiagnostics } from './database';
import { runEventDiagnostics } from './event';
import { runQueueDiagnostics } from './queue';
import { runProviderDiagnostics } from './provider';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';

function getReportStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === 'error')) {
    return 'error';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'ok';
}
function createSummaryCheck(code: string, name: string, report: DiagnosticReport): DiagnosticCheck {
  const warnings = report.checks
    .filter((check) => check.status === 'warning')
    .map((check) => check.code);
  const errors = report.checks
    .filter((check) => check.status === 'error')
    .map((check) => check.code);
  return {
    code,
    status: report.status,
    message: `${name} diagnostics completed with status ${report.status}`,
    details: {
      checks: report.checks.length,
      warnings,
      errors,
    },
  };
}
export async function runSummaryDiagnostics(): Promise<DiagnosticReport> {
  const [databaseReport, eventReport, queueReport, providerReport] = await Promise.all([
    runDatabaseDiagnostics(),
    runEventDiagnostics(),
    runQueueDiagnostics(),
    runProviderDiagnostics(),
  ]);
  const checks = [
    createSummaryCheck('SUMMARY_DATABASE', 'Database', databaseReport),
    createSummaryCheck('SUMMARY_EVENT', 'Event', eventReport),
    createSummaryCheck('SUMMARY_QUEUE', 'Queue', queueReport),
    createSummaryCheck('SUMMARY_PROVIDER', 'Provider', providerReport),
  ];
  return {
    scope: 'summary',
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
