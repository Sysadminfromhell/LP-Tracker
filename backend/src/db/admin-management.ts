import { db } from './client';

export interface AdminPlayer {
  id: number;
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
  enabled: boolean;
  profileImageUrl: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rankScore: number | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
}

export interface CreateAdminPlayerInput {
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername?: string | null;
  twitterUsername?: string | null;
}

export interface UpdateAdminPlayerInput {
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
  enabled: boolean;
}

interface AdminPlayerRow {
  id: string;
  game_name: string;
  tag_line: string;
  region: string;
  twitch_username: string | null;
  twitter_username: string | null;
  enabled: boolean;
  profile_image_url: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rank_score: number | null;
  last_successful_fetch_at: Date | null;
  last_error: string | null;
}

function mapAdminPlayer(row: AdminPlayerRow): AdminPlayer {
  return {
    id: Number(row.id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    region: row.region,
    twitchUsername: row.twitch_username,
    twitterUsername: row.twitter_username,
    enabled: row.enabled,
    profileImageUrl: row.profile_image_url,
    tier: row.tier,
    division: row.division,
    lp: row.lp,
    rankScore: row.rank_score,
    lastSuccessfulFetchAt: row.last_successful_fetch_at?.toISOString() ?? null,
    lastError: row.last_error,
  };
}

export async function getAdminPlayers(): Promise<AdminPlayer[]> {
  const result = await db.query<AdminPlayerRow>(
    `
    SELECT
      p.id,
      p.game_name,
      p.tag_line,
      p.region,
      p.twitch_username,
      p.twitter_username,
      p.enabled,
      pc.profile_image_url,
      pc.tier,
      pc.division,
      pc.lp,
      pc.rank_score,
      pc.last_successful_fetch_at,
      pc.last_error
    FROM players p
    LEFT JOIN player_cache pc
      ON pc.player_id = p.id
    ORDER BY
      p.enabled DESC,
      LOWER(p.game_name),
      LOWER(p.tag_line)
    `,
  );

  return result.rows.map(mapAdminPlayer);
}

export async function createAdminPlayer(input: CreateAdminPlayerInput): Promise<AdminPlayer> {
  const result = await db.query<AdminPlayerRow>(
    `
    INSERT INTO players (
      game_name,
      tag_line,
      region,
      twitch_username,
      twitter_username,
      enabled
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      TRUE
    )
    RETURNING
      id,
      game_name,
      tag_line,
      region,
      twitch_username,
      twitter_username,
      enabled,
      NULL::TEXT AS profile_image_url,
      NULL::TEXT AS tier,
      NULL::INTEGER AS division,
      NULL::INTEGER AS lp,
      NULL::INTEGER AS rank_score,
      NULL::TIMESTAMPTZ AS last_successful_fetch_at,
      NULL::TEXT AS last_error
    `,
    [
      input.gameName.trim(),
      input.tagLine.trim(),
      input.region.trim().toUpperCase(),
      input.twitchUsername?.trim() || null,
      input.twitterUsername?.trim().replace(/^@/, '') || null,
    ],
  );
  return mapAdminPlayer(result.rows[0]);
}

export async function updateAdminPlayer(
  playerId: number,
  input: UpdateAdminPlayerInput,
): Promise<AdminPlayer | null> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query<{
      game_name: string;
      tag_line: string;
      region: string;
    }>(
      `
      SELECT
        game_name,
        tag_line,
        region
      FROM players
      WHERE id = $1
      FOR UPDATE
      `,
      [playerId],
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const current = currentResult.rows[0];
    const identityChanged =
      current.game_name !== input.gameName.trim() ||
      current.tag_line !== input.tagLine.trim() ||
      current.region !== input.region.trim().toUpperCase();

    if (identityChanged) {
      const activeParticipant = await client.query(
        `
        SELECT 1
        FROM event_participants ep
        JOIN events e
          ON e.id = ep.event_id
        WHERE
          ep.player_id = $1
          AND e.status = 'active'
        LIMIT 1
        `,
        [playerId],
      );

      if (activeParticipant.rows.length > 0) {
        throw new Error('RIOT_ID_LOCKED_DURING_ACTIVE_EVENT');
      }
    }

    await client.query(
      `
      UPDATE players
      SET
        game_name = $2,
        tag_line = $3,
        region = $4,
        twitch_username = $5,
        twitter_username = $6,
        enabled = $7,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        playerId,
        input.gameName.trim(),
        input.tagLine.trim(),
        input.region.trim().toUpperCase(),
        input.twitchUsername?.trim() || null,
        input.twitterUsername?.trim().replace(/^@/, '') || null,
        input.enabled,
      ],
    );

    if (identityChanged) {
      await client.query(
        `
        DELETE FROM player_cache
        WHERE player_id = $1
        `,
        [playerId],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const players = await getAdminPlayers();
  return players.find((player) => player.id === playerId) ?? null;
}

export async function addPlayerToActiveEvent(eventId: number, playerId: number): Promise<boolean> {
  const result = await db.query(
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
    SELECT
      $1,
      p.id,
      pc.tier,
      pc.division,
      pc.lp,
      pc.rank_score,
      pc.season_wins,
      pc.season_losses,
      pc.rank_score,
      NOW()
    FROM players p
    JOIN player_cache pc
      ON pc.player_id = p.id
    WHERE
      p.id = $2
      AND pc.tier IS NOT NULL
      AND pc.lp IS NOT NULL
      AND pc.rank_score IS NOT NULL
      AND pc.season_wins IS NOT NULL
      AND pc.season_losses IS NOT NULL
    ON CONFLICT (
      event_id,
      player_id
    )
    DO NOTHING
    RETURNING id
    `,
    [eventId, playerId],
  );

  return result.rows.length > 0;
}
