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
  getEventParticipantPenalties,
  setEventParticipantPenalty,
} from '../src/db/event-penalties';

describe('event participant penalties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns participant penalty data for an event', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          event_id: '12',
          player_id: '42',
          game_name: 'FourK',
          tag_line: 'EUW',
          start_tier: 'BRONZE',
          start_division: 2,
          start_lp: 15,
          start_rank_score: 615,
          lp_penalty: 15,
          penalty_reason: 'Boosting',
          penalty_updated_at: new Date('2026-09-08T20:30:00.000Z'),
        },
      ],
    });
    const result = await getEventParticipantPenalties(12);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM event_participants ep'),
      [12],
    );
    expect(result).toEqual([
      {
        eventId: 12,
        playerId: 42,
        gameName: 'FourK',
        tagLine: 'EUW',
        startTier: 'BRONZE',
        startDivision: 2,
        startLp: 15,
        startRankScore: 615,
        lpPenalty: 15,
        penaltyReason: 'Boosting',
        penaltyUpdatedAt: '2026-09-08T20:30:00.000Z',
      },
    ]);
  });
  it('sets a penalty only for a participant of an active event', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          event_id: '12',
          player_id: '42',
          game_name: 'FourK',
          tag_line: 'EUW',
          start_tier: 'BRONZE',
          start_division: 2,
          start_lp: 15,
          start_rank_score: 615,
          lp_penalty: 15,
          penalty_reason: 'Boosting',
          penalty_updated_at: new Date('2026-09-08T20:30:00.000Z'),
        },
      ],
    });
    const result = await setEventParticipantPenalty({
      eventId: 12,
      playerId: 42,
      lpPenalty: 15,
      reason: ' Boosting ',
    });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("e.status = 'active'"), [
      12,
      42,
      15,
      'Boosting',
    ]);
    expect(result.lpPenalty).toBe(15);
    expect(result.penaltyReason).toBe('Boosting');
  });
  it('clears the reason when the penalty is reset to zero', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          event_id: '12',
          player_id: '42',
          game_name: 'FourK',
          tag_line: 'EUW',
          start_tier: 'BRONZE',
          start_division: 2,
          start_lp: 15,
          start_rank_score: 615,
          lp_penalty: 0,
          penalty_reason: null,
          penalty_updated_at: new Date('2026-09-08T20:35:00.000Z'),
        },
      ],
    });
    await setEventParticipantPenalty({
      eventId: 12,
      playerId: 42,
      lpPenalty: 0,
      reason: 'No longer relevant',
    });
    expect(mocks.query).toHaveBeenCalledWith(expect.any(String), [12, 42, 0, null]);
  });
  it('rejects negative penalties', async () => {
    await expect(
      setEventParticipantPenalty({
        eventId: 12,
        playerId: 42,
        lpPenalty: -15,
        reason: 'Invalid',
      }),
    ).rejects.toThrow('INVALID_LP_PENALTY');
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects non-integer penalties', async () => {
    await expect(
      setEventParticipantPenalty({
        eventId: 12,
        playerId: 42,
        lpPenalty: 12.5,
        reason: 'Invalid',
      }),
    ).rejects.toThrow('INVALID_LP_PENALTY');
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('requires a reason for a non-zero penalty', async () => {
    await expect(
      setEventParticipantPenalty({
        eventId: 12,
        playerId: 42,
        lpPenalty: 15,
        reason: '   ',
      }),
    ).rejects.toThrow('PENALTY_REASON_REQUIRED');
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects updates when the participant is not part of an active event', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    await expect(
      setEventParticipantPenalty({
        eventId: 12,
        playerId: 42,
        lpPenalty: 15,
        reason: 'Boosting',
      }),
    ).rejects.toThrow('ACTIVE_EVENT_PARTICIPANT_NOT_FOUND');
  });
});
