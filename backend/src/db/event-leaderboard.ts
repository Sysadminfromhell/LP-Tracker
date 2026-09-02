import { db } from './client';

export interface EventLeaderboardDbPlayer {
  playerId: number;
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
  profileImageUrl: string | null;
  eventId: number;
  eventName: string;
  eventStatus: 'active' | 'ended';
  eventStartsAt: string;
  eventEndsAt: string | null;
  eventParticipantId: number;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  startWins: number;
  startLosses: number;
  currentTier: string;
  currentDivision: number | null;
  currentLp: number;
  currentRankScore: number;
  currentWins: number;
  currentLosses: number;
  lastUpdated: string;
  lastError: string | null;
}
interface EventLeaderboardRow {
  player_id: string;
  game_name: string;
  tag_line: string;
  region: string;
  twitch_username: string | null;
  twitter_username: string | null;
  profile_image_url: string | null;
  event_id: string;
  event_name: string;
  event_status: 'active' | 'ended';
  event_starts_at: Date;
  event_ends_at: Date | null;
  event_participant_id: string;
  start_tier: string;
  start_division: number | null;
  start_lp: number;
  start_rank_score: number;
  start_wins: number;
  start_losses: number;
  current_tier: string;
  current_division: number | null;
  current_lp: number;
  current_rank_score: number;
  current_wins: number;
  current_losses: number;
  last_updated: Date;
  last_error: string | null;
}
export async function getEventLeaderboardPlayers(
  eventId: number,
  playerId: number | null = null,
): Promise<EventLeaderboardDbPlayer[]> {
  const result = await db.query<EventLeaderboardRow>(
    `
    SELECT
      p.id AS player_id,
      p.game_name,
      p.tag_line,
      p.region,
      p.twitch_username,
      p.twitter_username,
      pc.profile_image_url,
      e.id AS event_id,
      e.name AS event_name,
      e.status AS event_status,
      e.starts_at AS event_starts_at,
      e.ends_at AS event_ends_at,
      ep.id AS event_participant_id,
      ep.start_tier,
      ep.start_division,
      ep.start_lp,
      ep.start_rank_score,
      ep.start_wins,
      ep.start_losses,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_tier
        ELSE pc.tier
      END AS current_tier,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_division
        ELSE pc.division
      END AS current_division,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_lp
        ELSE pc.lp
      END AS current_lp,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_rank_score
        ELSE pc.rank_score
      END AS current_rank_score,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_wins
        ELSE pc.season_wins
      END AS current_wins,
      CASE
        WHEN e.status = 'ended'
          THEN ep.end_losses
        ELSE pc.season_losses
      END AS current_losses,
      CASE
        WHEN e.status = 'ended'
          THEN COALESCE(ep.ended_snapshot_at, e.ends_at, ep.updated_at)
        ELSE COALESCE(pc.last_successful_fetch_at, ep.updated_at)
      END AS last_updated,
      CASE
        WHEN e.status = 'ended'
          THEN NULL
        ELSE pc.last_error
      END AS last_error
    FROM event_participants ep
    JOIN events e
      ON e.id = ep.event_id
    JOIN players p
      ON p.id = ep.player_id
    LEFT JOIN player_cache pc
      ON pc.player_id = p.id
    WHERE
      e.id = $1
      AND (
        $2::BIGINT IS NULL
      OR p.id = $2
      )
    ORDER BY
      LOWER(p.game_name),
      LOWER(p.tag_line)
    `,
    [eventId, playerId],
  );
  return result.rows.map((row) => ({
    playerId: Number(row.player_id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    region: row.region,
    twitchUsername: row.twitch_username,
    twitterUsername: row.twitter_username,
    profileImageUrl: row.profile_image_url,
    eventId: Number(row.event_id),
    eventName: row.event_name,
    eventStatus: row.event_status,
    eventStartsAt: row.event_starts_at.toISOString(),
    eventEndsAt: row.event_ends_at?.toISOString() ?? null,
    eventParticipantId: Number(row.event_participant_id),
    startTier: row.start_tier,
    startDivision: row.start_division,
    startLp: row.start_lp,
    startRankScore: row.start_rank_score,
    startWins: row.start_wins,
    startLosses: row.start_losses,
    currentTier: row.current_tier,
    currentDivision: row.current_division,
    currentLp: row.current_lp,
    currentRankScore: row.current_rank_score,
    currentWins: row.current_wins,
    currentLosses: row.current_losses,
    lastUpdated: row.last_updated.toISOString(),
    lastError: row.last_error,
  }));
}
export async function getEventLeaderboardPlayer(
  eventId: number,
  playerId: number,
): Promise<EventLeaderboardDbPlayer | null> {
  const players = await getEventLeaderboardPlayers(eventId, playerId);
  return players[0] ?? null;
}
