export type LeaderboardEventStatus = 'draft' | 'scheduled' | 'active' | 'ended';
export type MatchResult = 'WIN' | 'LOSE';
export type LpDeltaStatus = 'pending' | 'resolved' | 'unknown';
export interface LeaderboardMatch {
  id: string;
  createdAt: string;
  championId: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: MatchResult;
  lpDelta: number | null;
  lpDeltaStatus: LpDeltaStatus;
}
export interface LeaderboardPlayerIdentity {
  id: number;
  gameName: string;
  tagLine: string;
  region: string;
  profileImageUrl: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
}
export interface LeaderboardRank {
  tier: string;
  division: number | null;
  lp: number;
  score: number;
}
export interface LeaderboardPlayer {
  player: LeaderboardPlayerIdentity;
  startedAt: string;
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
  rankMovement: {
    delta: number;
    changedAt: string | null;
  };
  recentMatches: LeaderboardMatch[];
  lastUpdated: string;
  error: string | null;
}
export interface LeaderboardHighlight {
  player: {
    id: number;
    gameName: string;
    tagLine: string;
    profileImageUrl: string;
  };
  value: number;
}
export interface LeaderboardHighlights {
  longestWinStreak: LeaderboardHighlight | null;
  bestKda: LeaderboardHighlight | null;
  mostWins: LeaderboardHighlight | null;
}
export interface LeaderboardResponse {
  ready: boolean;
  event: {
    id: number | null;
    name: string | null;
    startsAt: string | null;
    endsAt: string | null;
    status: LeaderboardEventStatus | null;
  };
  totalPlayers: number;
  loadedPlayers: number;
  lastUpdated: string | null;
  highlights: LeaderboardHighlights;
  players: LeaderboardPlayer[];
}
