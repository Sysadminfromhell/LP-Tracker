import { db } from './client';

export interface DbPlayerProfile {
  playerId: number;
  gameName: string;
  tagLine: string;
  region: string;
  profileImageUrl: string | null;
  twitchUsername: string | null;
  twitterUsername: string | null;
}
export interface DbPlayerEventSummary {
  eventParticipantId: number;
  eventId: number;
  eventName: string;
  eventStatus: 'active' | 'ended';
  startsAt: string;
  endsAt: string | null;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  currentTier: string;
  currentDivision: number | null;
  currentLp: number;
  currentRankScore: number;
  lpPenalty: number;
  penaltyReason: string | null;
  games: number;
  wins: number;
  losses: number;
  mainRole: string | null;
  lastUpdated: string;
}
export interface DbPlayerHistoryMatch {
  providerMatchId: string;
  gameCreatedAt: string;
  durationSeconds: number | null;
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
  items: string[];
}
interface PlayerProfileRow {
  player_id: string;
  game_name: string;
  tag_line: string;
  region: string;
  profile_image_url: string | null;
  twitch_username: string | null;
  twitter_username: string | null;
}
interface PlayerEventSummaryRow {
  event_participant_id: string;
  event_id: string;
  event_name: string;
  event_status: 'active' | 'ended';
  starts_at: Date;
  ends_at: Date | null;
  start_tier: string;
  start_division: number | null;
  start_lp: number;
  start_rank_score: number;
  current_tier: string;
  current_division: number | null;
  current_lp: number;
  current_rank_score: number;
  lp_penalty: number;
  penalty_reason: string | null;
  games: string;
  wins: string;
  losses: string;
  main_role: string | null;
  last_updated: Date;
}

export async function getPlayerProfile(playerId: number): Promise<DbPlayerProfile | null> {
  const result = await db.query<PlayerProfileRow>(
    `
      SELECT
        p.id AS player_id,
        p.game_name,
        p.tag_line,
        p.region,
        pc.profile_image_url,
        p.twitch_username,
        p.twitter_username
      FROM players p
      LEFT JOIN player_cache pc
        ON pc.player_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [playerId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    playerId: Number(row.player_id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    region: row.region,
    profileImageUrl: row.profile_image_url,
    twitchUsername: row.twitch_username,
    twitterUsername: row.twitter_username,
  };
}
export async function getPlayerEventHistory(
  playerId: number,
  eventId: number | null = null,
): Promise<DbPlayerEventSummary[]> {
  const result = await db.query<PlayerEventSummaryRow>(
    `
      SELECT
        ep.id AS event_participant_id,
        e.id AS event_id,
        e.name AS event_name,
        e.status AS event_status,
        e.starts_at,
        e.ends_at,
        ep.start_tier,
        ep.start_division,
        ep.start_lp,
        ep.start_rank_score,
        CASE
          WHEN e.status = 'ended' THEN ep.end_tier
          ELSE pc.tier
        END AS current_tier,
        CASE
          WHEN e.status = 'ended' THEN ep.end_division
          ELSE pc.division
        END AS current_division,
        CASE
          WHEN e.status = 'ended' THEN ep.end_lp
          ELSE pc.lp
        END AS current_lp,
        CASE
          WHEN e.status = 'ended' THEN ep.end_rank_score
          ELSE pc.rank_score
        END AS current_rank_score,
        ep.lp_penalty,
        ep.penalty_reason,
        match_stats.games,
        match_stats.wins,
        match_stats.losses,
        main_role.position AS main_role,
        CASE
          WHEN e.status = 'ended'
            THEN COALESCE(ep.ended_snapshot_at, e.ends_at, ep.updated_at)
          ELSE COALESCE(pc.last_successful_fetch_at, ep.updated_at)
        END AS last_updated
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      JOIN players p
        ON p.id = ep.player_id
      LEFT JOIN player_cache pc
        ON pc.player_id = p.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::TEXT AS games,
          COUNT(*) FILTER (WHERE em.result = 'WIN')::TEXT AS wins,
          COUNT(*) FILTER (WHERE em.result = 'LOSE')::TEXT AS losses
        FROM event_matches em
        WHERE em.event_participant_id = ep.id
      ) match_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          CASE UPPER(BTRIM(em.position))
            WHEN 'MIDDLE' THEN 'MID'
            WHEN 'MID' THEN 'MID'
            WHEN 'JGL' THEN 'JUNGLE'
            WHEN 'JUNGLE' THEN 'JUNGLE'
            WHEN 'BOTTOM' THEN 'ADC'
            WHEN 'ADC' THEN 'ADC'
            WHEN 'UTILITY' THEN 'SUPPORT'
            WHEN 'SUPPORT' THEN 'SUPPORT'
            WHEN 'TOP' THEN 'TOP'
            ELSE UPPER(BTRIM(em.position))
          END AS position
        FROM event_matches em
        WHERE
          em.event_participant_id = ep.id
          AND BTRIM(em.position) <> ''
        GROUP BY 1
        ORDER BY
          COUNT(*) DESC,
          MAX(em.game_created_at) DESC,
          1 ASC
        LIMIT 1
      ) main_role ON TRUE
      WHERE
        ep.player_id = $1
        AND e.status IN ('active', 'ended')
        AND ($2::BIGINT IS NULL OR e.id = $2)
      ORDER BY
        e.starts_at DESC,
        e.id DESC
    `,
    [playerId, eventId],
  );
  return result.rows.map((row) => ({
    eventParticipantId: Number(row.event_participant_id),
    eventId: Number(row.event_id),
    eventName: row.event_name,
    eventStatus: row.event_status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    startTier: row.start_tier,
    startDivision: row.start_division,
    startLp: row.start_lp,
    startRankScore: row.start_rank_score,
    currentTier: row.current_tier,
    currentDivision: row.current_division,
    currentLp: row.current_lp,
    currentRankScore: row.current_rank_score,
    lpPenalty: row.lp_penalty,
    penaltyReason: row.penalty_reason,
    games: Number(row.games),
    wins: Number(row.wins),
    losses: Number(row.losses),
    mainRole: row.main_role,
    lastUpdated: row.last_updated.toISOString(),
  }));
}
export async function getPlayerEventMatches(
  eventParticipantId: number,
): Promise<DbPlayerHistoryMatch[]> {
  const result = await db.query<{
    provider_match_id: string;
    game_created_at: Date;
    duration_seconds: number | null;
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
    items: string[];
  }>(
    `
      SELECT
        em.provider_match_id,
        em.game_created_at,
        em.duration_seconds,
        em.champion_id,
        em.champion,
        em.position,
        em.kills,
        em.deaths,
        em.assists,
        em.cs,
        em.result,
        em.lp_delta,
        em.lp_delta_status,
        COALESCE(tracked.items, ARRAY[]::TEXT[]) AS items
      FROM event_matches em
      LEFT JOIN LATERAL (
        SELECT emp.items
        FROM event_match_participants emp
        WHERE
          emp.event_match_id = em.id
          AND emp.is_tracked_player = TRUE
        LIMIT 1
      ) tracked ON TRUE
      WHERE em.event_participant_id = $1
      ORDER BY
        em.game_created_at DESC,
        em.id DESC
    `,
    [eventParticipantId],
  );
  return result.rows.map((row) => ({
    providerMatchId: row.provider_match_id,
    gameCreatedAt: row.game_created_at.toISOString(),
    durationSeconds: row.duration_seconds,
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
    items: row.items,
  }));
}