export type QueueType = 'SOLORANKED' | 'FLEXRANKED' | 'ARENA' | string;

export interface RankedQueue {
  gameType: QueueType;
  tier: string | null;
  division: number | null;
  lp: number | null;
  wins: number | null;
  losses: number | null;
}

export interface SummonerProfile {
  gameName: string;
  tagLine: string;
  profileImageUrl: string;
  queues: RankedQueue[];
}

export interface SummonerMatch {
  id: string;
  createdAt: string;
  gameType: string;
  durationSeconds: number;

  champion: string;
  position: string;
  items: string[];

  damageToChampions: number;

  kills: number;
  deaths: number;
  assists: number;

  laneCs: number;
  jungleCs: number;
  cs: number;

  result: 'WIN' | 'LOSE';
}

export interface SummonerMatch {
  id: string;
  createdAt: string;
  gameType: string;
  durationSeconds: number;

  championId: number;
  champion: string;
  position: string;
  items: string[];

  damageToChampions: number;

  kills: number;
  deaths: number;
  assists: number;

  laneCs: number;
  jungleCs: number;
  cs: number;

  result: 'WIN' | 'LOSE';
}
