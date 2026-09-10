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
