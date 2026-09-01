import { db } from './client';

export interface PlayerCache {
  playerId: number;
  profileImageUrl: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rankScore: number | null;
  seasonWins: number | null;
  seasonLosses: number | null;
  lastSuccessfulFetchAt: string | null;
  lastFetchAttemptAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface SavePlayerCacheInput {
  playerId: number;
  profileImageUrl: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rankScore: number | null;
  seasonWins: number | null;
  seasonLosses: number | null;
}

interface PlayerCacheRow {
  player_id: string;
  profile_image_url: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rank_score: number | null;
  season_wins: number | null;
  season_losses: number | null;
  last_successful_fetch_at: Date | null;
  last_fetch_attempt_at: Date | null;
  last_error: string | null;
  updated_at: Date;
}

function mapPlayerCache(row: PlayerCacheRow): PlayerCache {
  return {
    playerId: Number(row.player_id),
    profileImageUrl: row.profile_image_url,
    tier: row.tier,
    division: row.division,
    lp: row.lp,
    rankScore: row.rank_score,
    seasonWins: row.season_wins,
    seasonLosses: row.season_losses,
    lastSuccessfulFetchAt: row.last_successful_fetch_at?.toISOString() ?? null,
    lastFetchAttemptAt: row.last_fetch_attempt_at?.toISOString() ?? null,
    lastError: row.last_error,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getPlayerCache(playerId: number): Promise<PlayerCache | null> {
  const result = await db.query<PlayerCacheRow>(
    `
      SELECT
        player_id,

        profile_image_url,

        tier,
        division,
        lp,
        rank_score,

        season_wins,
        season_losses,

        last_successful_fetch_at,
        last_fetch_attempt_at,

        last_error,

        updated_at
      FROM player_cache
      WHERE player_id = $1
      LIMIT 1
      `,
    [playerId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapPlayerCache(result.rows[0]);
}

export async function markPlayerFetchAttempt(playerId: number): Promise<void> {
  await db.query(
    `
    INSERT INTO player_cache (
      player_id,
      last_fetch_attempt_at
    )
    VALUES (
      $1,
      NOW()
    )
    ON CONFLICT (player_id)
    DO UPDATE SET
      last_fetch_attempt_at = NOW(),
      updated_at = NOW()
    `,
    [playerId],
  );
}

export async function savePlayerCacheSuccess(input: SavePlayerCacheInput): Promise<PlayerCache> {
  const result = await db.query<PlayerCacheRow>(
    `
      INSERT INTO player_cache (
        player_id,

        profile_image_url,

        tier,
        division,
        lp,
        rank_score,

        season_wins,
        season_losses,

        last_successful_fetch_at,
        last_fetch_attempt_at,

        last_error,

        updated_at
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

        NOW(),
        NOW(),

        NULL,

        NOW()
      )

      ON CONFLICT (player_id)
      DO UPDATE SET
        profile_image_url = EXCLUDED.profile_image_url,

        tier = EXCLUDED.tier,
        division = EXCLUDED.division,
        lp = EXCLUDED.lp,
        rank_score = EXCLUDED.rank_score,

        season_wins = EXCLUDED.season_wins,
        season_losses = EXCLUDED.season_losses,

        last_successful_fetch_at = NOW(),
        last_fetch_attempt_at = NOW(),

        last_error = NULL,

        updated_at = NOW()

      RETURNING
        player_id,

        profile_image_url,

        tier,
        division,
        lp,
        rank_score,

        season_wins,
        season_losses,

        last_successful_fetch_at,
        last_fetch_attempt_at,

        last_error,

        updated_at
      `,
    [
      input.playerId,
      input.profileImageUrl,
      input.tier,
      input.division,
      input.lp,
      input.rankScore,
      input.seasonWins,
      input.seasonLosses,
    ],
  );

  return mapPlayerCache(result.rows[0]);
}

export async function savePlayerCacheError(playerId: number, error: string): Promise<void> {
  await db.query(
    `
    INSERT INTO player_cache (
      player_id,
      last_fetch_attempt_at,
      last_error
    )
    VALUES (
      $1,
      NOW(),
      $2
    )

    ON CONFLICT (player_id)
    DO UPDATE SET
      last_fetch_attempt_at = NOW(),
      last_error = $2,
      updated_at = NOW()
    `,
    [playerId, error],
  );
}
