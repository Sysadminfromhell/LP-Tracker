export interface AdminPlayer {
  id: number;
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
  enabled: boolean;
  profileImageUrl: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rankScore: number | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
}
export interface AdminPlayersResponse {
  players: AdminPlayer[];
}
export interface AdminPlayerResponse {
  ok: boolean;
  player: AdminPlayer;
}
export interface AdminPlayerRefreshResponse {
  ok: boolean;
  player: AdminPlayer | null;
}
export interface AdminPlayerRefreshFailure {
  id: number;
  gameName: string;
  tagLine: string;
}
export interface AdminPlayersRefreshResponse {
  ok: boolean;
  refreshed: number;
  failed: AdminPlayerRefreshFailure[];
  players: AdminPlayer[];
}
export interface AdminPlayersRefreshErrorResponse {
  error: string;
  refreshed: number;
  failed: AdminPlayerRefreshFailure[];
  players: AdminPlayer[];
}
