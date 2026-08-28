import { db } from './client';

export interface Player {
  id: number;

  gameName: string;
  tagLine: string;
  region: string;

  twitchUsername: string | null;
  twitterUsername: string | null;

  enabled: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface CreatePlayerInput {
  gameName: string;
  tagLine: string;
  region: string;

  twitchUsername?: string | null;
  twitterUsername?: string | null;
}

interface PlayerRow {
  id: string;

  game_name: string;
  tag_line: string;
  region: string;

  twitch_username: string | null;
  twitter_username: string | null;

  enabled: boolean;

  created_at: Date;
  updated_at: Date;
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: Number(row.id),
    gameName: row.game_name,
    tagLine: row.tag_line,
    region: row.region,
    twitchUsername: row.twitch_username,
    twitterUsername: row.twitter_username,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findPlayerByRiotId(
  gameName: string,
  tagLine: string,
  region: string,
): Promise<Player | null> {
  const result = await db.query<PlayerRow>(
    `
            SELECT
                id,
                game_name,
                tag_line,
                region,
                twitch_username,
                twitter_username,
                enabled,
                created_at,
                updated_at
            FROM players
            WHERE
                LOWER(game_name) = LOWER($1)
                AND LOWER(tag_line) = LOWER($2)
                AND LOWER(region) = LOWER($3)
            LIMIT 1
            `,
    [gameName, tagLine, region],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapPlayer(result.rows[0]);
}

export async function getPlayers(enabledOnly = false): Promise<Player[]> {
  const result = await db.query<PlayerRow>(
    `
            SELECT
                id,
                game_name,
                tag_line,
                region,
                twitch_username,
                twitter_username,
                enabled,
                created_at,
                updated_at
            FROM players
            ${enabledOnly ? 'WHERE enabled = TRUE' : ''}
            ORDER BY
                LOWER(game_name),
                LOWER(tag_line)
            `,
  );

  return result.rows.map(mapPlayer);
}

export async function createPlayer(input: CreatePlayerInput): Promise<Player> {
  const existing = await findPlayerByRiotId(input.gameName, input.tagLine, input.region);

  if (existing) {
    return existing;
  }

  try {
    const result = await db.query<PlayerRow>(
      `
                INSERT INTO players (
                    game_name,
                    tag_line,
                    region,
                    twitch_username,
                    twitter_username
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING
                    id,
                    game_name,
                    tag_line,
                    region,
                    twitch_username,
                    twitter_username,
                    enabled,
                    created_at,
                    updated_at
                `,
      [
        input.gameName.trim(),
        input.tagLine.trim(),
        input.region.trim().toUpperCase(),

        input.twitchUsername?.trim() || null,

        input.twitterUsername?.trim().replace(/^@/, '') || null,
      ],
    );

    return mapPlayer(result.rows[0]);
  } catch (error) {
    /*
     * Falls zwei Requests denselben
     * Spieler gleichzeitig anlegen,
     * kann unser Unique Index greifen.
     */
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      const player = await findPlayerByRiotId(input.gameName, input.tagLine, input.region);

      if (player) {
        return player;
      }
    }

    throw error;
  }
}

export async function updatePlayerSocials(
  playerId: number,
  twitchUsername: string | null,
  twitterUsername: string | null,
): Promise<Player> {
  const result = await db.query<PlayerRow>(
    `
            UPDATE players
            SET
                twitch_username = $2,
                twitter_username = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                game_name,
                tag_line,
                region,
                twitch_username,
                twitter_username,
                enabled,
                created_at,
                updated_at
            `,
    [playerId, twitchUsername?.trim() || null, twitterUsername?.trim().replace(/^@/, '') || null],
  );

  if (result.rows.length === 0) {
    throw new Error(`Player ${playerId} not found`);
  }

  return mapPlayer(result.rows[0]);
}

export async function setPlayerEnabled(playerId: number, enabled: boolean): Promise<Player> {
  const result = await db.query<PlayerRow>(
    `
            UPDATE players
            SET
                enabled = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                game_name,
                tag_line,
                region,
                twitch_username,
                twitter_username,
                enabled,
                created_at,
                updated_at
            `,
    [playerId, enabled],
  );

  if (result.rows.length === 0) {
    throw new Error(`Player ${playerId} not found`);
  }

  return mapPlayer(result.rows[0]);
}
