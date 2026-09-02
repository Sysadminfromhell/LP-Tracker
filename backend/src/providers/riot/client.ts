import 'dotenv/config';
import type { RiotAccount, RiotApiErrorResponse, RiotLeagueEntry, RiotSummoner } from './types';
import type { QueueType, RankedQueue, SummonerProfile } from '../league-data.types';

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

function resolveRiotRouting(region: string): RiotRouting {
  const normalized = region.trim().toUpperCase();
  const canonicalRegion = REGION_ALIASES[normalized] ?? normalized;
  const routing = RIOT_ROUTING[canonicalRegion];
  if (!routing) {
    throw new Error(`Unsupported Riot region: ${region}`);
  }
  return routing;
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
export class RiotClient {
  readonly name = 'riot';
  private readonly apiKey: string | null;
  private dataDragonVersion: Promise<string | null> | null = null;

  constructor(apiKey: string | undefined = process.env.RIOT_API_KEY) {
    this.apiKey = apiKey?.trim() || null;
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
    const encodedGameName = encodeURIComponent(gameName.trim());
    const encodedTagLine = encodeURIComponent(tagLine.trim());
    return this.request<RiotAccount>(
      routing.regional,
      `/riot/account/v1/accounts/by-riot-id/${encodedGameName}/${encodedTagLine}`,
    );
  }
  async getSummonerByPuuid(puuid: string, region: string): Promise<RiotSummoner> {
    const routing = resolveRiotRouting(region);
    const encodedPuuid = encodeURIComponent(puuid);
    return this.request<RiotSummoner>(
      routing.platform,
      `/lol/summoner/v4/summoners/by-puuid/${encodedPuuid}`,
    );
  }
  async getLeagueEntriesByPuuid(puuid: string, region: string): Promise<RiotLeagueEntry[]> {
    const routing = resolveRiotRouting(region);
    const encodedPuuid = encodeURIComponent(puuid);
    return this.request<RiotLeagueEntry[]>(
      routing.platform,
      `/lol/league/v4/entries/by-puuid/${encodedPuuid}`,
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
      // Riot does not expose the same
      // historical LP snapshots as OP.GG.
      lpHistory: [],
    };
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
  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('RIOT_API_KEY is required');
    }
    return this.apiKey;
  }
  private async request<T>(route: string, path: string): Promise<T> {
    const response = await fetch(`https://${route}.api.riotgames.com${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Riot-Token': this.requireApiKey(),
      },
    });
    if (!response.ok) {
      let message = `Riot API request failed with HTTP ${response.status}`;
      try {
        const body = (await response.json()) as RiotApiErrorResponse;
        if (body.status?.message) {
          message = body.status.message;
        }
      } catch {
        // Keep the generic HTTP error message.
      }
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      throw new RiotApiError(
        message,
        response.status,
        Number.isFinite(retryAfter) ? retryAfter : null,
      );
    }
    return (await response.json()) as T;
  }
}
