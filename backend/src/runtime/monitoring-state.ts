export interface MonitoringState {
  playerRefreshAttempts: number;
  playerRefreshSuccesses: number;
  playerRefreshFailures: number;
  riotRequests: number;
  riotRateLimitHits: number;
  riotRetries: number;
}

const state: MonitoringState = {
  playerRefreshAttempts: 0,
  playerRefreshSuccesses: 0,
  playerRefreshFailures: 0,
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
