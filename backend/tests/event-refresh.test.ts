import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SummonerMatch } from '../src/providers/league-data.types';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  participantRows: [] as Array<{
    id: string;
    last_resolved_rank_score: number;
  }>,
  pendingRows: [] as Array<{
    id: string;
    provider_match_id?: string;
    game_created_at?: Date;
  }>,
  insertRowCounts: [] as number[],
  eventMatchIds: {} as Record<string, string>,
}));

vi.mock('../src/db/client', () => ({
  db: {
    connect: mocks.connect,
  },
}));

import { updateEventAfterPlayerRefresh } from '../src/db/event-refresh';

const EVENT_PARTICIPANT_ID = 100;
const EVENT_START = '2026-09-01T18:00:00.000Z';
const EVENT_END = '2026-09-03T18:00:00.000Z';

function createMatch(overrides: Partial<SummonerMatch> = {}): SummonerMatch {
  return {
    id: 'match-1',
    createdAt: '2026-09-02T18:00:00.000Z',
    gameType: 'SOLORANKED',
    durationSeconds: 1800,
    championId: 266,
    champion: 'Aatrox',
    position: 'TOP',
    items: ['Black Cleaver'],
    damageToChampions: 25000,
    kills: 8,
    deaths: 3,
    assists: 6,
    laneCs: 190,
    jungleCs: 12,
    cs: 202,
    result: 'WIN',
    ...overrides,
  };
}
function emptyResult() {
  return {
    rows: [],
    rowCount: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.participantRows = [
    {
      id: String(EVENT_PARTICIPANT_ID),
      last_resolved_rank_score: 1500,
    },
  ];
  mocks.pendingRows = [];
  mocks.insertRowCounts = [];
  mocks.eventMatchIds = {};
  mocks.connect.mockResolvedValue({
    query: mocks.query,
    release: mocks.release,
  });
  mocks.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized === 'BEGIN') {
      return emptyResult();
    }
    if (normalized === 'COMMIT') {
      return emptyResult();
    }
    if (normalized === 'ROLLBACK') {
      return emptyResult();
    }
    if (
      normalized.includes('SELECT id, last_resolved_rank_score') &&
      normalized.includes('FROM event_participants')
    ) {
      return {
        rows: mocks.participantRows,
        rowCount: mocks.participantRows.length,
      };
    }
    if (normalized.includes('INSERT INTO event_matches')) {
      const rowCount = mocks.insertRowCounts.shift() ?? 1;

      return {
        rows: rowCount === 1 ? [{ id: 'inserted-match' }] : [],
        rowCount,
      };
    }
    if (
      normalized.includes('SELECT id') &&
      normalized.includes('FROM event_matches') &&
      normalized.includes('provider_match_id = $2') &&
      normalized.includes('LIMIT 1')
    ) {
      const providerMatchId = String(params?.[1]);
      const eventMatchId = mocks.eventMatchIds[providerMatchId];
      return {
        rows: eventMatchId ? [{ id: eventMatchId }] : [],
        rowCount: eventMatchId ? 1 : 0,
      };
    }
    if (
      normalized.includes('provider_match_id') &&
      normalized.includes('game_created_at') &&
      normalized.includes('FROM event_matches') &&
      normalized.includes("lp_delta_status = 'pending'")
    ) {
      return {
        rows: mocks.pendingRows,
        rowCount: mocks.pendingRows.length,
      };
    }
    if (
      normalized.includes('UPDATE event_matches') ||
      normalized.includes('UPDATE event_participants')
    ) {
      return {
        rows: [],
        rowCount: 1,
      };
    }
    if (
      normalized.includes('INSERT INTO event_match_details') ||
      normalized.includes('DELETE FROM event_match_participants') ||
      normalized.includes('INSERT INTO event_match_participants')
    ) {
      return {
        rows: [],
        rowCount: 1,
      };
    }
    if (normalized.includes('DELETE FROM event_match_details')) {
      return emptyResult();
    }
    throw new Error(
      `Unexpected SQL in test:\n${normalized}\n` + `params=${JSON.stringify(params)}`,
    );
  });
});

