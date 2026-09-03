export interface MonitoringState {
  playerRefreshAttempts: number;
  playerRefreshSuccesses: number;
  playerRefreshFailures: number;
  playerRefreshLastDurationSeconds: number;
  playerRefreshLastSuccessTimestampSeconds: number;
  riotRequests: number;
  riotRateLimitHits: number;
  riotRetries: number;
}

const state: MonitoringState = {
  playerRefreshAttempts: 0,
  playerRefreshSuccesses: 0,
  playerRefreshFailures: 0,
  playerRefreshLastDurationSeconds: 0,
  playerRefreshLastSuccessTimestampSeconds: 0,
  riotRequests: 0,
  riotRateLimitHits: 0,
  riotRetries: 0,
};

export function recordPlayerRefreshAttempt(): void {
  state.playerRefreshAttempts += 1;
}
export function recordPlayerRefreshSuccess(): void {
  state.playerRefreshSuccesses += 1;
}
export function recordPlayerRefreshFailure(): void {
  state.playerRefreshFailures += 1;
}
export function recordPlayerRefreshDuration(durationSeconds: number): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return;
  }
  state.playerRefreshLastDurationSeconds = durationSeconds;
}
export function recordPlayerRefreshSuccessTimestamp(timestampSeconds: number): void {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds < 0) {
    return;
  }
  state.playerRefreshLastSuccessTimestampSeconds = timestampSeconds;
}
export function recordRiotRequest(): void {
  state.riotRequests += 1;
}
export function recordRiotRateLimitHit(): void {
  state.riotRateLimitHits += 1;
}
export function recordRiotRetry(): void {
  state.riotRetries += 1;
}
export function getMonitoringState(): MonitoringState {
  return {
    ...state,
  };
}
