import 'dotenv/config';
import type {
  RiotAccount,
  RiotApiErrorResponse,
  RiotLeagueEntry,
  RiotMatch,
  RiotMatchParticipant,
  RiotSummoner,
} from './types';
import type { LeagueDataProvider } from '../league-data.provider';
import type { QueueType, RankedQueue, SummonerMatch, SummonerProfile } from '../league-data.types';
import { parseRiotRateLimit, type RiotRateLimitStatus } from './rate-limit';
import { RiotRateLimiter } from './rate-limiter';
import {
  recordRiotRateLimitHit,
  recordRiotRequest,
  recordRiotRetry,
} from '../../runtime/monitoring-state';

type RiotRegionalRoute = 'americas' | 'asia' | 'europe' | 'sea';

interface RiotRouting {
  platform: string;
  regional: RiotRegionalRoute;
}

const REGION_ALIASES: Record<string, string> = {
  BR1: 'BR',
  EUN1: 'EUNE',
  EUW1: 'EUW',
  JP1: 'JP',
  LA1: 'LAN',
  LA2: 'LAS',
  NA1: 'NA',
  OC1: 'OCE',
  TR1: 'TR',
  PH2: 'PH',
  SG2: 'SG',
  TH2: 'TH',
  TW2: 'TW',
  VN2: 'VN',
};
const RIOT_ROUTING: Record<string, RiotRouting> = {
  BR: {
    platform: 'br1',
    regional: 'americas',
  },
  EUNE: {
    platform: 'eun1',
    regional: 'europe',
  },
  EUW: {
    platform: 'euw1',
    regional: 'europe',
  },
  JP: {
    platform: 'jp1',
    regional: 'asia',
  },
  KR: {
    platform: 'kr',
    regional: 'asia',
  },
  LAN: {
    platform: 'la1',
    regional: 'americas',
  },
  LAS: {
    platform: 'la2',
    regional: 'americas',
  },
  NA: {
    platform: 'na1',
    regional: 'americas',
  },
  OCE: {
    platform: 'oc1',
    regional: 'sea',
  },
  TR: {
    platform: 'tr1',
    regional: 'europe',
  },
  RU: {
    platform: 'ru',
    regional: 'europe',
  },
  PH: {
    platform: 'ph2',
    regional: 'sea',
  },
  SG: {
    platform: 'sg2',
    regional: 'sea',
  },
  TH: {
    platform: 'th2',
    regional: 'sea',
  },
  TW: {
    platform: 'tw2',
    regional: 'sea',
  },
  VN: {
    platform: 'vn2',
    regional: 'sea',
  },
};
const RIOT_DIVISION: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
};
const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
const DEFAULT_MATCH_LIMIT = 20;
const MAX_MATCH_LIMIT = 100;
const MAX_MATCH_CACHE_SIZE = 500;
const MAX_RATE_LIMIT_RETRIES = 2;

function resolveRiotRouting(region: string): RiotRouting {
  const normalized = region.trim().toUpperCase();
  const canonicalRegion = REGION_ALIASES[normalized] ?? normalized;
  const routing = RIOT_ROUTING[canonicalRegion];
  if (!routing) {
    throw new Error(`Unsupported Riot region: ${region}`);
  }
  return routing;
}
function mapQueueType(queueType: string): QueueType {
  switch (queueType) {
    case 'RANKED_SOLO_5x5':
      return 'SOLORANKED';
    case 'RANKED_FLEX_SR':
      return 'FLEXRANKED';
    default:
      return queueType;
  }
}
function mapLeagueEntry(entry: RiotLeagueEntry): RankedQueue {
  const tier = entry.tier.trim().toUpperCase();
  const division = APEX_TIERS.has(tier)
    ? null
    : (RIOT_DIVISION[entry.rank.trim().toUpperCase()] ?? null);
  return {
    gameType: mapQueueType(entry.queueType),
    tier,
    division,
    lp: entry.leaguePoints,
    wins: entry.wins,
    losses: entry.losses,
  };
}
function mapMatchQueue(queueId: number): QueueType {
  switch (queueId) {
    case 420:
      return 'SOLORANKED';
    case 440:
      return 'FLEXRANKED';
    default:
      return `QUEUE_${queueId}`;
  }
}
function mapMatchPosition(participant: RiotMatchParticipant): string {
  const teamPosition = participant.teamPosition?.trim();
  if (teamPosition) {
    return teamPosition.toUpperCase();
  }
  const individualPosition = participant.individualPosition?.trim();
  if (individualPosition) {
    return individualPosition.toUpperCase();
  }
  return '';
}
function normalizeMatchLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_MATCH_LIMIT;
  }
  return Math.min(MAX_MATCH_LIMIT, Math.max(1, Math.trunc(limit)));
}