describe('event refresh', () => {
  it('filters matches by queue and event time window and inserts them chronologically', async () => {
    const matches = [
      createMatch({
        id: 'later',
        createdAt: '2026-09-02T20:00:00.000Z',
      }),
      createMatch({
        id: 'flex',
        gameType: 'FLEXRANKED',
      }),
      createMatch({
        id: 'before',
        createdAt: '2026-08-31T20:00:00.000Z',
      }),
      createMatch({
        id: 'after',
        createdAt: '2026-09-04T20:00:00.000Z',
      }),
      createMatch({
        id: 'earlier',
        createdAt: '2026-09-02T10:00:00.000Z',
      }),
    ];
    mocks.insertRowCounts = [1, 1];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      matches,
      1500,
    );
    const insertCalls = mocks.query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO event_matches'),
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]?.[1]).toBe('earlier');
    expect(insertCalls[1][1]?.[1]).toBe('later');
    expect(result).toEqual({
      newMatches: 2,
      resolvedMatches: 0,
      unknownMatches: 0,
    });
  });
  it('counts only matches that were actually inserted', async () => {
    mocks.insertRowCounts = [1, 0];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [
        createMatch({
          id: 'new-match',
        }),
        createMatch({
          id: 'existing-match',
          createdAt: '2026-09-02T19:00:00.000Z',
        }),
      ],
      1500,
    );
    expect(result.newMatches).toBe(1);
  });
  it('stores discovered matches without resolving LP during an incomplete sync', async () => {
    mocks.insertRowCounts = [1];
    mocks.pendingRows = [
      {
        id: '501',
        provider_match_id: 'match-1',
        game_created_at: new Date('2026-09-02T18:00:00.000Z'),
      },
    ];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [createMatch()],
      1524,
      [],
      {
        resolveLpDeltas: false,
      },
    );
    expect(result).toEqual({
      newMatches: 1,
      resolvedMatches: 0,
      unknownMatches: 0,
    });
    const lpUpdateCalls = mocks.query.mock.calls.filter(
      ([sql]) =>
        String(sql).includes('UPDATE event_matches') ||
        String(sql).includes('UPDATE event_participants'),
    );
    expect(lpUpdateCalls).toHaveLength(0);
  });
  it('stores rich details and prunes details outside the newest three matches', async () => {
    mocks.insertRowCounts = [1];
    mocks.eventMatchIds = {
      'rich-match': '501',
    };
    const match = createMatch({
      id: 'rich-match',
      participants: [
        {
          side: 'ALLY',
          position: 'TOP',
          championId: 266,
          champion: 'Aatrox',
          items: ['3071', '3047'],
          damageToChampions: 25000,
          kills: 8,
          deaths: 3,
          assists: 6,
          laneCs: 190,
          jungleCs: 12,
          cs: 202,
          isTrackedPlayer: true,
        },
        {
          side: 'ENEMY',
          position: 'TOP',
          championId: 86,
          champion: 'Garen',
          items: ['6631', '3006'],
          damageToChampions: 18000,
          kills: 4,
          deaths: 8,
          assists: 2,
          laneCs: 175,
          jungleCs: 0,
          cs: 175,
          isTrackedPlayer: false,
        },
      ],
    });
    await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [match],
      1500,
    );
    const detailInsert = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO event_match_details'),
    );
    expect(detailInsert).toBeDefined();
    expect(detailInsert?.[1]).toEqual([501, 1800]);
    const participantInsert = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO event_match_participants'),
    );
    expect(participantInsert).toBeDefined();
    const pruneCall = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('DELETE FROM event_match_details'),
    );
    expect(pruneCall).toBeDefined();
    expect(pruneCall?.[1]).toEqual([EVENT_PARTICIPANT_ID, 3]);
    const beginCalls = mocks.query.mock.calls.filter(([sql]) => String(sql).trim() === 'BEGIN');
    const commitCalls = mocks.query.mock.calls.filter(([sql]) => String(sql).trim() === 'COMMIT');
    expect(beginCalls).toHaveLength(2);
    expect(commitCalls).toHaveLength(2);
  });
  it('resolves exactly one pending match when rank score changes', async () => {
    mocks.pendingRows = [
      {
        id: '501',
      },
    ];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [],
      1524,
    );
    expect(result).toEqual({
      newMatches: 0,
      resolvedMatches: 1,
      unknownMatches: 0,
    });
    const resolvedCall = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("lp_delta_status = 'resolved'"),
    );
    expect(resolvedCall).toBeDefined();
    expect(resolvedCall?.[1]).toEqual(['501', 24]);
    const participantUpdate = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_participants'),
    );
    expect(participantUpdate?.[1]).toEqual([EVENT_PARTICIPANT_ID, 1524]);
  });
  it('resolves multiple pending matches from LP history', async () => {
    mocks.participantRows = [
      {
        id: String(EVENT_PARTICIPANT_ID),
        last_resolved_rank_score: 1450,
      },
    ];
    mocks.pendingRows = [
      {
        id: '501',
        provider_match_id: 'match-1',
        game_created_at: new Date('2026-09-02T10:00:00.000Z'),
      },
      {
        id: '502',
        provider_match_id: 'match-2',
        game_created_at: new Date('2026-09-02T11:00:00.000Z'),
      },
    ];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [],
      1454,
      [
        {
          createdAt: '2026-09-02T10:35:00.000Z',
          tier: 'GOLD',
          division: 2,
          lp: 72,
        },
        {
          createdAt: '2026-09-02T11:35:00.000Z',
          tier: 'GOLD',
          division: 2,
          lp: 54,
        },
      ],
    );
    expect(result).toEqual({
      newMatches: 0,
      resolvedMatches: 2,
      unknownMatches: 0,
    });
    const resolvedCalls = mocks.query.mock.calls.filter(([sql]) =>
      String(sql).includes("lp_delta_status = 'resolved'"),
    );
    expect(resolvedCalls).toHaveLength(2);
    expect(resolvedCalls[0][1]).toEqual(['501', 22]);
    expect(resolvedCalls[1][1]).toEqual(['502', -18]);
    const unknownCall = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("lp_delta_status = 'unknown'"),
    );
    expect(unknownCall).toBeUndefined();
    const participantUpdate = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_participants'),
    );
    expect(participantUpdate?.[1]).toEqual([EVENT_PARTICIPANT_ID, 1454]);
  });
  it('marks multiple pending matches as unknown when rank score changes', async () => {
    mocks.pendingRows = [
      {
        id: '501',
      },
      {
        id: '502',
      },
    ];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [],
      1550,
    );
    expect(result).toEqual({
      newMatches: 0,
      resolvedMatches: 0,
      unknownMatches: 2,
    });
    const unknownCall = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("lp_delta_status = 'unknown'"),
    );
    expect(unknownCall).toBeDefined();
    expect(unknownCall?.[1]).toEqual([EVENT_PARTICIPANT_ID]);
    const participantUpdate = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_participants'),
    );
    expect(participantUpdate?.[1]).toEqual([EVENT_PARTICIPANT_ID, 1550]);
  });
  it('updates the resolved rank score when the score changes without pending matches', async () => {
    mocks.pendingRows = [];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [],
      1530,
    );
    expect(result).toEqual({
      newMatches: 0,
      resolvedMatches: 0,
      unknownMatches: 0,
    });
    const participantUpdate = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE event_participants'),
    );
    expect(participantUpdate).toBeDefined();
    expect(participantUpdate?.[1]).toEqual([EVENT_PARTICIPANT_ID, 1530]);
  });
  it('leaves pending matches untouched when rank score did not change', async () => {
    mocks.pendingRows = [
      {
        id: '501',
      },
    ];
    const result = await updateEventAfterPlayerRefresh(
      EVENT_PARTICIPANT_ID,
      EVENT_START,
      EVENT_END,
      [],
      1500,
    );
    expect(result).toEqual({
      newMatches: 0,
      resolvedMatches: 0,
      unknownMatches: 0,
    });
    const updateCalls = mocks.query.mock.calls.filter(
      ([sql]) =>
        String(sql).includes('UPDATE event_matches') ||
        String(sql).includes('UPDATE event_participants'),
    );
    expect(updateCalls).toHaveLength(0);
  });
  it('rolls back when the event participant does not exist', async () => {
    mocks.participantRows = [];
    await expect(
      updateEventAfterPlayerRefresh(EVENT_PARTICIPANT_ID, EVENT_START, EVENT_END, [], 1500),
    ).rejects.toThrow(`Event participant ${EVENT_PARTICIPANT_ID} not found`);
    expect(mocks.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('commits successful refreshes and always releases the DB client', async () => {
    await updateEventAfterPlayerRefresh(EVENT_PARTICIPANT_ID, EVENT_START, EVENT_END, [], 1500);
    expect(mocks.query).toHaveBeenCalledWith('BEGIN');
    expect(mocks.query).toHaveBeenCalledWith('COMMIT');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
