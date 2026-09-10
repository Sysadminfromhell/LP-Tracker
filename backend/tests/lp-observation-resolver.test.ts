import { describe, expect, it } from 'vitest';
import {
  resolveLpObservationDeltas,
  type LpObservationMatchReference,
  type LpRankObservationReference,
} from '../src/services/lp-observation-resolver';

function match(
  id: string,
  createdAt: string,
  durationSeconds: number | null,
  result: 'WIN' | 'LOSE',
): LpObservationMatchReference {
  return {
    id,
    createdAt,
    durationSeconds,
    result,
  };
}
function observation(observedAt: string, rankScore: number): LpRankObservationReference {
  return {
    observedAt,
    rankScore,
  };
}

describe('resolveLpObservationDeltas', () => {
  it('resolves a single match from stable left and right anchors', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [],
      {
        rightRankScore: 2220,
        rightBoundaryAt: '2026-09-10T11:00:00.000Z',
      },
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 20,
        rankScoreAfter: 2220,
      },
    ]);
  });
  it('resolves a multi-match chain using observations and a right anchor', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:40:00.000Z', 1800, 'LOSE'),
      ],
      [observation('2026-09-10T10:35:00.000Z', 2220)],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 20,
        rankScoreAfter: 2220,
      },
      {
        matchId: 'match-2',
        lpDelta: -15,
        rankScoreAfter: 2205,
      },
    ]);
  });
  it('accepts multiple identical observations in the same gap', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', 1800, 'LOSE'),
      ],
      [
        observation('2026-09-10T10:35:00.000Z', 2220),
        observation('2026-09-10T10:40:00.000Z', 2220),
      ],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      matchId: 'match-1',
      lpDelta: 20,
      rankScoreAfter: 2220,
    });
  });
  it('rejects conflicting observations in the same gap', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', 1800, 'LOSE'),
      ],
      [
        observation('2026-09-10T10:35:00.000Z', 2220),
        observation('2026-09-10T10:40:00.000Z', 2230),
      ],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toEqual([]);
  });
  it('does not treat an unchanged observation as proof of zero LP', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', 1800, 'LOSE'),
      ],
      [observation('2026-09-10T10:35:00.000Z', 2200)],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toEqual([]);
  });
  it('ignores observations made after the next match started', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:40:00.000Z', 1800, 'LOSE'),
      ],
      [observation('2026-09-10T10:50:00.000Z', 2220)],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toEqual([]);
  });
  it('rejects a delta whose direction contradicts the match result', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [],
      {
        rightRankScore: 2180,
        rightBoundaryAt: '2026-09-10T11:00:00.000Z',
      },
    );
    expect(result).toEqual([]);
  });
  it('does not resolve through a match with unknown duration', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', null, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', 1800, 'LOSE'),
      ],
      [observation('2026-09-10T10:35:00.000Z', 2220)],
      {
        rightRankScore: 2205,
        rightBoundaryAt: '2026-09-10T11:30:00.000Z',
      },
    );
    expect(result).toEqual([]);
  });
  it('requires a timestamped right boundary for the final match', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', 1800, 'LOSE'),
      ],
      [observation('2026-09-10T10:35:00.000Z', 2220)],
      {
        rightRankScore: 2205,
      },
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 20,
        rankScoreAfter: 2220,
      },
    ]);
  });
  it('keeps the historical Mante-style backfill unresolved without observations', () => {
    const matches = Array.from({ length: 18 }, (_, index) =>
      match(
        `match-${index + 1}`,
        new Date(Date.parse('2026-09-05T14:00:00.000Z') + index * 60 * 60 * 1000).toISOString(),
        1800,
        index % 2 === 0 ? 'WIN' : 'LOSE',
      ),
    );
    const result = resolveLpObservationDeltas(2235, matches, [], {
      rightRankScore: 2441,
      rightBoundaryAt: '2026-09-08T20:26:01.000Z',
    });
    expect(result).toEqual([]);
  });
});
