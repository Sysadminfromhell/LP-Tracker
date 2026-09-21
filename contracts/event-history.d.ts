import type { LeaderboardPlayerIdentity, LeaderboardRank } from './leaderboard';

export interface EventHistorySummary {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  participantCount: number;
}
export interface EventHistoryResponse {
  events: EventHistorySummary[];
}
export interface EventHistoryStanding {
  player: LeaderboardPlayerIdentity;
  start: LeaderboardRank;
  final: LeaderboardRank;
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
}
export interface EventHistoryDetailsResponse {
  event: EventHistorySummary;
  standings: EventHistoryStanding[];
}
