import { db } from './client';

export interface DbEventHistorySummary {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  participantCount: number;
}
export interface DbEventHistoryStanding {
  playerId: number;
  gameName: string;
  tagLine: string;
  region: string;
  profileImageUrl: string | null;
  twitchUsername: string | null;
  twitterUsername: string | null;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  finalTier: string | null;
  finalDivision: number | null;
  finalLp: number | null;
  finalRankScore: number | null;
  lpPenalty: number;
  penaltyReason: string | null;
  games: number;
  wins: number;
  losses: number;
}
interface EventHistorySummaryRow {
  id: string;
  name: string;
  starts_at: Date | null;
  ends_at: Date | null;
  participant_count: string;
}
interface EventHistoryStandingRow {
  player_id: string;
  game_name: string;
  tag_line: string;
  region: string;
  profile_image_url: string | null;
  twitch_username: string | null;
  twitter_username: string | null;
  start_tier: string;
  start_division: number | null;
  start_lp: number;
  start_rank_score: number;
  end_tier: string | null;
  end_division: number | null;
  end_lp: number | null;
  end_rank_score: number | null;
  lp_penalty: number;
  penalty_reason: string | null;
  games: string;
  wins: string;
  losses: string;
}

function mapEventSummary(row: EventHistorySummaryRow): DbEventHistorySummary {
  if (!row.starts_at || !row.ends_at) {
    throw new Error(`EVENT_HISTORY_DATES_INCOMPLETE:${row.id}`);
  }
  return {
    id: Number(row.id),
    name: row.name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    participantCount: Number(row.participant_count),
  };
}
export async function getEndedEventHistory(): Promise<DbEventHistorySummary[]> {
  const result = await db.query<EventHistorySummaryRow>(
    `
      SELECT
        e.id,
        e.name,
        e.starts_at,
        e.ends_at,
        COUNT(ep.id)::TEXT AS participant_count
      FROM events e
      LEFT JOIN event_participants ep
        ON ep.event_id = e.id
      WHERE e.status = 'ended'
      GROUP BY
        e.id,
        e.name,
        e.starts_at,
        e.ends_at
      ORDER BY
        e.starts_at DESC,
        e.id DESC
    `,
  );
  return result.rows.map(mapEventSummary);
}
export async function getEndedEventHistoryEvent(
  eventId: number,
): Promise<DbEventHistorySummary | null> {
  const result = await db.query<EventHistorySummaryRow>(
    `
      SELECT
        e.id,
        e.name,
        e.starts_at,
        e.ends_at,
        COUNT(ep.id)::TEXT AS participant_count
      FROM events e
      LEFT JOIN event_participants ep
        ON ep.event_id = e.id
      WHERE
        e.id = $1
        AND e.status = 'ended'
      GROUP BY
        e.id,
        e.name,
        e.starts_at,
        e.ends_at
      LIMIT 1
    `,
    [eventId],
  );
  const row = result.rows[0];
  return row ? mapEventSummary(row) : null;
}
export async function getEndedEventHistoryStandings(
  eventId: number,
): Promise<DbEventHistoryStanding[]> {
  const result = await db.query<EventHistoryStandingRow>(
    `
      SELECT
        p.id AS player_id,
        p.game_name,
        p.tag_line,
        p.region,
        pc.profile_image_url,
        p.twitch_username,
        p.twitter_username,
        ep.start_tier,
        ep.start_division,
        ep.start_lp,
        ep.start_rank_score,
        ep.end_tier,
        ep.end_division,
        ep.end_lp,
        ep.end_rank_score,
        ep.lp_penalty,
        ep.penalty_reason,
        COUNT(em.id)::TEXT AS games,
        COUNT(em.id) FILTER (WHERE em.result = 'WIN')::TEXT AS wins,
        COUNT(em.id) FILTER (WHERE em.result = 'LOSE')::TEXT AS losses
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      JOIN players p
        ON p.id = ep.player_id
      LEFT JOIN player_cache pc
        ON pc.player_id = p.id
      LEFT JOIN event_matches em
        ON em.event_participant_id = ep.id
      WHERE
        e.id = $1
        AND e.status = 'ended'
      GROUP BY
        p.id,
        p.game_name,
        p.tag_line,
        p.region,
        pc.profile_image_url,
        p.twitch_username,
        p.twitter_username,
        ep.id,
        ep.start_tier,
        ep.start_division,
        ep.start_lp,
        ep.start_rank_score,
        ep.end_tier,
        ep.end_division,
        ep.end_lp,
        ep.end_rank_score,
        ep.lp_penalty,
        ep.penalty_reason
      ORDER BY
        LOWER(p.game_name),
        LOWER(p.tag_line),
        p.id
    `,
    [eventId],
  );
  return result.rows.map((row) => ({
    playerId: Number(row.player_id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    region: row.region,
    profileImageUrl: row.profile_image_url,
    twitchUsername: row.twitch_username,
    twitterUsername: row.twitter_username,
    startTier: row.start_tier,
    startDivision: row.start_division,
    startLp: row.start_lp,
    startRankScore: row.start_rank_score,
    finalTier: row.end_tier,
    finalDivision: row.end_division,
    finalLp: row.end_lp,
    finalRankScore: row.end_rank_score,
    lpPenalty: row.lp_penalty,
    penaltyReason: row.penalty_reason,
    games: Number(row.games),
    wins: Number(row.wins),
    losses: Number(row.losses),
  }));
}
