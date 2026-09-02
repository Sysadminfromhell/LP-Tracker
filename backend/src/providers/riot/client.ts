import 'dotenv/config';
import type { RiotAccount, RiotApiErrorResponse } from './types';

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
