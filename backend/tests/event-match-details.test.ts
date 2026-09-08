import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  getEventMatchDetails,
  pruneEventMatchDetails,
  replaceEventMatchDetails,
} from '../src/db/event-match-details';
import type { SummonerMatch } from '../src/providers/league-data.types';

function createMatch(): SummonerMatch {
  return {
    id: 'match-123',
    createdAt: '2026-09-09T18:00:00.000Z',
    gameType: 'SOLORANKED',
    durationSeconds: 1852,
    championId: 90,
    champion: 'Malzahar',
    position: 'MID',
    items: ['3118', '6653'],
    damageToChampions: 23335,
    kills: 4,
    deaths: 0,
    assists: 10,
    laneCs: 244,
    jungleCs: 0,
    cs: 244,
    result: 'WIN',
    participants: [
      {
        side: 'ALLY',
        position: 'MID',
        championId: 90,
        champion: 'Malzahar',
        items: ['3118', '6653'],
        damageToChampions: 23335,
        kills: 4,
        deaths: 0,
        assists: 10,
        laneCs: 244,
        jungleCs: 0,
        cs: 244,
        isTrackedPlayer: true,
      },
      {
        side: 'ENEMY',
        position: 'MID',
        championId: 112,
        champion: 'Viktor',
        items: ['2503', '3113'],
        damageToChampions: 11708,
        kills: 1,
        deaths: 8,
        assists: 2,
        laneCs: 140,
        jungleCs: 3,
        cs: 143,
        isTrackedPlayer: false,
      },
    ],
  };
}

describe('event match details', () => {
  it('replaces rich match details and participants', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    const client = {
      query,
    } as unknown as Pick<PoolClient, 'query'>;
    await replaceEventMatchDetails(client, 501, createMatch());
    expect(query).toHaveBeenCalledTimes(3);
    const detailCall = query.mock.calls[0];
    expect(String(detailCall[0])).toContain('INSERT INTO event_match_details');
    expect(detailCall[1]).toEqual([501, 1852]);
    const deleteCall = query.mock.calls[1];
    expect(String(deleteCall[0])).toContain('DELETE FROM event_match_participants');
    expect(deleteCall[1]).toEqual([501]);
    const participantsCall = query.mock.calls[2];
    expect(String(participantsCall[0])).toContain('INSERT INTO event_match_participants');
    expect(participantsCall[1]).toEqual([
      501,
      'ALLY',
      'MID',
      90,
      'Malzahar',
      4,
      0,
      10,
      244,
      0,
      244,
      23335,
      ['3118', '6653'],
      true,
      'ENEMY',
      'MID',
      112,
      'Viktor',
      1,
      8,
      2,
      140,
      3,
      143,
      11708,
      ['2503', '3113'],
      false,
    ]);
  });
  it('rejects match details without exactly one tracked player', async () => {
    const query = vi.fn();
    const client = {
      query,
    } as unknown as Pick<PoolClient, 'query'>;
    const match = createMatch();
    match.participants = match.participants?.map((participant) => ({
      ...participant,
      isTrackedPlayer: false,
    }));
    await expect(replaceEventMatchDetails(client, 501, match)).rejects.toThrow(
      'must contain exactly one tracked player',
    );
    expect(query).not.toHaveBeenCalled();
  });
  it('prunes rich details outside the newest three event matches', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 1,
    });
    const client = {
      query,
    } as unknown as Pick<PoolClient, 'query'>;
    await pruneEventMatchDetails(client, 100);
    expect(query).toHaveBeenCalledTimes(1);
    const call = query.mock.calls[0];
    expect(String(call[0])).toContain('DELETE FROM event_match_details');
    expect(String(call[0])).toContain('ORDER BY');
    expect(String(call[0])).toContain('recent_match.game_created_at DESC');
    expect(call[1]).toEqual([100, 3]);
  });
  it('loads rich details for a specific event player match', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            event_match_id: '501',
            duration_seconds: 1852,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            side: 'ALLY',
            position: 'MID',
            champion_id: 90,
            champion: 'Malzahar',
            kills: 4,
            deaths: 0,
            assists: 10,
            lane_cs: 244,
            jungle_cs: 0,
            cs: 244,
            damage_to_champions: 23335,
            items: ['3118', '6653', '3175'],
            is_tracked_player: true,
          },
          {
            side: 'ENEMY',
            position: 'MID',
            champion_id: 112,
            champion: 'Viktor',
            kills: 1,
            deaths: 8,
            assists: 2,
            lane_cs: 140,
            jungle_cs: 3,
            cs: 143,
            damage_to_champions: 11708,
            items: ['2503', '3113', '3175'],
            is_tracked_player: false,
          },
        ],
        rowCount: 2,
      });
    const client = {
      query,
    } as unknown as Pick<PoolClient, 'query'>;
    const details = await getEventMatchDetails(client, 42, 7, 'match-123');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual([42, 7, 'match-123']);
    expect(query.mock.calls[1][1]).toEqual(['501']);
    expect(details).toEqual({
      durationSeconds: 1852,
      participants: [
        {
          side: 'ALLY',
          position: 'MID',
          championId: 90,
          champion: 'Malzahar',
          kills: 4,
          deaths: 0,
          assists: 10,
          laneCs: 244,
          jungleCs: 0,
          cs: 244,
          damageToChampions: 23335,
          items: ['3118', '6653', '3175'],
          isTrackedPlayer: true,
        },
        {
          side: 'ENEMY',
          position: 'MID',
          championId: 112,
          champion: 'Viktor',
          kills: 1,
          deaths: 8,
          assists: 2,
          laneCs: 140,
          jungleCs: 3,
          cs: 143,
          damageToChampions: 11708,
          items: ['2503', '3113', '3175'],
          isTrackedPlayer: false,
        },
      ],
    });
  });
  it('returns null when rich match details do not exist', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
    });
    const client = {
      query,
    } as unknown as Pick<PoolClient, 'query'>;
    const details = await getEventMatchDetails(client, 42, 7, 'missing-match');
    expect(details).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
