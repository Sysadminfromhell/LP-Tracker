import { describe, expect, it, vi } from 'vitest';
import type { SummonerMatch } from '../src/providers/league-data.types';
import { fetchIncrementalMatches } from '../src/services/match-sync.service';

function createMatch(id: string, createdAt: string): SummonerMatch {
  return {
    id,
    createdAt,
    gameType: 'SOLORANKED',
    durationSeconds: 1800,
    championId: 1,
    champion: 'Annie',
    position: 'MIDDLE',
    items: [],
    damageToChampions: 10000,
    kills: 5,
    deaths: 2,
    assists: 7,
    laneCs: 150,
    jungleCs: 0,
    cs: 150,
    result: 'WIN',
  };
}

describe('incremental match sync', () => {
  it('stops after the first request when the known match is found', async () => {
    const matches = [
      createMatch('match-3', '2026-09-08T18:30:00.000Z'),
      createMatch('match-2', '2026-09-08T18:00:00.000Z'),
      createMatch('match-1', '2026-09-08T17:30:00.000Z'),
    ];
    const fetchMatches = vi.fn().mockResolvedValue(matches);
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-01T18:00:00.000Z', {
      providerMatchId: 'match-2',
      gameCreatedAt: '2026-09-08T18:00:00.000Z',
    });
    expect(fetchMatches).toHaveBeenCalledTimes(1);
    expect(fetchMatches).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      matches,
      requestedLimit: 5,
      anchorReached: true,
    });
  });
  it('stops when the fetch passes the timestamp of the known match', async () => {
    const matches = [
      createMatch('match-new-2', '2026-09-08T19:00:00.000Z'),
      createMatch('match-new-1', '2026-09-08T18:30:00.000Z'),
      createMatch('match-older', '2026-09-08T17:30:00.000Z'),
    ];
    const fetchMatches = vi.fn().mockResolvedValue(matches);
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-01T18:00:00.000Z', {
      providerMatchId: 'missing-match',
      gameCreatedAt: '2026-09-08T18:00:00.000Z',
    });
    expect(fetchMatches).toHaveBeenCalledTimes(1);
    expect(fetchMatches).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      matches,
      requestedLimit: 5,
      anchorReached: true,
    });
  });
  it('increases the fetch limit until the known match is found', async () => {
    const firstBatch = [
      createMatch('match-5', '2026-09-08T20:00:00.000Z'),
      createMatch('match-4', '2026-09-08T19:30:00.000Z'),
    ];
    const secondBatch = [
      ...firstBatch,
      createMatch('match-3', '2026-09-08T19:00:00.000Z'),
      createMatch('match-2', '2026-09-08T18:30:00.000Z'),
      createMatch('match-1', '2026-09-08T18:00:00.000Z'),
    ];
    const fetchMatches = vi
      .fn()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-01T18:00:00.000Z', {
      providerMatchId: 'match-1',
      gameCreatedAt: '2026-09-08T18:00:00.000Z',
    });
    expect(fetchMatches).toHaveBeenNthCalledWith(1, 5);
    expect(fetchMatches).toHaveBeenNthCalledWith(2, 20);
    expect(result.requestedLimit).toBe(20);
    expect(result.anchorReached).toBe(true);
    expect(result.matches).toHaveLength(5);
  });
  it('uses the event start as the anchor when no match is stored yet', async () => {
    const firstBatch = [
      createMatch('match-2', '2026-09-08T19:00:00.000Z'),
      createMatch('match-1', '2026-09-08T18:30:00.000Z'),
    ];
    const secondBatch = [
      ...firstBatch,
      createMatch('match-before-start', '2026-09-08T17:30:00.000Z'),
    ];
    const fetchMatches = vi
      .fn()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-08T18:00:00.000Z', null);
    expect(fetchMatches).toHaveBeenNthCalledWith(1, 5);
    expect(fetchMatches).toHaveBeenNthCalledWith(2, 20);
    expect(result.requestedLimit).toBe(20);
    expect(result.anchorReached).toBe(true);
  });
  it('stops immediately when the provider returns no matches', async () => {
    const fetchMatches = vi.fn().mockResolvedValue([]);
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-01T18:00:00.000Z', null);
    expect(fetchMatches).toHaveBeenCalledTimes(1);
    expect(fetchMatches).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      matches: [],
      requestedLimit: 5,
      anchorReached: true,
    });
  });
  it('stops at the maximum fetch limit when no anchor can be reached', async () => {
    const fetchMatches = vi.fn(async (limit: number) =>
      Array.from({ length: limit }, (_, index) =>
        createMatch(`match-${index}`, '2026-09-08T20:00:00.000Z'),
      ),
    );
    const result = await fetchIncrementalMatches(fetchMatches, '2026-09-01T18:00:00.000Z', {
      providerMatchId: 'old-match',
      gameCreatedAt: '2026-09-01T19:00:00.000Z',
    });
    expect(fetchMatches.mock.calls).toEqual([[5], [20], [50], [100]]);
    expect(result.requestedLimit).toBe(100);
    expect(result.anchorReached).toBe(false);
    expect(result.matches).toHaveLength(100);
  });
  it('rejects an invalid event start timestamp', async () => {
    const fetchMatches = vi.fn();
    await expect(fetchIncrementalMatches(fetchMatches, 'not-a-date', null)).rejects.toThrow(
      'Invalid event start timestamp',
    );
    expect(fetchMatches).not.toHaveBeenCalled();
  });
});
