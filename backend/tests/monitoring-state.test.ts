import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadMonitoringState() {
  return import('../src/runtime/monitoring-state.js');
}

beforeEach(() => {
  vi.resetModules();
});

describe('monitoring state', () => {
  it('starts with all counters at zero', async () => {
    const monitoring = await loadMonitoringState();
    expect(monitoring.getMonitoringState()).toEqual({
      playerRefreshAttempts: 0,
      playerRefreshSuccesses: 0,
      playerRefreshFailures: 0,
      playerRefreshLastDurationSeconds: 0,
      playerRefreshLastSuccessTimestampSeconds: 0,
      riotRequests: 0,
      riotRateLimitHits: 0,
      riotRetries: 0,
    });
  });
  it('counts player refresh results', async () => {
    const monitoring = await loadMonitoringState();
    monitoring.recordPlayerRefreshAttempt();
    monitoring.recordPlayerRefreshAttempt();
    monitoring.recordPlayerRefreshSuccess();
    monitoring.recordPlayerRefreshFailure();
    expect(monitoring.getMonitoringState()).toMatchObject({
      playerRefreshAttempts: 2,
      playerRefreshSuccesses: 1,
      playerRefreshFailures: 1,
    });
  });
  it('counts Riot API activity', async () => {
    const monitoring = await loadMonitoringState();
    monitoring.recordRiotRequest();
    monitoring.recordRiotRequest();
    monitoring.recordRiotRequest();
    monitoring.recordRiotRateLimitHit();
    monitoring.recordRiotRetry();
    monitoring.recordRiotRetry();
    expect(monitoring.getMonitoringState()).toMatchObject({
      riotRequests: 3,
      riotRateLimitHits: 1,
      riotRetries: 2,
    });
  });
  it('returns a snapshot instead of mutable internal state', async () => {
    const monitoring = await loadMonitoringState();
    const snapshot = monitoring.getMonitoringState();
    snapshot.playerRefreshAttempts = 999;
    expect(monitoring.getMonitoringState().playerRefreshAttempts).toBe(0);
  });
  it('tracks refresh duration and last success timestamp', async () => {
    const monitoring = await loadMonitoringState();
    monitoring.recordPlayerRefreshDuration(2.75);
    monitoring.recordPlayerRefreshSuccessTimestamp(1_788_456_789);
    expect(monitoring.getMonitoringState()).toMatchObject({
      playerRefreshLastDurationSeconds: 2.75,
      playerRefreshLastSuccessTimestampSeconds: 1_788_456_789,
    });
  });
});
