import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { runPlayerDiagnostics } from '../src/diagnostics/player';

const player = {
  id: '7',
  game_name: 'FourK',
  tag_line: 'EUW',
  region: 'EUW',
  enabled: true,
  tier: 'DIAMOND',
  division: 4,
  lp: 52,
  rank_score: 2552,
  season_wins: 120,
  season_losses: 105,
  last_successful_fetch_at: new Date('2026-09-21T20:00:00.000Z'),
  last_fetch_attempt_at: new Date('2026-09-21T20:00:00.000Z'),
  last_error: null,
  cache_updated_at: new Date('2026-09-21T20:00:00.000Z'),
};

function createEvent(
  overrides: Partial<{
    participant_id: string;
    event_id: string;
    event_name: string;
    event_status: 'draft' | 'scheduled' | 'active' | 'ended';
    start_rank_score: number;
    last_resolved_rank_score: number;
    end_rank_score: number | null;
    matches: string;
    resolved_matches: string;
    pending_matches: string;
    unknown_matches: string;
    attempt_count: number | null;
    next_attempt_at: Date | null;
    last_attempt_at: Date | null;
    queue_last_error: string | null;
    locked_until: Date | null;
  }> = {},
) {
  return {
    participant_id: '50',
    event_id: '12',
    event_name: 'September Event',
    event_status: 'active' as const,
    start_rank_score: 2400,
    last_resolved_rank_score: 2552,
    end_rank_score: null,
    matches: '12',
    resolved_matches: '12',
    pending_matches: '0',
    unknown_matches: '0',
    attempt_count: null,
    next_attempt_at: null,
    last_attempt_at: null,
    queue_last_error: null,
    locked_until: null,
    ...overrides,
  };
}

describe('player diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns a clean report for a healthy player', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [player],
      })
      .mockResolvedValueOnce({
        rows: [createEvent()],
      });
    const report = await runPlayerDiagnostics(7);
    expect(report.scope).toBe('player:7');
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PLAYER_IDENTITY',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'PLAYER_CACHE',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'PLAYER_EVENTS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'PLAYER_RECONCILIATION_QUEUE',
          status: 'ok',
        }),
      ]),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it('reports a missing player as an error', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [],
    });
    const report = await runPlayerDiagnostics(999);
    expect(report.status).toBe('error');
    expect(report.checks).toEqual([
      {
        code: 'PLAYER_NOT_FOUND',
        status: 'error',
        message: 'Player 999 does not exist',
      },
    ]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('warns when the player has no cached provider data', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            ...player,
            tier: null,
            division: null,
            lp: null,
            rank_score: null,
            season_wins: null,
            season_losses: null,
            last_successful_fetch_at: null,
            last_fetch_attempt_at: null,
            last_error: null,
            cache_updated_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const report = await runPlayerDiagnostics(7);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'PLAYER_CACHE',
      status: 'warning',
      message: 'Player has no cached provider data',
    });
  });
  it('warns about unresolved matches without a queue entry', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [player],
      })
      .mockResolvedValueOnce({
        rows: [
          createEvent({
            matches: '8',
            resolved_matches: '5',
            pending_matches: '2',
            unknown_matches: '1',
          }),
        ],
      });
    const report = await runPlayerDiagnostics(7);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'PLAYER_RECONCILIATION_QUEUE',
      status: 'warning',
      message:
        '1 event participation(s) contain unresolved matches without a reconciliation queue entry',
      details: [
        {
          participantId: 50,
          eventId: 12,
          event: 'September Event',
          pending: 2,
          unknown: 1,
        },
      ],
    });
  });
  it('warns when a reconciliation queue entry contains an error', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [player],
      })
      .mockResolvedValueOnce({
        rows: [
          createEvent({
            pending_matches: '1',
            resolved_matches: '11',
            attempt_count: 3,
            next_attempt_at: new Date('2026-09-21T20:10:00.000Z'),
            last_attempt_at: new Date('2026-09-21T20:05:00.000Z'),
            queue_last_error: 'Provider unavailable',
          }),
        ],
      });
    const report = await runPlayerDiagnostics(7);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'PLAYER_RECONCILIATION_QUEUE',
      status: 'warning',
      message: '1 reconciliation queue entry(s) contain an error',
      details: [
        {
          participantId: 50,
          eventId: 12,
          attempts: 3,
          lastError: 'Provider unavailable',
        },
      ],
    });
  });
  it('treats expected reconciliation retry states as healthy', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [player],
      })
      .mockResolvedValueOnce({
        rows: [
          createEvent({
            pending_matches: '2',
            resolved_matches: '10',
            attempt_count: 9,
            next_attempt_at: new Date('2026-09-21T20:10:00.000Z'),
            last_attempt_at: new Date('2026-09-21T20:05:00.000Z'),
            queue_last_error: 'Resolved 0/12 matches',
          }),
        ],
      });
    const report = await runPlayerDiagnostics(7);
    expect(report.status).toBe('ok');
    expect(report.checks).toContainEqual({
      code: 'PLAYER_RECONCILIATION_QUEUE',
      status: 'ok',
      message: 'Player reconciliation queue state looks consistent',
      details: undefined,
    });
  });
  it('rejects invalid player ids before querying the database', async () => {
    await expect(runPlayerDiagnostics(0)).rejects.toThrow('Invalid player id: 0');
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
