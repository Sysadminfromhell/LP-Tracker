import type { SummonerMatch, SummonerProfile } from './league-data.types';

export interface LeagueDataRateLimitBucket {
  limit: number;
  count: number | null;
  windowSeconds: number;
}
export interface LeagueDataRateLimitStatus {
  buckets: LeagueDataRateLimitBucket[];
  restricted: boolean;
}
export interface LeagueDataProvider {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSummonerProfile(gameName: string, tagLine: string, region: string): Promise<SummonerProfile>;
  getRecentMatches(
    gameName: string,
    tagLine: string,
    region: string,
    limit?: number,
  ): Promise<SummonerMatch[]>;
  getRateLimitStatus?(): LeagueDataRateLimitStatus | null;
}
