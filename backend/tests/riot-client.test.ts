import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiotApiError, RiotClient } from '../src/providers/riot/client';

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
  it('preserves Riot rate limit information', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new RiotClient('RGAPI-test');
    try {
      await client.getAccountByRiotId('FourK', 'EUW', 'EUW');
      throw new Error('Expected Riot request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RiotApiError);
      expect(error).toMatchObject({
        status: 429,
        retryAfterSeconds: 7,
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
});
