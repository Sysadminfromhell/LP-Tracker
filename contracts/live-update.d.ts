import type { ProviderHealth } from './health';

export type LiveUpdateEvent =
  | 'leaderboard'
  | 'player-refreshed'
  | 'events-changed'
  | 'provider-health';
export interface LeaderboardLiveUpdate {
  eventId: number | null;
  playerId?: number;
}
export interface PlayerRefreshedLiveUpdate {
  eventId: number;
  playerId: number;
  lastUpdated: string;
}
export interface ProviderHealthLiveUpdate {
  provider: ProviderHealth;
}
