import type { ProviderHealth } from './health';

export type LiveUpdateEvent =
  | 'leaderboard'
  | 'player-refreshed'
  | 'events-changed'
  | 'provider-health';
export interface PlayerRefreshedLiveUpdate {
  playerId: number;
  lastUpdated: string;
}
export interface ProviderHealthLiveUpdate {
  provider: ProviderHealth;
}
