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
      [observation('2026-09-10T10:05:00.000Z', 2220)],
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
        observation('2026-09-10T10:05:00.000Z', 2220),
        observation('2026-09-10T10:10:00.000Z', 2220),
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
        observation('2026-09-10T10:05:00.000Z', 2220),
        observation('2026-09-10T10:10:00.000Z', 2230),
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
      [observation('2026-09-10T10:05:00.000Z', 2200)],
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
      [observation('2026-09-10T10:20:00.000Z', 2220)],
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
  it('does not resolve when the next match start cannot be determined', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN'),
        match('match-2', '2026-09-10T10:50:00.000Z', null, 'LOSE'),
      ],
      [observation('2026-09-10T10:05:00.000Z', 2220)],
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
      [observation('2026-09-10T10:05:00.000Z', 2220)],
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
  it('resolves the latest match from a later rank observation', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [observation('2026-09-10T10:35:00.000Z', 2218)],
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 18,
        rankScoreAfter: 2218,
      },
    ]);
  });
  it('keeps the latest match unresolved when later observations conflict', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [
        observation('2026-09-10T10:35:00.000Z', 2218),
        observation('2026-09-10T10:40:00.000Z', 2225),
      ],
    );
    expect(result).toEqual([]);
  });
  it('returns the observation used to resolve the latest match', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [
        {
          id: 471,
          rankScore: 2218,
          observedAt: '2026-09-10T10:35:00.000Z',
        },
      ],
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 18,
        rankScoreAfter: 2218,
        observationId: 471,
      },
    ]);
  });
  it('keeps the latest match unresolved when the observed delta contradicts the result', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'WIN')],
      [observation('2026-09-10T10:35:00.000Z', 2182)],
    );
    expect(result).toEqual([]);
  });
  it('resolves OP.GG end timestamps while ignoring stale unchanged observations', () => {
    const result = resolveLpObservationDeltas(
      563,
      [
        match('match-1', '2026-09-24T18:16:17.000Z', 2089, 'WIN'),
        match('match-2', '2026-09-24T19:04:17.000Z', 2584, 'LOSE'),
      ],
      [
        {
          id: 5619,
          rankScore: 581,
          observedAt: '2026-09-24T18:18:27.000Z',
        },
        {
          id: 5615,
          rankScore: 563,
          observedAt: '2026-09-24T18:18:33.632Z',
        },
        {
          id: 5620,
          rankScore: 581,
          observedAt: '2026-09-24T18:19:40.321Z',
        },
        {
          id: 5807,
          rankScore: 559,
          observedAt: '2026-09-24T19:08:38.817Z',
        },
      ],
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 18,
        rankScoreAfter: 581,
        observationId: 5619,
      },
      {
        matchId: 'match-2',
        lpDelta: -22,
        rankScoreAfter: 559,
        observationId: 5807,
      },
    ]);
  });
  it('infers a short zero-LP match as a remake from an unchanged observation', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 180, 'LOSE'),
        match('match-2', '2026-09-10T10:40:00.000Z', 1800, 'WIN'),
      ],
      [
        {
          id: 471,
          rankScore: 2200,
          observedAt: '2026-09-10T10:05:00.000Z',
        },
      ],
    );
    expect(result).toEqual([
      {
        matchId: 'match-1',
        lpDelta: 0,
        rankScoreAfter: 2200,
        observationId: 471,
        isRemake: true,
      },
    ]);
  });
  it('does not infer a normal-duration zero-LP match as a remake', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 1800, 'LOSE'),
        match('match-2', '2026-09-10T11:00:00.000Z', 1800, 'WIN'),
      ],
      [
        {
          id: 471,
          rankScore: 2200,
          observedAt: '2026-09-10T10:05:00.000Z',
        },
      ],
    );
    expect(result).toEqual([]);
  });
  it('does not infer a short match as a remake when LP changed', () => {
    const result = resolveLpObservationDeltas(
      2200,
      [
        match('match-1', '2026-09-10T10:00:00.000Z', 240, 'LOSE'),
        match('match-2', '2026-09-10T10:40:00.000Z', 1800, 'WIN'),
      ],
      [
        {
          id: 471,
          rankScore: 2180,
          observedAt: '2026-09-10T10:05:00.000Z',
        },
      ],
    );
    expect(result[0]).toEqual({
      matchId: 'match-1',
      lpDelta: -20,
      rankScoreAfter: 2180,
      observationId: 471,
    });
    expect(result[0]).not.toHaveProperty('isRemake');
  });
});
