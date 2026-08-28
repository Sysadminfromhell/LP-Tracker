import { db } from './client';

export interface LeaderboardDbPlayer {
  playerId: number;

  gameName: string;
  tagLine: string;
  region: string;

  twitchUsername: string | null;
  twitterUsername: string | null;

  profileImageUrl: string | null;

  currentTier: string | null;
  currentDivision: number | null;
  currentLp: number | null;
  currentRankScore: number | null;

  seasonWins: number | null;
  seasonLosses: number | null;

  lastSuccessfulFetchAt: string | null;
  lastError: string | null;

  eventId: number | null;
  eventParticipantId: number | null;

  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventStatus: string | null;

  startTier: string | null;
  startDivision: number | null;
  startLp: number | null;
  startRankScore: number | null;

  startWins: number | null;
  startLosses: number | null;
}

interface LeaderboardRow {
  player_id: string;

  game_name: string;
  tag_line: string;
  region: string;

  twitch_username: string | null;
  twitter_username: string | null;

  profile_image_url: string | null;

  current_tier: string | null;
  current_division: number | null;
  current_lp: number | null;
  current_rank_score: number | null;

  season_wins: number | null;
  season_losses: number | null;

  last_successful_fetch_at: Date | null;
  last_error: string | null;

  event_id: string | null;
  event_participant_id: string | null;

  event_starts_at: Date | null;
  event_ends_at: Date | null;
  event_status: string | null;

  start_tier: string | null;
  start_division: number | null;
  start_lp: number | null;
  start_rank_score: number | null;

  start_wins: number | null;
  start_losses: number | null;
}

function mapRow(row: LeaderboardRow): LeaderboardDbPlayer {
  return {
    playerId: Number(row.player_id),

    gameName: row.game_name,

    tagLine: row.tag_line,

    region: row.region,

    twitchUsername: row.twitch_username,

    twitterUsername: row.twitter_username,

    profileImageUrl: row.profile_image_url,

    currentTier: row.current_tier,

    currentDivision: row.current_division,

    currentLp: row.current_lp,

    currentRankScore: row.current_rank_score,

    seasonWins: row.season_wins,

    seasonLosses: row.season_losses,

    lastSuccessfulFetchAt: row.last_successful_fetch_at?.toISOString() ?? null,

    lastError: row.last_error,

    eventId: row.event_id === null ? null : Number(row.event_id),

    eventParticipantId: row.event_participant_id === null ? null : Number(row.event_participant_id),

    eventStartsAt: row.event_starts_at?.toISOString() ?? null,

    eventEndsAt: row.event_ends_at?.toISOString() ?? null,

    eventStatus: row.event_status,

    startTier: row.start_tier,

    startDivision: row.start_division,

    startLp: row.start_lp,

    startRankScore: row.start_rank_score,

    startWins: row.start_wins,

    startLosses: row.start_losses,
  };
}

export async function getLeaderboardPlayersFromDb(): Promise<LeaderboardDbPlayer[]> {
  const result = await db.query<LeaderboardRow>(
    `
      SELECT
        p.id AS player_id,

        p.game_name,
        p.tag_line,
        p.region,

        p.twitch_username,
        p.twitter_username,

        pc.profile_image_url,

        pc.tier AS current_tier,
        pc.division AS current_division,
        pc.lp AS current_lp,
        pc.rank_score AS current_rank_score,

        pc.season_wins,
        pc.season_losses,

        pc.last_successful_fetch_at,
        pc.last_error,

        e.id AS event_id,
        ep.id AS event_participant_id,

        e.starts_at AS event_starts_at,
        e.ends_at AS event_ends_at,
        e.status AS event_status,

        ep.start_tier,
        ep.start_division,
        ep.start_lp,
        ep.start_rank_score,

        ep.start_wins,
        ep.start_losses

      FROM players p

      LEFT JOIN player_cache pc
        ON pc.player_id = p.id

      LEFT JOIN events e
        ON e.status = 'active'

      LEFT JOIN event_participants ep
        ON ep.event_id = e.id
        AND ep.player_id = p.id

      WHERE p.enabled = TRUE

      ORDER BY
        LOWER(p.game_name),
        LOWER(p.tag_line)
      `,
  );

  return result.rows.map(mapRow);
}
