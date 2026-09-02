export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}
export interface RiotSummoner {
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}
export interface RiotLeagueEntry {
  queueType: string;

  tier: string;
  rank: string;

  leaguePoints: number;

  wins: number;
  losses: number;
}
export interface RiotApiErrorResponse {
  status?: {
    message?: string;
    status_code?: number;
  };
}
