import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLpReconciliationContext: vi.fn(),
  applyLpReconciliationResolutions: vi.fn(),
  completeClaimedLpReconciliation: vi.fn(),
  retryClaimedLpReconciliation: vi.fn(),
}));
vi.mock('../src/db/lp-reconciliation', () => ({
  getLpReconciliationContext: mocks.getLpReconciliationContext,
  applyLpReconciliationResolutions: mocks.applyLpReconciliationResolutions,
  completeClaimedLpReconciliation: mocks.completeClaimedLpReconciliation,
  retryClaimedLpReconciliation: mocks.retryClaimedLpReconciliation,
}));

import { reconcileLpParticipant } from '../src/services/lp-reconciliation.service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLpReconciliationContext.mockResolvedValue({
    eventParticipantId: 50,
    eventId: 33,
    eventStatus: 'active',
    playerId: 5,
    gameName: 'TestPlayer',
    tagLine: 'EUW',
    region: 'euw',
    startRankScore: 2200,
    leftRankScore: 2200,
    rightRankScore: null,
    rightBoundaryAt: null,
    unresolvedBlockSynchronized: true,
    rankObservations: [
      {
        id: 471,
        eventParticipantId: 50,
        rankScore: 2218,
        observedAt: '2026-09-10T10:35:00.000Z',
        source: 'profile_refresh',
      },
    ],
    unresolvedMatches: [
      {
        id: 101,
        providerMatchId: 'match-1',
        gameCreatedAt: '2026-09-10T10:00:00.000Z',
        durationSeconds: 1800,
        result: 'WIN',
        lpDeltaStatus: 'unknown',
      },
    ],
  });
  mocks.applyLpReconciliationResolutions.mockResolvedValue({
    applied: true,
    resolvedMatches: 1,
    remainingUnresolved: false,
    reason: null,
  });
  mocks.completeClaimedLpReconciliation.mockResolvedValue(true);
  mocks.retryClaimedLpReconciliation.mockResolvedValue(true);
});

describe('current match LP reconciliation', () => {
  it('resolves a synchronized latest match from a later rank observation', async () => {
    const result = await reconcileLpParticipant(50, 1);
    expect(mocks.applyLpReconciliationResolutions).toHaveBeenCalledWith({
      eventParticipantId: 50,
      attemptCount: 1,
      expectedLeftRankScore: 2200,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 18,
          rankScoreAfter: 2218,
          observationId: 471,
        },
      ],
    });
    expect(mocks.retryClaimedLpReconciliation).not.toHaveBeenCalled();
    expect(mocks.completeClaimedLpReconciliation).toHaveBeenCalledWith(50, 1);
    expect(result).toEqual({
      status: 'resolved',
      resolvedMatches: 1,
      message: 'LP reconciliation complete',
    });
  });
});