export class RiotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'RiotApiError';
  }
}
export class RiotClient implements LeagueDataProvider {
  readonly name = 'riot';
  private readonly apiKey: string | null;
  private readonly rateLimiter: RiotRateLimiter;
  private dataDragonVersion: Promise<string | null> | null = null;
  private readonly accountCache = new Map<string, RiotAccount>();
  private readonly matchCache = new Map<string, RiotMatch>();
  private rateLimitStatus: RiotRateLimitStatus | null = null;
  private rateLimitWarningLogged = false;
  getRateLimitStatus(): RiotRateLimitStatus | null {
    return this.rateLimitStatus;
  }
  constructor(
    apiKey: string | undefined = process.env.RIOT_API_KEY,
    rateLimiter: RiotRateLimiter = new RiotRateLimiter(),
  ) {
    this.apiKey = apiKey?.trim() || null;
    this.rateLimiter = rateLimiter;
  }
  async connect(): Promise<void> {
    this.requireApiKey();
  }
  async disconnect(): Promise<void> {
    // Riot uses stateless HTTP requests.
  }
  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: string,
  ): Promise<RiotAccount> {
    const routing = resolveRiotRouting(region);
    const normalizedGameName = gameName.trim();
    const normalizedTagLine = tagLine.trim();
    const cacheKey =
      `${routing.platform}:` +
      `${normalizedGameName.toLowerCase()}:` +
      `${normalizedTagLine.toLowerCase()}`;
    const cached = this.accountCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const encodedGameName = encodeURIComponent(normalizedGameName);
    const encodedTagLine = encodeURIComponent(normalizedTagLine);
    const account = await this.request<RiotAccount>(
      routing.regional,

      `/riot/account/v1/accounts/by-riot-id/` + `${encodedGameName}/` + `${encodedTagLine}`,
    );
    this.accountCache.set(cacheKey, account);
    return account;
  }
  async getSummonerByPuuid(puuid: string, region: string): Promise<RiotSummoner> {
    const routing = resolveRiotRouting(region);
    const encodedPuuid = encodeURIComponent(puuid);
    return this.request<RiotSummoner>(
      routing.platform,
      `/lol/summoner/v4/summoners/by-puuid/` + encodedPuuid,
    );
  }
  async getLeagueEntriesByPuuid(puuid: string, region: string): Promise<RiotLeagueEntry[]> {
    const routing = resolveRiotRouting(region);
    const encodedPuuid = encodeURIComponent(puuid);
    return this.request<RiotLeagueEntry[]>(
      routing.platform,
      `/lol/league/v4/entries/by-puuid/` + encodedPuuid,
    );
  }
  async getSummonerProfile(
    gameName: string,
    tagLine: string,
    region: string,
  ): Promise<SummonerProfile> {
    const account = await this.getAccountByRiotId(gameName, tagLine, region);
    const [summoner, leagueEntries] = await Promise.all([
      this.getSummonerByPuuid(account.puuid, region),
      this.getLeagueEntriesByPuuid(account.puuid, region),
    ]);
    const profileImageUrl = await this.getProfileImageUrl(summoner.profileIconId);
    return {
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileImageUrl,
      queues: leagueEntries.map(mapLeagueEntry),
      lpHistory: [],
    };
  }
  async getMatchIdsByPuuid(
    puuid: string,
    region: string,
    limit = DEFAULT_MATCH_LIMIT,
  ): Promise<string[]> {
    const routing = resolveRiotRouting(region);
    const encodedPuuid = encodeURIComponent(puuid);
    const normalizedLimit = normalizeMatchLimit(limit);
    return this.request<string[]>(
      routing.regional,

      `/lol/match/v5/matches/by-puuid/` +
        `${encodedPuuid}/ids` +
        `?queue=420` +
        `&start=0` +
        `&count=${normalizedLimit}`,
    );
  }
  async getMatchById(matchId: string, region: string): Promise<RiotMatch> {
    const normalizedMatchId = matchId.trim();
    const cached = this.matchCache.get(normalizedMatchId);
    if (cached) {
      return cached;
    }
    const routing = resolveRiotRouting(region);
    const encodedMatchId = encodeURIComponent(normalizedMatchId);
    const match = await this.request<RiotMatch>(
      routing.regional,
      `/lol/match/v5/matches/` + encodedMatchId,
    );
    this.matchCache.set(normalizedMatchId, match);
    this.trimMatchCache();
    return match;
  }
  async getRecentMatches(
    gameName: string,
    tagLine: string,
    region: string,
    limit = DEFAULT_MATCH_LIMIT,
  ): Promise<SummonerMatch[]> {
    const account = await this.getAccountByRiotId(gameName, tagLine, region);
    const matchIds = await this.getMatchIdsByPuuid(account.puuid, region, limit);
    const matches: SummonerMatch[] = [];
    for (const matchId of matchIds) {
      const match = await this.getMatchById(matchId, region);
      const participant = match.info.participants.find((entry) => entry.puuid === account.puuid);
      if (!participant) {
        console.warn(`[RIOT] ${matchId}: ` + `participant ` + `${account.puuid} ` + `not found`);
        continue;
      }
      const createdAtTimestamp = match.info.gameStartTimestamp ?? match.info.gameCreation;
      const laneCs = participant.totalMinionsKilled;
      const jungleCs = participant.neutralMinionsKilled;
      const itemIds = [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6,
      ];
      matches.push({
        id: match.metadata.matchId,
        createdAt: new Date(createdAtTimestamp).toISOString(),
        gameType: mapMatchQueue(match.info.queueId),
        durationSeconds: match.info.gameDuration,
        championId: participant.championId,
        champion: participant.championName,
        position: mapMatchPosition(participant),
        items: itemIds.filter((itemId) => Number.isFinite(itemId) && itemId > 0).map(String),
        damageToChampions: participant.totalDamageDealtToChampions,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        laneCs,
        jungleCs,
        cs: laneCs + jungleCs,
        result: participant.win ? 'WIN' : 'LOSE',
      });
    }
    return matches;
  }
  private trimMatchCache(): void {
    while (this.matchCache.size > MAX_MATCH_CACHE_SIZE) {
      const oldestKey = this.matchCache.keys().next().value;
      if (typeof oldestKey !== 'string') {
        return;
      }
      this.matchCache.delete(oldestKey);
    }
  }
  private async getProfileImageUrl(profileIconId: number): Promise<string> {
    const version = await this.getDataDragonVersion();
    if (!version) {
      return '';
    }
    return (
      'https://ddragon.leagueoflegends.com/' +
      `cdn/${version}/img/profileicon/` +
      `${profileIconId}.png`
    );
  }
  private async getDataDragonVersion(): Promise<string | null> {
    if (this.dataDragonVersion) {
      return this.dataDragonVersion;
    }
    this.dataDragonVersion = (async () => {
      try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (!response.ok) {
          return null;
        }
        const versions = (await response.json()) as unknown;
        if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
          return null;
        }
        return versions[0];
      } catch {
        return null;
      }
    })();
    return this.dataDragonVersion;
  }
  private captureRateLimitStatus(headers: Headers): void {
    const status = parseRiotRateLimit(
      headers.get('x-app-rate-limit'),
      headers.get('x-app-rate-limit-count'),
    );
    if (!status) {
      return;
    }
    this.rateLimitStatus = status;
    this.rateLimiter.update(status);
    if (status.restricted && !this.rateLimitWarningLogged) {
      this.rateLimitWarningLogged = true;
      const limits = status.buckets
        .map((bucket) => `${bucket.limit} requests / ${bucket.windowSeconds}s`)
        .join(', ');
      console.warn(
        `[RIOT] WARNING: Low Riot API rate limit detected (${limits}). ` +
          'This is typical for Development or Personal API keys. ' +
          'Large events may experience delayed refreshes or HTTP 429 responses. ' +
          'A Production API key is recommended.',
      );
    }
  }
  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('RIOT_API_KEY is required');
    }
    return this.apiKey;
  }
  private async request<T>(route: string, path: string): Promise<T> {
    return this.requestWithRetry<T>(route, path, 0);
  }
  private async requestWithRetry<T>(route: string, path: string, retryCount: number): Promise<T> {
    const response = await this.rateLimiter.schedule(() => {
      recordRiotRequest();
      return fetch(`https://${route}.api.riotgames.com${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Riot-Token': this.requireApiKey(),
        },
      });
    });
    this.captureRateLimitStatus(response.headers);
    if (response.ok) {
      return (await response.json()) as T;
    }
    let message = `Riot API request failed with HTTP ${response.status}`;
    try {
      const body = (await response.json()) as RiotApiErrorResponse;
      if (body.status?.message) {
        message = body.status.message;
      }
    } catch {
      /* Keep generic HTTP message. */
    }
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
    const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
    if (response.status === 429) {
      recordRiotRateLimitHit();
    }
    if (
      response.status === 429 &&
      retryAfterSeconds !== null &&
      retryAfterSeconds >= 0 &&
      retryCount < MAX_RATE_LIMIT_RETRIES
    ) {
      this.rateLimiter.blockFor(retryAfterSeconds);
      recordRiotRetry();
      console.warn(
        `[RIOT] HTTP 429 rate limit reached. ` +
          `Retrying after ${retryAfterSeconds}s ` +
          `(${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES}).`,
      );
      return this.requestWithRetry<T>(route, path, retryCount + 1);
    }
    throw new RiotApiError(message, response.status, retryAfterSeconds);
  }
}
