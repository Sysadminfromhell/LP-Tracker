import { db } from './client';
export type EventStatus = 'draft' | 'active' | 'ended';
export interface DbEvent {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}
export interface DbEventParticipant {
  id: number;
  eventId: number;
  playerId: number;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  startWins: number;
  startLosses: number;
  lastResolvedRankScore: number;
  endTier: string | null;
  endDivision: number | null;
  endLp: number | null;
  endRankScore: number | null;
  endWins: number | null;
  endLosses: number | null;
  snapshotCapturedAt: string;
  endedSnapshotAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface DbEventMatch {
  id: number;
  eventParticipantId: number;
  providerMatchId: string;
  gameCreatedAt: string;
  championId: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: 'WIN' | 'LOSE';
  lpDelta: number | null;
  lpDeltaStatus: 'pending' | 'resolved' | 'unknown';
  discoveredAt: string;
  updatedAt: string;
}
export interface DbEventMatchStats {
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  longestWinStreak: number;
}
/*
 * ------------------------------------------------------------
 * DB rows
 * ------------------------------------------------------------
 */
interface EventRow {
  id: string;
  name: string;
  starts_at: Date | null;
  ends_at: Date | null;
  status: EventStatus;
  created_at: Date;
  updated_at: Date;
}
interface EventParticipantRow {
  id: string;
  event_id: string;
  player_id: string;
  start_tier: string;
  start_division: number | null;
  start_lp: number;
  start_rank_score: number;
  start_wins: number;
  start_losses: number;
  last_resolved_rank_score: number;
  end_tier: string | null;
  end_division: number | null;
  end_lp: number | null;
  end_rank_score: number | null;
  end_wins: number | null;
  end_losses: number | null;
  snapshot_captured_at: Date;
  ended_snapshot_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
interface EventMatchRow {
  id: string;
  event_participant_id: string;
  provider_match_id: string;
  game_created_at: Date;
  champion_id: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: 'WIN' | 'LOSE';
  lp_delta: number | null;
  lp_delta_status: 'pending' | 'resolved' | 'unknown';
  discovered_at: Date;
  updated_at: Date;
}
interface EventMatchStatsRow {
  games: string;
  kills: string;
  deaths: string;
  assists: string;
  longest_win_streak: string;
}
/*
 * ------------------------------------------------------------
 * Mappers
 * ------------------------------------------------------------
 */
function mapEvent(row: EventRow): DbEvent {
  return {
    id: Number(row.id),
    name: row.name,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function mapParticipant(row: EventParticipantRow): DbEventParticipant {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    playerId: Number(row.player_id),
    startTier: row.start_tier,
    startDivision: row.start_division,
    startLp: row.start_lp,
    startRankScore: row.start_rank_score,
    startWins: row.start_wins,
    startLosses: row.start_losses,
    lastResolvedRankScore: row.last_resolved_rank_score,
    endTier: row.end_tier,
    endDivision: row.end_division,
    endLp: row.end_lp,
    endRankScore: row.end_rank_score,
    endWins: row.end_wins,
    endLosses: row.end_losses,
    snapshotCapturedAt: row.snapshot_captured_at.toISOString(),
    endedSnapshotAt: row.ended_snapshot_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function mapMatch(row: EventMatchRow): DbEventMatch {
  return {
    id: Number(row.id),
    eventParticipantId: Number(row.event_participant_id),
    providerMatchId: row.provider_match_id,
    gameCreatedAt: row.game_created_at.toISOString(),
    championId: row.champion_id,
    champion: row.champion,
    position: row.position,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    cs: row.cs,
    result: row.result,
    lpDelta: row.lp_delta,
    lpDeltaStatus: row.lp_delta_status,
    discoveredAt: row.discovered_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
/*
 * ------------------------------------------------------------
 * Events
 * ------------------------------------------------------------
 */
export async function getActiveEvent(): Promise<DbEvent | null> {
  const result = await db.query<EventRow>(
    `
      SELECT
        id,
        name,
        starts_at,
        ends_at,
        status,
        created_at,
        updated_at
      FROM events
      WHERE status = 'active'
      LIMIT 1
      `,
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapEvent(result.rows[0]);
}
export async function getEventById(eventId: number): Promise<DbEvent | null> {
  const result = await db.query<EventRow>(
    `
      SELECT
        id,
        name,
        starts_at,
        ends_at,
        status,
        created_at,
        updated_at
      FROM events
      WHERE id = $1
      LIMIT 1
      `,
    [eventId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapEvent(result.rows[0]);
}
export async function getEventParticipant(
  eventId: number,
  playerId: number,
): Promise<DbEventParticipant | null> {
  const result = await db.query<EventParticipantRow>(
    `
      SELECT
        id,
        event_id,
        player_id,
        start_tier,
        start_division,
        start_lp,
        start_rank_score,
        start_wins,
        start_losses,
        last_resolved_rank_score,
        end_tier,
        end_division,
        end_lp,
        end_rank_score,
        end_wins,
        end_losses,
        snapshot_captured_at,
        ended_snapshot_at,
        created_at,
        updated_at
      FROM event_participants
      WHERE
        event_id = $1
        AND player_id = $2
      LIMIT 1
      `,
    [eventId, playerId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapParticipant(result.rows[0]);
}
export interface CreateEventParticipantInput {
  eventId: number;
  playerId: number;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  startWins: number;
  startLosses: number;
  lastResolvedRankScore: number;
  snapshotCapturedAt: string;
}
export async function createEventParticipant(
  input: CreateEventParticipantInput,
): Promise<DbEventParticipant> {
  const result = await db.query<EventParticipantRow>(
    `
      INSERT INTO event_participants (
        event_id,
        player_id,
        start_tier,
        start_division,
        start_lp,
        start_rank_score,
        start_wins,
        start_losses,
        last_resolved_rank_score,
        snapshot_captured_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      ON CONFLICT (
        event_id,
        player_id
      )
      DO UPDATE SET
        updated_at = NOW()
      RETURNING
        id,
        event_id,
        player_id,
        start_tier,
        start_division,
        start_lp,
        start_rank_score,
        start_wins,
        start_losses,
        last_resolved_rank_score,
        end_tier,
        end_division,
        end_lp,
        end_rank_score,
        end_wins,
        end_losses,
        snapshot_captured_at,
        ended_snapshot_at,
        created_at,
        updated_at
      `,
    [
      input.eventId,
      input.playerId,
      input.startTier,
      input.startDivision,
      input.startLp,
      input.startRankScore,
      input.startWins,
      input.startLosses,
      input.lastResolvedRankScore,
      input.snapshotCapturedAt,
    ],
  );
  return mapParticipant(result.rows[0]);
}
/*
 * ------------------------------------------------------------
 * Event Matches
 * ------------------------------------------------------------
 */
export async function getEventMatches(eventParticipantId: number): Promise<DbEventMatch[]> {
  const result = await db.query<EventMatchRow>(
    `
      SELECT
        id,
        event_participant_id,
        provider_match_id,
        game_created_at,
        champion_id,
        champion,
        position,
        kills,
        deaths,
        assists,
        cs,
        result,
        lp_delta,
        lp_delta_status,
        discovered_at,
        updated_at
      FROM event_matches
      WHERE
        event_participant_id = $1
      ORDER BY
        game_created_at DESC
      `,
    [eventParticipantId],
  );
  return result.rows.map(mapMatch);
}
export async function getEventMatchStats(eventParticipantId: number): Promise<DbEventMatchStats> {
  const result = await db.query<EventMatchStatsRow>(
    `
      WITH participant_matches AS MATERIALIZED (
        SELECT
          id,
          game_created_at,
          kills,
          deaths,
          assists,
          result
        FROM event_matches
        WHERE event_participant_id = $1
      ),
      totals AS (
        SELECT
          COUNT(*) AS games,
          COALESCE(SUM(kills), 0) AS kills,
          COALESCE(SUM(deaths), 0) AS deaths,
          COALESCE(SUM(assists), 0) AS assists
        FROM participant_matches
      ),
      streak_groups AS (
        SELECT
          result,
          SUM(
            CASE
              WHEN result = 'LOSE' THEN 1
              ELSE 0
            END
          ) OVER (
            ORDER BY
              game_created_at ASC,
              id ASC
          ) AS loss_group
        FROM participant_matches
      ),
      win_streaks AS (
        SELECT
          COUNT(*) AS streak
        FROM streak_groups
        WHERE result = 'WIN'
        GROUP BY loss_group
      )
      SELECT
        totals.games,
        totals.kills,
        totals.deaths,
        totals.assists,
        COALESCE(
          (
            SELECT MAX(streak)
            FROM win_streaks
          ),
          0
        ) AS longest_win_streak
      FROM totals
      `,
    [eventParticipantId],
  );
  const row = result.rows[0];
  return {
    games: Number(row.games),
    kills: Number(row.kills),
    deaths: Number(row.deaths),
    assists: Number(row.assists),
    longestWinStreak: Number(row.longest_win_streak),
  };
}
export interface CreateEventMatchInput {
  eventParticipantId: number;
  providerMatchId: string;
  gameCreatedAt: string;
  championId: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: 'WIN' | 'LOSE';
  lpDelta: number | null;
  lpDeltaStatus: 'pending' | 'resolved' | 'unknown';
}
export async function createEventMatch(input: CreateEventMatchInput): Promise<DbEventMatch> {
  const result = await db.query<EventMatchRow>(
    `
      INSERT INTO event_matches (
        event_participant_id,
        provider_match_id,
        game_created_at,
        champion_id,
        champion,
        position,
        kills,
        deaths,
        assists,
        cs,
        result,
        lp_delta,
        lp_delta_status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      ON CONFLICT (
        event_participant_id,
        provider_match_id
      )
      DO UPDATE SET
        updated_at = NOW()
      RETURNING
        id,
        event_participant_id,
        provider_match_id,
        game_created_at,
        champion_id,
        champion,
        position,
        kills,
        deaths,
        assists,
        cs,
        result,
        lp_delta,
        lp_delta_status,
        discovered_at,
        updated_at
      `,
    [
      input.eventParticipantId,
      input.providerMatchId,
      input.gameCreatedAt,
      input.championId,
      input.champion,
      input.position,
      input.kills,
      input.deaths,
      input.assists,
      input.cs,
      input.result,
      input.lpDelta,
      input.lpDeltaStatus,
    ],
  );
  return mapMatch(result.rows[0]);
}
export async function getRecentEventMatches(
  eventParticipantId: number,
  limit = 3,
): Promise<DbEventMatch[]> {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const result = await db.query<EventMatchRow>(
    `
      SELECT
        id,
        event_participant_id,
        provider_match_id,
        game_created_at,
        champion_id,
        champion,
        position,
        kills,
        deaths,
        assists,
        cs,
        result,
        lp_delta,
        lp_delta_status,
        discovered_at,
        updated_at
      FROM event_matches
      WHERE
        event_participant_id = $1
      ORDER BY
        game_created_at DESC
      LIMIT $2
      `,
    [eventParticipantId, safeLimit],
  );
  return result.rows.map(mapMatch);
}
export async function getDisplayEvent(): Promise<DbEvent | null> {
  const result = await db.query<{
    id: string;
  }>(
    `
    SELECT id
    FROM events
    WHERE
      status IN ('active', 'ended')
      OR (
        status = 'draft'
        AND ends_at > NOW()
      )
    ORDER BY
      CASE
        WHEN status = 'active' THEN 0
        WHEN status = 'draft' THEN 1
        ELSE 2
      END,
      CASE
        WHEN status = 'draft' THEN starts_at
      END ASC,
      CASE
        WHEN status = 'ended' THEN starts_at
      END DESC,
      id DESC
    LIMIT 1
    `,
  );

  if (result.rows.length === 0) {
    return null;
  }

  return getEventById(Number(result.rows[0].id));
}
