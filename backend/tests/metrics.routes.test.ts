import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getLeaderboardMeta: vi.fn(),
  getLeagueDataProviderStatus: vi.fn(),
  getLeagueDataProviderDiagnostics: vi.fn(),
  getRefreshSchedulerStatus: vi.fn(),
  getOperationState: vi.fn(),
  getMonitoringState: vi.fn(),
}));

vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/runtime/monitoring-state', () => ({
  getMonitoringState: mocks.getMonitoringState,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  getLeaderboardMeta: mocks.getLeaderboardMeta,
}));
vi.mock('../src/services/league-data.service', () => ({
  getLeagueDataProviderStatus: mocks.getLeagueDataProviderStatus,
  getLeagueDataProviderDiagnostics: mocks.getLeagueDataProviderDiagnostics,
}));
vi.mock('../src/jobs/refresh-scheduler', () => ({
  getRefreshSchedulerStatus: mocks.getRefreshSchedulerStatus,
}));
vi.mock('../src/runtime/operation-state', () => ({
  getOperationState: mocks.getOperationState,
}));

import { createApp } from '../src/app';
import { metricsRoutes } from '../src/routes/metrics.routes';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlayers.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  mocks.getLeaderboardMeta.mockReturnValue({
    event: null,
    totalPlayers: 2,
    cachedPlayers: 1,
  });
  mocks.getMonitoringState.mockReturnValue({
    playerRefreshAttempts: 25,
    playerRefreshSuccesses: 23,
    playerRefreshFailures: 2,
    riotRequests: 150,
    riotRateLimitHits: 3,
    riotRetries: 2,
  });
  mocks.getLeagueDataProviderStatus.mockReturnValue({
    name: 'riot',
    connected: true,
  });
  mocks.getLeagueDataProviderDiagnostics.mockReturnValue({
    rateLimit: {
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    },
    warning: 'Low Riot API rate limit detected.',
  });
  mocks.getRefreshSchedulerStatus.mockReturnValue({
    targetRefreshMs: 10_000,
    spacingMs: 5_000,
    spacingSeconds: 5,
  });
  mocks.getOperationState.mockReturnValue({
    refreshInProgress: false,
    lifecycleInProgress: true,
  });
});

describe('metrics routes', () => {
  it('exposes Prometheus metrics', async () => {
    const app = createApp();
    await app.register(metricsRoutes);
    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('lp_tracker_player_refresh_attempts_total 25');
    expect(response.body).toContain('lp_tracker_player_refresh_successes_total 23');
    expect(response.body).toContain('lp_tracker_player_refresh_failures_total 2');
    expect(response.body).toContain('lp_tracker_riot_requests_total 150');
    expect(response.body).toContain('lp_tracker_riot_rate_limit_hits_total 3');
    expect(response.body).toContain('lp_tracker_riot_retries_total 2');
    expect(response.body).toContain('lp_tracker_up 1');
    expect(response.body).toContain('lp_tracker_players_enabled 2');
    expect(response.body).toContain('lp_tracker_players_event 2');
    expect(response.body).toContain('lp_tracker_players_cached 1');
    expect(response.body).toContain('lp_tracker_provider_connected{provider="riot"} 1');
    expect(response.body).toContain('lp_tracker_operation_refresh_in_progress 0');
    expect(response.body).toContain('lp_tracker_operation_lifecycle_in_progress 1');
    expect(response.body).toContain('lp_tracker_scheduler_spacing_seconds 5');
    expect(response.body).toContain('lp_tracker_riot_rate_limit{window_seconds="120"} 100');
    expect(response.body).toContain('lp_tracker_riot_rate_limit_count{window_seconds="120"} 17');
    expect(response.body).toContain('lp_tracker_riot_rate_limit_restricted 1');
    await app.close();
  });
  it('omits Riot metrics when no rate limit information is available', async () => {
    mocks.getLeagueDataProviderStatus.mockReturnValue({
      name: 'opgg',
      connected: true,
    });
    mocks.getLeagueDataProviderDiagnostics.mockReturnValue({
      rateLimit: null,
      warning: null,
    });
    const app = createApp();
    await app.register(metricsRoutes);
    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('lp_tracker_provider_connected{provider="opgg"} 1');
    expect(response.body).not.toContain('lp_tracker_riot_rate_limit{');
    await app.close();
  });
});
