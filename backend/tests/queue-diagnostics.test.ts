import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { runQueueDiagnostics } from '../src/diagnostics/queue';

function createQueueRow(
  overrides: Partial<{
    event_participant_id: string;
    event_id: string;
    event_name: string;
    event_status: 'draft' | 'scheduled' | 'active' | 'ended';
    player_id: string;
    game_name: string;
    tag_line: string;
    attempt_count: number;
    next_attempt_at: Date;
    last_attempt_at: Date | null;
    last_error: string | null;
    locked_until: Date | null;
    created_at: Date;
    updated_at: Date;
    unresolved_matches: string;
    pending_matches: string;
    unknown_matches: string;
    is_due: boolean;
    lease_active: boolean;
  }> = {},
) {
  return {
    event_participant_id: '50',
    event_id: '12',
    event_name: 'September Event',
    event_status: 'active' as const,
    player_id: '7',
    game_name: 'FourK',
    tag_line: 'EUW',
    attempt_count: 1,
    next_attempt_at: new Date('2026-09-21T20:00:00.000Z'),
    last_attempt_at: new Date('2026-09-21T19:59:00.000Z'),
    last_error: null,
    locked_until: null,
    created_at: new Date('2026-09-21T19:00:00.000Z'),
    updated_at: new Date('2026-09-21T19:59:00.000Z'),
    unresolved_matches: '2',
    pending_matches: '1',
    unknown_matches: '1',
    is_due: true,
    lease_active: false,
    ...overrides,
  };
}

describe('queue diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a clean report for a healthy queue', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [createQueueRow()],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.scope).toBe('queue');
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RECONCILIATION_QUEUE_SUMMARY',
          status: 'ok',
          details: {
            total: 1,
            due: 1,
            leased: 0,
            waiting: 0,
            expectedRetries: 0,
            withErrors: 0,
          },
        }),
        expect.objectContaining({
          code: 'RECONCILIATION_QUEUE_ERRORS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'RECONCILIATION_QUEUE_WORK',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'RECONCILIATION_QUEUE_EVENT_STATE',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'RECONCILIATION_QUEUE_COVERAGE',
          status: 'ok',
        }),
      ]),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it('returns a clean report when the queue is empty', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('ok');
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_SUMMARY',
      status: 'ok',
      message: 'Reconciliation queue is empty',
      details: {
        total: 0,
        due: 0,
        leased: 0,
        waiting: 0,
        expectedRetries: 0,
        withErrors: 0,
      },
    });
  });
  it('treats normal reconciliation retry states as healthy', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          createQueueRow({
            attempt_count: 9,
            last_error: 'Resolved 0/14 matches',
          }),
          createQueueRow({
            event_participant_id: '51',
            player_id: '8',
            game_name: 'bademante',
            tag_line: 'Pog',
            attempt_count: 10,
            last_error: 'Unresolved block is not fully synchronized',
          }),
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('ok');
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        code: 'RECONCILIATION_QUEUE_RETRIES',
        status: 'ok',
        message: '2 queue item(s) are waiting on expected retry conditions',
      }),
    );
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_ERRORS',
      status: 'ok',
      message: 'No reconciliation queue errors are stored',
      details: undefined,
    });
  });
  it('warns when queue items contain previous errors', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          createQueueRow({
            attempt_count: 4,
            last_error: 'Provider unavailable',
          }),
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_ERRORS',
      status: 'warning',
      message: '1 queue item(s) contain a previous error',
      details: [
        {
          participantId: 50,
          eventId: 12,
          player: 'FourK#EUW',
          attempts: 4,
          lastError: 'Provider unavailable',
          nextAttemptAt: '2026-09-21T20:00:00.000Z',
        },
      ],
    });
  });
  it('warns when queue items have no unresolved matches', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          createQueueRow({
            unresolved_matches: '0',
            pending_matches: '0',
            unknown_matches: '0',
          }),
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_WORK',
      status: 'warning',
      message: '1 queue item(s) have no unresolved matches',
      details: [
        {
          participantId: 50,
          eventId: 12,
          player: 'FourK#EUW',
          attempts: 1,
        },
      ],
    });
  });
  it('warns when queue items belong to invalid event states', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          createQueueRow({
            event_status: 'scheduled',
          }),
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_EVENT_STATE',
      status: 'warning',
      message: '1 queue item(s) belong to a draft or scheduled event',
      details: [
        {
          participantId: 50,
          eventId: 12,
          event: 'September Event',
          status: 'scheduled',
          player: 'FourK#EUW',
        },
      ],
    });
  });
  it('warns when unresolved participants are missing from the queue', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_participant_id: '50',
            event_id: '12',
            event_name: 'September Event',
            event_status: 'active',
            player_id: '7',
            game_name: 'FourK',
            tag_line: 'EUW',
            unresolved_matches: '3',
            pending_matches: '2',
            unknown_matches: '1',
          },
        ],
      });
    const report = await runQueueDiagnostics();
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'RECONCILIATION_QUEUE_COVERAGE',
      status: 'warning',
      message: '1 participant(s) have unresolved matches without a queue entry',
      details: [
        {
          participantId: 50,
          eventId: 12,
          event: 'September Event',
          playerId: 7,
          player: 'FourK#EUW',
          unresolved: 3,
          pending: 2,
          unknown: 1,
        },
      ],
    });
  });
});
