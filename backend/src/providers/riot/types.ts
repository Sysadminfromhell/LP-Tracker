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
export interface RiotMatchMetadata {
  matchId: string;
  participants: string[];
}
export interface RiotMatchParticipant {
  puuid: string;
  championId: number;
  championName: string;
  teamPosition: string;
  individualPosition: string;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  totalDamageDealtToChampions: number;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  win: boolean;
}
export interface RiotMatchInfo {
  gameCreation: number;
  gameStartTimestamp?: number;
  gameDuration: number;
  queueId: number;
  gameMode: string;
  participants: RiotMatchParticipant[];
}
export interface RiotMatch {
  metadata: RiotMatchMetadata;
  info: RiotMatchInfo;
}
