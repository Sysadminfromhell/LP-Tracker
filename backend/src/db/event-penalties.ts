import { db } from './client';

export interface EventParticipantPenalty {
  eventId: number;
  playerId: number;
  gameName: string;
  tagLine: string;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  lpPenalty: number;
  penaltyReason: string | null;
  penaltyUpdatedAt: string | null;
}
interface EventParticipantPenaltyRow {
  event_id: string;
  player_id: string;
  game_name: string;
  tag_line: string;
  start_tier: string;
  start_division: number | null;
  start_lp: number;
  start_rank_score: number;
  lp_penalty: number;
  penalty_reason: string | null;
  penalty_updated_at: Date | null;
}

export interface SetEventParticipantPenaltyInput {
  eventId: number;
  playerId: number;
  lpPenalty: number;
  reason: string | null;
}

function mapEventParticipantPenalty(row: EventParticipantPenaltyRow): EventParticipantPenalty {
  return {
    eventId: Number(row.event_id),
    playerId: Number(row.player_id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    startTier: row.start_tier,
    startDivision: row.start_division,
    startLp: row.start_lp,
    startRankScore: row.start_rank_score,
    lpPenalty: row.lp_penalty,
    penaltyReason: row.penalty_reason,
    penaltyUpdatedAt: row.penalty_updated_at?.toISOString() ?? null,
  };
}

export async function getEventParticipantPenalties(
  eventId: number,
): Promise<EventParticipantPenalty[]> {
  const result = await db.query<EventParticipantPenaltyRow>(
    `
    SELECT
      ep.event_id,
      ep.player_id,
      p.game_name,
      p.tag_line,
      ep.start_tier,
      ep.start_division,
      ep.start_lp,
      ep.start_rank_score,
      ep.lp_penalty,
      ep.penalty_reason,
      ep.penalty_updated_at
    FROM event_participants ep
    JOIN players p
      ON p.id = ep.player_id
    WHERE ep.event_id = $1
    ORDER BY
      LOWER(p.game_name),
      LOWER(p.tag_line),
      p.id
    `,
    [eventId],
  );

  return result.rows.map(mapEventParticipantPenalty);
}
export async function setEventParticipantPenalty(
  input: SetEventParticipantPenaltyInput,
): Promise<EventParticipantPenalty> {
  if (!Number.isSafeInteger(input.lpPenalty) || input.lpPenalty < 0) {
    throw new Error('INVALID_LP_PENALTY');
  }

  const reason = input.reason?.trim() ?? '';

  if (input.lpPenalty > 0 && !reason) {
    throw new Error('PENALTY_REASON_REQUIRED');
  }

  const result = await db.query<EventParticipantPenaltyRow>(
    `
    UPDATE event_participants ep
    SET
      lp_penalty = $3,
      penalty_reason = CASE
        WHEN $3 = 0 THEN NULL
        ELSE $4
      END,
      penalty_updated_at = NOW(),
      updated_at = NOW()
    FROM events e, players p
    WHERE
      ep.event_id = $1
      AND ep.player_id = $2
      AND e.id = ep.event_id
      AND e.status = 'active'
      AND p.id = ep.player_id
    RETURNING
      ep.event_id,
      ep.player_id,
      p.game_name,
      p.tag_line,
      ep.start_tier,
      ep.start_division,
      ep.start_lp,
      ep.start_rank_score,
      ep.lp_penalty,
      ep.penalty_reason,
      ep.penalty_updated_at
    `,
    [input.eventId, input.playerId, input.lpPenalty, input.lpPenalty === 0 ? null : reason],
  );
  if (result.rows.length === 0) {
    throw new Error('ACTIVE_EVENT_PARTICIPANT_NOT_FOUND');
  }
  return mapEventParticipantPenalty(result.rows[0]);
}
