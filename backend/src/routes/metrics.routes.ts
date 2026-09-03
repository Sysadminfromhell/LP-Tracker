import type { FastifyInstance, FastifyReply } from 'fastify';
import { getPlayers } from '../db/players';
import { getLeaderboardMeta } from '../services/leaderboard.service';
import {
  getLeagueDataProviderDiagnostics,
  getLeagueDataProviderStatus,
} from '../services/league-data.service';
import { getRefreshSchedulerStatus } from '../jobs/refresh-scheduler';
import { getOperationState } from '../runtime/operation-state';
import { getMonitoringState } from '../runtime/monitoring-state';

function escapeLabelValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}
function addMetric(lines: string[], name: string, help: string, value: number): void {
  lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${value}`);
}
function sendMetrics(reply: FastifyReply, lines: string[]) {
  return reply.type('text/plain; version=0.0.4; charset=utf-8').send(`${lines.join('\n')}\n`);
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (_request, reply) => {
    const enabledPlayers = await getPlayers(true);
    const { totalPlayers, cachedPlayers } = getLeaderboardMeta();
    const provider = getLeagueDataProviderStatus();
    const providerDiagnostics = getLeagueDataProviderDiagnostics();
    const scheduler = getRefreshSchedulerStatus();
    const operation = getOperationState();
    const monitoring = getMonitoringState();
    const lines: string[] = [];

    addMetric(lines, 'lp_tracker_up', 'Whether the LP Tracker backend is running.', 1);
    addMetric(
      lines,
      'lp_tracker_players_enabled',
      'Number of enabled players.',
      enabledPlayers.length,
    );
    addMetric(
      lines,
      'lp_tracker_players_event',
      'Number of players in the current event.',
      totalPlayers,
    );
    addMetric(
      lines,
      'lp_tracker_players_cached',
      'Number of players with cached leaderboard data.',
      cachedPlayers,
    );

    const providerName = escapeLabelValue(provider.name ?? 'none');

    lines.push(
      '# HELP lp_tracker_provider_connected Whether the league data provider is connected.',
      '# TYPE lp_tracker_provider_connected gauge',
      `lp_tracker_provider_connected{provider="${providerName}"} ${provider.connected ? 1 : 0}`,
    );
    addMetric(
      lines,
      'lp_tracker_operation_refresh_in_progress',
      'Whether a player refresh is currently running.',
      operation.refreshInProgress ? 1 : 0,
    );
    addMetric(
      lines,
      'lp_tracker_operation_lifecycle_in_progress',
      'Whether an event lifecycle operation is currently running.',
      operation.lifecycleInProgress ? 1 : 0,
    );
    addMetric(
      lines,
      'lp_tracker_scheduler_spacing_seconds',
      'Current automatic player refresh spacing in seconds.',
      scheduler.spacingSeconds,
    );

    const rateLimit = providerDiagnostics.rateLimit;

    lines.push(
      '# HELP lp_tracker_player_refresh_attempts_total Total number of player refresh attempts.',
      '# TYPE lp_tracker_player_refresh_attempts_total counter',
      `lp_tracker_player_refresh_attempts_total ${monitoring.playerRefreshAttempts}`,

      '# HELP lp_tracker_player_refresh_successes_total Total number of successful player refreshes.',
      '# TYPE lp_tracker_player_refresh_successes_total counter',
      `lp_tracker_player_refresh_successes_total ${monitoring.playerRefreshSuccesses}`,

      '# HELP lp_tracker_player_refresh_failures_total Total number of failed player refreshes.',
      '# TYPE lp_tracker_player_refresh_failures_total counter',
      `lp_tracker_player_refresh_failures_total ${monitoring.playerRefreshFailures}`,

      '# HELP lp_tracker_riot_requests_total Total number of Riot API HTTP requests.',
      '# TYPE lp_tracker_riot_requests_total counter',
      `lp_tracker_riot_requests_total ${monitoring.riotRequests}`,

      '# HELP lp_tracker_riot_rate_limit_hits_total Total number of Riot API HTTP 429 responses.',
      '# TYPE lp_tracker_riot_rate_limit_hits_total counter',
      `lp_tracker_riot_rate_limit_hits_total ${monitoring.riotRateLimitHits}`,

      '# HELP lp_tracker_riot_retries_total Total number of Riot API requests retried after rate limiting.',
      '# TYPE lp_tracker_riot_retries_total counter',
      `lp_tracker_riot_retries_total ${monitoring.riotRetries}`,
    );
    if (rateLimit) {
      lines.push(
        '# HELP lp_tracker_riot_rate_limit Riot API application request limit.',
        '# TYPE lp_tracker_riot_rate_limit gauge',
        '# HELP lp_tracker_riot_rate_limit_count Current Riot API application request count.',
        '# TYPE lp_tracker_riot_rate_limit_count gauge',
      );
      for (const bucket of rateLimit.buckets) {
        const label = `window_seconds="${bucket.windowSeconds}"`;
        lines.push(`lp_tracker_riot_rate_limit{${label}} ${bucket.limit}`);
        if (bucket.count !== null) {
          lines.push(`lp_tracker_riot_rate_limit_count{${label}} ${bucket.count}`);
        }
      }
      addMetric(
        lines,
        'lp_tracker_riot_rate_limit_restricted',
        'Whether the detected Riot API rate limit is considered restricted.',
        rateLimit.restricted ? 1 : 0,
      );
    }
    return sendMetrics(reply, lines);
  });
}
