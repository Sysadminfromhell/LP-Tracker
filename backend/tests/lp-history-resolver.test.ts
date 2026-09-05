import { describe, expect, it } from 'vitest';
import type { RankedLpHistoryEntry, SummonerMatch } from '../src/providers/league-data.types';
import { resolveLpHistoryDeltas } from '../src/services/lp-history-resolver';

function createMatch(id: string, createdAt: string, result: 'WIN' | 'LOSE'): SummonerMatch {
  return {
    id,
    createdAt,
    gameType: 'SOLORANKED',
    durationSeconds: 1800,
    championId: 266,
    champion: 'Aatrox',
    position: 'TOP',
    items: [],
    damageToChampions: 20_000,
    kills: 5,
    deaths: 3,
    assists: 7,
    laneCs: 180,
    jungleCs: 0,
    cs: 180,
    result,
  };
}
function createHistory(createdAt: string, lp: number, division = 2): RankedLpHistoryEntry {
  return {
    createdAt,
    tier: 'GOLD',
    division,
    lp,
  };
}

describe('LP history resolver', () => {
  it('resolves multiple matches from chronological LP history', () => {
    const matches = [
      createMatch('match-1', '2026-09-05T10:00:00.000Z', 'WIN'),
      createMatch('match-2', '2026-09-05T11:00:00.000Z', 'LOSE'),
    ];
    const history = [
      createHistory('2026-09-05T10:35:00.000Z', 72),
      createHistory('2026-09-05T11:35:00.000Z', 54),
    ];
    const result = resolveLpHistoryDeltas(1450, matches, history);
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 22,
        rankScoreAfter: 1472,
      },
      {
        matchId: 'match-2',
        lpDelta: -18,
        rankScoreAfter: 1454,
      },
    ]);
  });

  it('handles promotion across divisions', () => {
    const matches = [createMatch('promotion-match', '2026-09-05T10:00:00.000Z', 'WIN')];
    const history: RankedLpHistoryEntry[] = [
      {
        createdAt: '2026-09-05T10:35:00.000Z',
        tier: 'GOLD',
        division: 1,
        lp: 12,
      },
    ];
    const result = resolveLpHistoryDeltas(1490, matches, history);
    expect(result).toEqual([
      {
        matchId: 'promotion-match',
        lpDelta: 22,
        rankScoreAfter: 1512,
      },
    ]);
  });
  it('stops when multiple history entries are ambiguous for a match', () => {
    const matches = [
      createMatch('match-1', '2026-09-05T10:00:00.000Z', 'WIN'),
      createMatch('match-2', '2026-09-05T11:00:00.000Z', 'WIN'),
    ];
    const history = [
      createHistory('2026-09-05T10:20:00.000Z', 60),
      createHistory('2026-09-05T10:40:00.000Z', 72),
    ];
    const result = resolveLpHistoryDeltas(1450, matches, history);
    expect(result).toEqual([]);
  });
  it('stops after the last unambiguously resolved match', () => {
    const matches = [
      createMatch('match-1', '2026-09-05T10:00:00.000Z', 'WIN'),
      createMatch('match-2', '2026-09-05T11:00:00.000Z', 'WIN'),
    ];
    const history = [createHistory('2026-09-05T10:35:00.000Z', 72)];
    const result = resolveLpHistoryDeltas(1450, matches, history);
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 22,
        rankScoreAfter: 1472,
      },
    ]);
  });
  it('ignores invalid LP history entries', () => {
    const matches = [createMatch('match-1', '2026-09-05T10:00:00.000Z', 'WIN')];
    const history: RankedLpHistoryEntry[] = [
      {
        createdAt: '2026-09-05T10:35:00.000Z',
        tier: null,
        division: null,
        lp: null,
      },
    ];
    const result = resolveLpHistoryDeltas(1450, matches, history);
    expect(result).toEqual([]);
  });
});
