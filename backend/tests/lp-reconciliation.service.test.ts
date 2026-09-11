import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLpReconciliationContext: vi.fn(),
  applyLpReconciliationResolutions: vi.fn(),
  completeClaimedLpReconciliation: vi.fn(),
  retryClaimedLpReconciliation: vi.fn(),
  resolveLpObservationDeltas: vi.fn(),
}));

vi.mock('../src/db/lp-reconciliation', () => ({
  getLpReconciliationContext: mocks.getLpReconciliationContext,
  applyLpReconciliationResolutions: mocks.applyLpReconciliationResolutions,
  completeClaimedLpReconciliation: mocks.completeClaimedLpReconciliation,
  retryClaimedLpReconciliation: mocks.retryClaimedLpReconciliation,
}));
vi.mock('../src/services/lp-observation-resolver', () => ({
  resolveLpObservationDeltas: mocks.resolveLpObservationDeltas,
}));

import {
  getLpReconciliationRetryDelaySeconds,
  reconcileLpParticipant,
} from '../src/services/lp-reconciliation.service';

const baseContext = {
  eventParticipantId: 50,
  eventId: 33,
  eventStatus: 'active' as const,
  playerId: 5,
  gameName: 'Mante',
  tagLine: 'Pog',
  region: 'euw',
  startRankScore: 2197,
  leftRankScore: 2235,
  rightRankScore: 2275,
  rightBoundaryAt: '2026-09-08T20:00:00.000Z',
  unresolvedBlockSynchronized: true,
  rankObservations: [
    {
      id: 1,
      eventParticipantId: 50,
      rankScore: 2254,
      observedAt: '2026-09-08T18:40:00.000Z',
    },
  ],
  unresolvedMatches: [
    {
      id: 101,
      providerMatchId: 'match-1',
      gameCreatedAt: '2026-09-08T18:00:00.000Z',
      durationSeconds: 1800,
      result: 'WIN' as const,
      lpDeltaStatus: 'unknown' as const,
    },
    {
      id: 102,
      providerMatchId: 'match-2',
      gameCreatedAt: '2026-09-08T19:00:00.000Z',
      durationSeconds: 1800,
      result: 'WIN' as const,
      lpDeltaStatus: 'unknown' as const,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLpReconciliationContext.mockResolvedValue(baseContext);
  mocks.completeClaimedLpReconciliation.mockResolvedValue(true);
  mocks.retryClaimedLpReconciliation.mockResolvedValue(true);
  mocks.resolveLpObservationDeltas.mockReturnValue([]);
});

describe('LP reconciliation service', () => {
  it('uses exponential retry delays based on attempt count', () => {
    expect(getLpReconciliationRetryDelaySeconds(1)).toBe(120);
    expect(getLpReconciliationRetryDelaySeconds(2)).toBe(300);
    expect(getLpReconciliationRetryDelaySeconds(3)).toBe(900);
    expect(getLpReconciliationRetryDelaySeconds(4)).toBe(1800);
    expect(getLpReconciliationRetryDelaySeconds(5)).toBe(3600);
    expect(getLpReconciliationRetryDelaySeconds(20)).toBe(3600);
  });
  it('completes only the matching claim when no unresolved matches remain', async () => {
    mocks.getLpReconciliationContext.mockResolvedValue({
      ...baseContext,
      unresolvedMatches: [],
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.completeClaimedLpReconciliation).toHaveBeenCalledWith(50, 4);
    expect(mocks.retryClaimedLpReconciliation).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'complete',
      resolvedMatches: 0,
      message: 'No unresolved matches',
    });
  });
  it('retries instead of completing a claim for a non-active event', async () => {
    mocks.getLpReconciliationContext.mockResolvedValue({
      ...baseContext,
      eventStatus: 'draft',
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(50, 4, 1800, 'Event is draft');
    expect(mocks.completeClaimedLpReconciliation).not.toHaveBeenCalled();
    expect(mocks.resolveLpObservationDeltas).not.toHaveBeenCalled();
    expect(result.status).toBe('retry');
  });
  it('does not resolve an unsynchronized match block', async () => {
    mocks.getLpReconciliationContext.mockResolvedValue({
      ...baseContext,
      unresolvedBlockSynchronized: false,
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.resolveLpObservationDeltas).not.toHaveBeenCalled();
    expect(mocks.applyLpReconciliationResolutions).not.toHaveBeenCalled();
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(
      50,
      4,
      1800,
      'Unresolved block is not fully synchronized',
    );
    expect(result.status).toBe('retry');
  });
  it('passes permanent match data and rank observations to the observation resolver', async () => {
    mocks.resolveLpObservationDeltas.mockReturnValue([
      {
        matchId: 'match-1',
        lpDelta: 19,
        rankScoreAfter: 2254,
      },
    ]);
    mocks.applyLpReconciliationResolutions.mockResolvedValue({
      applied: true,
      resolvedMatches: 1,
      remainingUnresolved: true,
      reason: null,
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.resolveLpObservationDeltas).toHaveBeenCalledWith(
      2235,
      [
        {
          id: 'match-1',
          createdAt: '2026-09-08T18:00:00.000Z',
          durationSeconds: 1800,
          result: 'WIN',
        },
        {
          id: 'match-2',
          createdAt: '2026-09-08T19:00:00.000Z',
          durationSeconds: 1800,
          result: 'WIN',
        },
      ],
      [
        {
          rankScore: 2254,
          observedAt: '2026-09-08T18:40:00.000Z',
        },
      ],
      {
        rightRankScore: 2275,
        rightBoundaryAt: '2026-09-08T20:00:00.000Z',
      },
    );
    expect(mocks.applyLpReconciliationResolutions).toHaveBeenCalledWith({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 2235,
      expectedRightRankScore: 2275,
      expectedRightBoundaryAt: '2026-09-08T20:00:00.000Z',
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 19,
          rankScoreAfter: 2254,
        },
      ],
    });
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(50, 4, 30, null);
    expect(result).toEqual({
      status: 'resolved',
      resolvedMatches: 1,
      message: 'Resolved 1 match(es), more unresolved matches remain',
    });
  });
  it('retries when observations cannot safely resolve any match', async () => {
    mocks.resolveLpObservationDeltas.mockReturnValue([]);
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.applyLpReconciliationResolutions).not.toHaveBeenCalled();
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(
      50,
      4,
      1800,
      'Resolved 0/2 matches',
    );
    expect(result).toEqual({
      status: 'retry',
      resolvedMatches: 0,
      message: 'Resolved 0/2 matches',
    });
  });
  it('completes the matching claim after resolving the entire block', async () => {
    mocks.resolveLpObservationDeltas.mockReturnValue([
      {
        matchId: 'match-1',
        lpDelta: 19,
        rankScoreAfter: 2254,
      },
      {
        matchId: 'match-2',
        lpDelta: 21,
        rankScoreAfter: 2275,
      },
    ]);
    mocks.applyLpReconciliationResolutions.mockResolvedValue({
      applied: true,
      resolvedMatches: 2,
      remainingUnresolved: false,
      reason: null,
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.completeClaimedLpReconciliation).toHaveBeenCalledWith(50, 4);
    expect(result).toEqual({
      status: 'resolved',
      resolvedMatches: 2,
      message: 'LP reconciliation complete',
    });
  });
  it('retries when reconciliation state changes before completion', async () => {
    mocks.resolveLpObservationDeltas.mockReturnValue([
      {
        matchId: 'match-1',
        lpDelta: 19,
        rankScoreAfter: 2254,
      },
      {
        matchId: 'match-2',
        lpDelta: 21,
        rankScoreAfter: 2275,
      },
    ]);
    mocks.applyLpReconciliationResolutions.mockResolvedValue({
      applied: true,
      resolvedMatches: 2,
      remainingUnresolved: false,
      reason: null,
    });
    mocks.completeClaimedLpReconciliation.mockResolvedValue(false);
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(
      50,
      4,
      30,
      'Reconciliation state changed before completion',
    );
    expect(result).toEqual({
      status: 'retry',
      resolvedMatches: 2,
      message: 'Reconciliation state changed before completion',
    });
  });
  it('retries through the matching claim when apply rejects stale state', async () => {
    mocks.resolveLpObservationDeltas.mockReturnValue([
      {
        matchId: 'match-1',
        lpDelta: 19,
        rankScoreAfter: 2254,
      },
    ]);
    mocks.applyLpReconciliationResolutions.mockResolvedValue({
      applied: false,
      resolvedMatches: 0,
      remainingUnresolved: true,
      reason: 'LP reconciliation claim is no longer active',
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(
      50,
      4,
      1800,
      'LP reconciliation claim is no longer active',
    );
    expect(result.status).toBe('retry');
  });
  it('converts resolver errors into a claim-safe retry', async () => {
    mocks.resolveLpObservationDeltas.mockImplementation(() => {
      throw new Error('Invalid observation timestamp');
    });
    const result = await reconcileLpParticipant(50, 4);
    expect(mocks.retryClaimedLpReconciliation).toHaveBeenCalledWith(
      50,
      4,
      1800,
      'Invalid observation timestamp',
    );
    expect(result).toEqual({
      status: 'retry',
      resolvedMatches: 0,
      message: 'Invalid observation timestamp',
    });
  });
});
