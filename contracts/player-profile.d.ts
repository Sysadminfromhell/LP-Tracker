import type { LeaderboardMatch, LeaderboardPlayerIdentity, LeaderboardRank } from './leaderboard';

export interface PlayerHistoryMatch extends LeaderboardMatch {
  durationSeconds: number | null;
  items: string[];
}
export type PlayerEventStatus = 'active' | 'ended';
export interface PlayerEventSummary {
  id: number;
  name: string;
  status: PlayerEventStatus;
  startsAt: string;
  endsAt: string | null;
  start: LeaderboardRank;
  current: LeaderboardRank;
  penalty: {
    lp: number;
    reason: string | null;
  };
  lpGain: number;
  record: {
    wins: number;
    losses: number;
    games: number;
  };
  mainRole: string | null;
  lastUpdated: string;
}
export interface PlayerProfileResponse {
  player: LeaderboardPlayerIdentity;
  latestEvent: PlayerEventSummary | null;
  previousEvents: PlayerEventSummary[];
}
export interface PlayerEventDetailsResponse {
  event: PlayerEventSummary;
  matches: PlayerHistoryMatch[];
}
