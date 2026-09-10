import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import {
  completeClaimedLpReconciliation,
  getLpReconciliationContext,
  recordLpRankObservation,
  releaseClaimedLpReconciliation,
  retryClaimedLpReconciliation,
} from '../src/db/lp-reconciliation';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LP reconciliation queue', () => {
  it('records an observation without releasing an active lease', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ inserted: true }],
      rowCount: 1,
    });
    const observedAt = new Date('2026-09-10T12:00:00.000Z');
    const inserted = await recordLpRankObservation(50, 2441, observedAt, true);
    expect(inserted).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain('next_attempt_at = NOW()');
    expect(String(sql)).not.toContain('locked_until = NULL');
    expect(params).toEqual([50, 2441, observedAt, true]);
  });
  it('does not report an observation as inserted when nothing was stored', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ inserted: false }],
      rowCount: 1,
    });
    const inserted = await recordLpRankObservation(50, 2441);
    expect(inserted).toBe(false);
  });
  it('retries a matching claim and preserves a newer observation wake-up', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    const updated = await retryClaimedLpReconciliation(50, 4, 900, 'Still unresolved');
    expect(updated).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0];
    const normalized = String(sql).replace(/\s+/g, ' ');
    expect(normalized).toContain('observation.created_at > queue.last_attempt_at');
    expect(normalized).toContain('THEN NOW()');
    expect(normalized).toContain('queue.attempt_count = $2');
    expect(params).toEqual([50, 4, 900, 'Still unresolved']);
  });
  it('rejects a retry from a stale claim', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });
    const updated = await retryClaimedLpReconciliation(50, 4, 900, null);
    expect(updated).toBe(false);
  });
  it('clamps claimed retry delay to the minimum', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    await retryClaimedLpReconciliation(50, 1, 1, null);
    expect(mocks.query.mock.calls[0][1]?.[2]).toBe(30);
  });
  it('clamps claimed retry delay to the maximum', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    await retryClaimedLpReconciliation(50, 10, 999_999, null);
    expect(mocks.query.mock.calls[0][1]?.[2]).toBe(86_400);
  });
  it('completes only the matching claim with no unresolved matches', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    const completed = await completeClaimedLpReconciliation(50, 4);
    expect(completed).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0];
    const normalized = String(sql).replace(/\s+/g, ' ');
    expect(normalized).toContain('queue.attempt_count = $2');
    expect(normalized).toContain("match.lp_delta_status IN ( 'pending', 'unknown' )");
    expect(params).toEqual([50, 4]);
  });
  it('does not complete a stale or still-unresolved claim', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });
    const completed = await completeClaimedLpReconciliation(50, 4);
    expect(completed).toBe(false);
  });
  it('releases only the matching claim', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    const released = await releaseClaimedLpReconciliation(50, 4);
    expect(released).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0];
    const normalized = String(sql).replace(/\s+/g, ' ');
    expect(normalized).toContain('attempt_count = $2');
    expect(normalized).toContain('locked_until = NULL');
    expect(params).toEqual([50, 4]);
  });
  it('cannot release a newer claim with an old attempt count', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });
    const released = await releaseClaimedLpReconciliation(50, 4);
    expect(released).toBe(false);
  });
});
describe('LP reconciliation context', () => {
  it('reads permanent match duration without depending on rich match details', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            event_participant_id: '50',
            event_id: '33',
            event_status: 'active',
            event_ends_at: null,
            player_id: '5',
            game_name: 'Mante',
            tag_line: 'Pog',
            region: 'euw',
            start_rank_score: 2197,
            end_rank_score: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ rank_score_after: 2235 }],
      })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
          {
            id: '102',
            provider_match_id: 'match-2',
            game_created_at: new Date('2026-09-08T19:00:00.000Z'),
            duration_seconds: 2100,
            result: 'LOSE',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            event_participant_id: '50',
            rank_score: 2254,
            observed_at: new Date('2026-09-08T18:40:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ synchronized: true }],
      });
    const context = await getLpReconciliationContext(50);
    expect(context?.leftRankScore).toBe(2235);
    expect(context?.unresolvedBlockSynchronized).toBe(true);
    expect(context?.unresolvedMatches).toEqual([
      {
        id: 101,
        providerMatchId: 'match-1',
        gameCreatedAt: '2026-09-08T18:00:00.000Z',
        durationSeconds: 1800,
        result: 'WIN',
        lpDeltaStatus: 'unknown',
      },
      {
        id: 102,
        providerMatchId: 'match-2',
        gameCreatedAt: '2026-09-08T19:00:00.000Z',
        durationSeconds: 2100,
        result: 'LOSE',
        lpDeltaStatus: 'unknown',
      },
    ]);
    const firstUnresolvedSql = String(mocks.query.mock.calls[1]?.[0]);
    const unresolvedBlockSql = String(mocks.query.mock.calls[4]?.[0]);
    expect(firstUnresolvedSql).toContain('em.duration_seconds');
    expect(unresolvedBlockSql).toContain('em.duration_seconds');
    expect(firstUnresolvedSql).not.toContain('event_match_details');
    expect(unresolvedBlockSql).not.toContain('event_match_details');
  });
  it('includes permanent match duration when a right anchor exists', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            event_participant_id: '50',
            event_id: '33',
            event_status: 'active',
            event_ends_at: null,
            player_id: '5',
            game_name: 'Mante',
            tag_line: 'Pog',
            region: 'euw',
            start_rank_score: 2197,
            end_rank_score: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ rank_score_after: 2235 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '103',
            game_created_at: new Date('2026-09-08T20:00:00.000Z'),
            lp_delta: 20,
            rank_score_after: 2275,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [{ synchronized: true }],
      });
    const context = await getLpReconciliationContext(50);
    expect(context?.rightRankScore).toBe(2255);
    expect(context?.rightBoundaryAt).toBe('2026-09-08T20:00:00.000Z');
    expect(context?.unresolvedMatches[0]?.durationSeconds).toBe(1800);
    const unresolvedBlockSql = String(mocks.query.mock.calls[4]?.[0]);
    expect(unresolvedBlockSql).toContain('em.duration_seconds');
    expect(unresolvedBlockSql).not.toContain('event_match_details');
  });
  it('does not skip an unusable resolved right boundary to use the event end score', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            event_participant_id: '50',
            event_id: '33',
            event_status: 'ended',
            event_ends_at: new Date('2026-09-08T23:00:00.000Z'),
            player_id: '5',
            game_name: 'Mante',
            tag_line: 'Pog',
            region: 'euw',
            start_rank_score: 2197,
            end_rank_score: 2500,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ rank_score_after: 2235 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '103',
            game_created_at: new Date('2026-09-08T20:00:00.000Z'),
            lp_delta: 20,
            rank_score_after: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '101',
            provider_match_id: 'match-1',
            game_created_at: new Date('2026-09-08T18:00:00.000Z'),
            duration_seconds: 1800,
            result: 'WIN',
            lp_delta_status: 'unknown',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [{ synchronized: true }],
      });
    const context = await getLpReconciliationContext(50);
    expect(context?.rightRankScore).toBeNull();
    expect(context?.rightBoundaryAt).toBeNull();
  });
});
