import { createLeagueDataProvider } from '../providers/league-data.factory';
import type { LeagueDataProvider } from '../providers/league-data.provider';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';

type ProviderFactory = () => LeagueDataProvider;

const createDiagnosticProvider: ProviderFactory = () =>
  createLeagueDataProvider({
    caller: 'diagnostics',
    logger: console.error,
  });

function getReportStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === 'error')) {
    return 'error';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'ok';
}

export async function runProviderDiagnostics(
  providerFactory: ProviderFactory = createDiagnosticProvider,
): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];
  let provider: LeagueDataProvider;
  try {
    provider = providerFactory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      scope: 'provider',
      generatedAt: new Date().toISOString(),
      status: 'error',
      checks: [
        {
          code: 'PROVIDER_CONFIGURATION',
          status: 'error',
          message: 'League data provider configuration is invalid',
          details: {
            error: message,
          },
        },
      ],
    };
  }
  checks.push({
    code: 'PROVIDER_CONFIGURATION',
    status: 'ok',
    message: `League data provider "${provider.name}" is configured`,
    details: {
      name: provider.name,
      maxRecentMatches: provider.maxRecentMatches ?? null,
    },
  });
  try {
    await provider.connect();
    checks.push({
      code: 'PROVIDER_CONNECTION',
      status: 'ok',
      message: `Provider "${provider.name}" connected successfully`,
    });
    const rateLimit = provider.getRateLimitStatus?.() ?? null;
    if (!rateLimit) {
      checks.push({
        code: 'PROVIDER_RATE_LIMIT',
        status: 'ok',
        message: 'Provider exposes no current rate-limit state',
      });
    } else {
      checks.push({
        code: 'PROVIDER_RATE_LIMIT',
        status: rateLimit.restricted ? 'warning' : 'ok',
        message: rateLimit.restricted
          ? 'Provider reports a restricted rate limit'
          : 'Provider rate limit is not restricted',
        details: {
          restricted: rateLimit.restricted,
          buckets: rateLimit.buckets,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      code: 'PROVIDER_CONNECTION',
      status: 'error',
      message: `Provider "${provider.name}" could not connect`,
      details: {
        error: message,
      },
    });
  } finally {
    await provider.disconnect().catch(() => {});
  }
  return {
    scope: 'provider',
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
