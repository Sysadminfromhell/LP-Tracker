import type { LeaderboardMatch, LeaderboardPlayerIdentity, LeaderboardRank } from './leaderboard';

export interface EventPlayerUnavailableResponse {
  ready: false;
  error: string;
}
export interface EventPlayerReadyResponse {
  ready: true;
  player: LeaderboardPlayerIdentity;
  startedAt: string;
  start: LeaderboardRank;
  current: LeaderboardRank;
  lpGain: number;
  record: {
    wins: number;
    losses: number;
    games: number;
  };
  recentMatches: LeaderboardMatch[];
  lastUpdated: string;
  error: string | null;
}
export type EventPlayerResponse = EventPlayerUnavailableResponse | EventPlayerReadyResponse;
