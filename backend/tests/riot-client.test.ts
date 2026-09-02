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
});
