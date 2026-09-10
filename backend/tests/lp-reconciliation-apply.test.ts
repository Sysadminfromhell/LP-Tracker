import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    connect: mocks.connect,
  },
}));

import { applyLpReconciliationResolutions } from '../src/db/lp-reconciliation';

interface ApplyScenario {
  participant?: {
    start_rank_score: number;
    end_rank_score: number | null;
    event_status: 'draft' | 'scheduled' | 'active' | 'ended';
    event_ends_at: Date | null;
  } | null;
  matches: Array<{
    id: string;
    provider_match_id: string;
    game_created_at: Date;
    result: 'WIN' | 'LOSE';
    lp_delta: number | null;
    rank_score_after: number | null;
    lp_delta_status: 'pending' | 'resolved' | 'unknown';
    is_sync_anchor: boolean;
  }>;
  claim?: {
    attempt_count: number;
    lease_active: boolean;
  } | null;
  remainingUnresolved?: boolean;
  matchUpdateRowCount?: number;
}

function mockApplyScenario({
  participant = {
    start_rank_score: 1500,
    end_rank_score: null,
    event_status: 'active',
    event_ends_at: null,
  },
  matches,
  claim = {
    attempt_count: 4,
    lease_active: true,
  },
  remainingUnresolved = true,
  matchUpdateRowCount = 1,
}: ApplyScenario): void {
  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });
  mocks.clientQuery.mockImplementation(async (sql: unknown) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
      return {
        rows: [],
        rowCount: null,
      };
    }
    if (
      normalized.includes('FROM event_participants ep') &&
      normalized.includes('FOR UPDATE OF ep')
    ) {
      return {
        rows: participant ? [participant] : [],
        rowCount: participant ? 1 : 0,
      };
    }
    if (normalized.includes('FROM event_matches') && normalized.includes('FOR UPDATE')) {
      return {
        rows: matches,
        rowCount: matches.length,
      };
    }
    if (normalized.includes('FROM lp_reconciliation_queue') && normalized.includes('FOR UPDATE')) {
      return {
        rows: claim ? [claim] : [],
        rowCount: claim ? 1 : 0,
      };
    }
    if (normalized.startsWith('UPDATE event_matches')) {
      return {
        rows: [],
        rowCount: matchUpdateRowCount,
      };
    }
    if (normalized.startsWith('UPDATE event_participants')) {
      return {
        rows: [],
        rowCount: 1,
      };
    }
    if (normalized.includes('SELECT EXISTS') && normalized.includes('FROM event_matches')) {
      return {
        rows: [
          {
            has_unresolved: remainingUnresolved,
          },
        ],
        rowCount: 1,
      };
    }
    throw new Error(`Unexpected SQL: ${normalized}`);
  });
}

function unresolvedMatch(
  overrides: Partial<ApplyScenario['matches'][number]> = {},
): ApplyScenario['matches'][number] {
  return {
    id: '101',
    provider_match_id: 'match-1',
    game_created_at: new Date('2026-09-08T18:00:00.000Z'),
    result: 'WIN',
    lp_delta: null,
    rank_score_after: null,
    lp_delta_status: 'unknown',
    is_sync_anchor: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LP reconciliation apply', () => {
  it('rejects a stale worker claim before writing matches', async () => {
    mockApplyScenario({
      matches: [unresolvedMatch()],
      claim: {
        attempt_count: 5,
        lease_active: true,
      },
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('LP reconciliation claim is no longer active');
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE event_matches')),
    ).toBe(false);
  });
  it('rejects an expired worker claim before writing matches', async () => {
    mockApplyScenario({
      matches: [unresolvedMatch()],
      claim: {
        attempt_count: 4,
        lease_active: false,
      },
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('LP reconciliation claim is no longer active');
  });
  it('rejects an unresolved block that is not fully synchronized', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
      ],
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('Unresolved block is not fully synchronized');
  });
  it('applies the earliest safe prefix and advances the resolved baseline', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        unresolvedMatch({
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T19:00:00.000Z'),
          result: 'LOSE',
          is_sync_anchor: true,
        }),
      ],
      remainingUnresolved: true,
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result).toEqual({
      applied: true,
      resolvedMatches: 1,
      remainingUnresolved: true,
      reason: null,
    });
    const matchUpdate = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_matches'),
    );
    expect(matchUpdate?.[1]).toEqual(['101', 20, 1520, 50]);
    const participantUpdate = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_participants'),
    );
    expect(participantUpdate?.[1]).toEqual([50, 1520]);
  });
  it('rejects resolutions that do not start with the earliest unresolved match', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        unresolvedMatch({
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T19:00:00.000Z'),
          is_sync_anchor: true,
        }),
      ],
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-2',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('earliest unresolved prefix');
  });
  it('applies a complete block only when the stable right anchor still matches', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        {
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T20:00:00.000Z'),
          result: 'LOSE',
          lp_delta: -18,
          rank_score_after: 1502,
          lp_delta_status: 'resolved',
          is_sync_anchor: true,
        },
      ],
      remainingUnresolved: false,
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: 1520,
      expectedRightBoundaryAt: '2026-09-08T20:00:00.000Z',
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result).toEqual({
      applied: true,
      resolvedMatches: 1,
      remainingUnresolved: false,
      reason: null,
    });
  });
  it('rejects a complete block when the right anchor changed', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        {
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T20:00:00.000Z'),
          result: 'LOSE',
          lp_delta: -18,
          rank_score_after: 1502,
          lp_delta_status: 'resolved',
          is_sync_anchor: true,
        },
      ],
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: 1519,
      expectedRightBoundaryAt: '2026-09-08T20:00:00.000Z',
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: 20,
          rankScoreAfter: 1520,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('Right rank anchor changed during reconciliation');
  });
  it('rejects LP direction that contradicts the match result', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        unresolvedMatch({
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T19:00:00.000Z'),
          is_sync_anchor: true,
        }),
      ],
    });
    const result = await applyLpReconciliationResolutions({
      eventParticipantId: 50,
      attemptCount: 4,
      expectedLeftRankScore: 1500,
      expectedRightRankScore: null,
      expectedRightBoundaryAt: null,
      resolutions: [
        {
          providerMatchId: 'match-1',
          lpDelta: -20,
          rankScoreAfter: 1480,
        },
      ],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('LP direction does not match result');
  });
  it('rolls back when a match can no longer be updated', async () => {
    mockApplyScenario({
      matches: [
        unresolvedMatch({
          is_sync_anchor: false,
        }),
        unresolvedMatch({
          id: '102',
          provider_match_id: 'match-2',
          game_created_at: new Date('2026-09-08T19:00:00.000Z'),
          is_sync_anchor: true,
        }),
      ],
      matchUpdateRowCount: 0,
    });
    await expect(
      applyLpReconciliationResolutions({
        eventParticipantId: 50,
        attemptCount: 4,
        expectedLeftRankScore: 1500,
        expectedRightRankScore: null,
        expectedRightBoundaryAt: null,
        resolutions: [
          {
            providerMatchId: 'match-1',
            lpDelta: 20,
            rankScoreAfter: 1520,
          },
        ],
      }),
    ).rejects.toThrow('Could not apply LP reconciliation for match 101');
    expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
