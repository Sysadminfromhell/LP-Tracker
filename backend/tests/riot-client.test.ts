import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiotApiError, RiotClient } from '../src/providers/riot/client';
import { RiotRateLimiter } from '../src/providers/riot/rate-limiter';
import { getMonitoringState } from '../src/runtime/monitoring-state';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RiotClient', () => {
  it('requires an API key', async () => {
    const client = new RiotClient('');
    await expect(client.connect()).rejects.toThrow('RIOT_API_KEY is required');
  });
  it('resolves a Riot ID to an account', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          puuid: 'test-puuid',
          gameName: 'FourK',
          tagLine: 'EUW',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    await client.connect();
    const account = await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
    expect(account).toEqual({
      puuid: 'test-puuid',
      gameName: 'FourK',
      tagLine: 'EUW',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/FourK/EUW',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Riot-Token': 'RGAPI-test',
        },
      }),
    );
  });
  it('encodes Riot ID values in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          puuid: 'test-puuid',
          gameName: 'Test Player',
          tagLine: 'EU W',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    await client.getAccountByRiotId('Test Player', 'EU W', 'EUW');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Test%20Player/EU%20W',
      expect.anything(),
    );
  });
  it('rejects unsupported regions', async () => {
    const client = new RiotClient('RGAPI-test');
    await expect(client.getAccountByRiotId('FourK', 'EUW', 'MOON')).rejects.toThrow(
      'Unsupported Riot region: MOON',
    );
  });
  it('exposes Riot API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: {
            message: 'Data not found',
            status_code: 404,
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    try {
      await client.getAccountByRiotId('Unknown', 'EUW', 'EUW');
      throw new Error('Expected Riot request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RiotApiError);
      expect(error).toMatchObject({
        message: 'Data not found',
        status: 404,
        retryAfterSeconds: null,
      });
    }
  });
  it('builds a summoner profile from Riot APIs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            gameName: 'FourK',
            tagLine: 'EUW',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            profileIconId: 1234,
            revisionDate: 1,
            summonerLevel: 100,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'GOLD',
              rank: 'II',
              leaguePoints: 55,
              wins: 25,
              losses: 20,
            },
            {
              queueType: 'RANKED_FLEX_SR',
              tier: 'PLATINUM',
              rank: 'IV',
              leaguePoints: 10,
              wins: 12,
              losses: 8,
            },
          ]),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['16.17.1', '16.16.1']), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    const profile = await client.getSummonerProfile('FourK', 'EUW', 'EUW');
    expect(profile).toEqual({
      gameName: 'FourK',
      tagLine: 'EUW',
      profileImageUrl: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/profileicon/1234.png',
      queues: [
        {
          gameType: 'SOLORANKED',
          tier: 'GOLD',
          division: 2,
          lp: 55,
          wins: 25,
          losses: 20,
        },
        {
          gameType: 'FLEXRANKED',
          tier: 'PLATINUM',
          division: 4,
          lp: 10,
          wins: 12,
          losses: 8,
        },
      ],
      lpHistory: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/test-puuid',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/test-puuid',
      expect.anything(),
    );
  });
  it('maps apex tiers without a division', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            gameName: 'FourK',
            tagLine: 'EUW',
          }),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            profileIconId: 1234,
            revisionDate: 1,
            summonerLevel: 100,
          }),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'MASTER',
              rank: 'I',
              leaguePoints: 250,
              wins: 100,
              losses: 80,
            },
          ]),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['16.17.1']), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    const profile = await client.getSummonerProfile('FourK', 'EUW', 'EUW');
    expect(profile.queues[0]).toEqual({
      gameType: 'SOLORANKED',
      tier: 'MASTER',
      division: null,
      lp: 250,
      wins: 100,
      losses: 80,
    });
  });
  it('captures Riot application rate limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          puuid: 'test-puuid',
          gameName: 'FourK',
          tagLine: 'EUW',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-App-Rate-Limit': '100:120,20:1',
            'X-App-Rate-Limit-Count': '17:120,1:1',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
    expect(client.getRateLimitStatus()).toEqual({
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
  });
  it('does not warn for high Riot rate limits', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          puuid: 'test-puuid',
          gameName: 'FourK',
          tagLine: 'EUW',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-App-Rate-Limit': '30000:600,500:10',
            'X-App-Rate-Limit-Count': '10:600,1:10',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
    expect(client.getRateLimitStatus()).toEqual({
      buckets: [
        {
          limit: 30000,
          count: 10,
          windowSeconds: 600,
        },
        {
          limit: 500,
          count: 1,
          windowSeconds: 10,
        },
      ],
      restricted: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
  it('retries HTTP 429 responses after Retry-After', async () => {
    const monitoringBefore = getMonitoringState();
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const rateLimiter = new RiotRateLimiter(sleep, () => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: {
              message: 'Rate limit exceeded',
              status_code: 429,
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '7',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            gameName: 'FourK',
            tagLine: 'EUW',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test', rateLimiter);
    const account = await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
    expect(account).toEqual({
      puuid: 'test-puuid',
      gameName: 'FourK',
      tagLine: 'EUW',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(7_000);
    const monitoringAfter = getMonitoringState();
    expect(monitoringAfter.riotRequests - monitoringBefore.riotRequests).toBe(2);
    expect(monitoringAfter.riotRateLimitHits - monitoringBefore.riotRateLimitHits).toBe(1);
    expect(monitoringAfter.riotRetries - monitoringBefore.riotRetries).toBe(1);
  });
  it('throws after the maximum number of Riot rate limit retries', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const rateLimiter = new RiotRateLimiter(sleep, () => now);
    const createRateLimitResponse = () =>
      new Response(
        JSON.stringify({
          status: {
            message: 'Rate limit exceeded',
            status_code: 429,
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '2',
          },
        },
      );
    const fetchMock = vi.fn(async () => createRateLimitResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test', rateLimiter);
    try {
      await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
      throw new Error('Expected Riot request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RiotApiError);
      expect(error).toMatchObject({
        status: 429,
        retryAfterSeconds: 2,
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
  });
  it('uses discovered Riot rate limits to pace later requests', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const rateLimiter = new RiotRateLimiter(sleep, () => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'test-puuid',
            gameName: 'FourK',
            tagLine: 'EUW',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-App-Rate-Limit': '100:120,20:1',
              'X-App-Rate-Limit-Count': '1:120,1:1',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            puuid: 'second-puuid',
            gameName: 'Second',
            tagLine: 'EUW',
          }),
          {
            status: 200,
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test', rateLimiter);
    await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
    await client.getAccountByRiotId('Second', 'EUW', 'EUW');
    expect(sleep).toHaveBeenCalledWith(1_260);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
