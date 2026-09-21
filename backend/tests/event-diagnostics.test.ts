import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { runEventDiagnostics } from '../src/diagnostics/event';

const latestEvent = {
  id: '42',
  name: 'September Event',
  status: 'ended',
  starts_at: new Date('2026-09-01T18:00:00.000Z'),
  ends_at: new Date('2026-09-05T18:00:00.000Z'),
  participant_count: '8',
};

function mockHealthyEventDiagnostics(): void {
  mocks.query
    .mockResolvedValueOnce({
      rows: [latestEvent],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [],
    })
    .mockResolvedValueOnce({
      rows: [
        {
          lp_delta_status: 'resolved',
          count: '12',
        },
        {
          lp_delta_status: 'unknown',
          count: '2',
        },
      ],
    });
}

describe('event diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns a clean report when event integrity is valid', async () => {
    mockHealthyEventDiagnostics();
    const report = await runEventDiagnostics();
    expect(report.scope).toBe('event');
    expect(report.status).toBe('ok');
    expect(report.generatedAt).toEqual(expect.any(String));
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'LATEST_EVENT',
          status: 'ok',
          details: expect.objectContaining({
            id: 42,
            name: 'September Event',
            participants: 8,
          }),
        }),
        expect.objectContaining({
          code: 'ACTIVE_EVENT_COUNT',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_TIME_WINDOWS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_START_SNAPSHOTS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_END_SNAPSHOTS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_MATCH_WINDOWS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_PARTICIPANTS',
          status: 'ok',
        }),
        expect.objectContaining({
          code: 'EVENT_MATCH_STATES',
          status: 'ok',
          details: [
            {
              status: 'resolved',
              matches: 12,
            },
            {
              status: 'unknown',
              matches: 2,
            },
          ],
        }),
      ]),
    );
    expect(mocks.query).toHaveBeenCalledTimes(8);
  });
  it('returns a clean empty report when no events exist', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [],
    });
    const report = await runEventDiagnostics();
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual([
      {
        code: 'EVENTS_EMPTY',
        status: 'ok',
        message: 'No events exist yet.',
      },
    ]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('reports multiple active events as an integrity error', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [latestEvent],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '41',
            name: 'Event One',
            status: 'active',
            starts_at: new Date('2026-09-01T18:00:00.000Z'),
            ends_at: null,
          },
          {
            id: '42',
            name: 'Event Two',
            status: 'active',
            starts_at: new Date('2026-09-02T18:00:00.000Z'),
            ends_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const report = await runEventDiagnostics();
    expect(report.status).toBe('error');
    expect(report.checks).toContainEqual({
      code: 'ACTIVE_EVENT_COUNT',
      status: 'error',
      message: '2 active events exist at the same time',
      details: [
        {
          id: 41,
          name: 'Event One',
          status: 'active',
        },
        {
          id: 42,
          name: 'Event Two',
          status: 'active',
        },
      ],
    });
  });
  it('reports incomplete final snapshots as an integrity error', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [latestEvent],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            event_id: '42',
            event_name: 'September Event',
            participant_id: '51',
            player_id: '7',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const report = await runEventDiagnostics();
    expect(report.status).toBe('error');
    expect(report.checks).toContainEqual({
      code: 'EVENT_END_SNAPSHOTS',
      status: 'error',
      message: '1 participant(s) have an incomplete end snapshot',
      details: [
        {
          event_id: '42',
          event_name: 'September Event',
          participant_id: '51',
          player_id: '7',
        },
      ],
    });
  });
});
