import type { Pool } from 'pg';
import type { AdminDatabasePlayerDeleteDependencies } from '@lp-tracker/contracts';
import { db } from './client';

type DatabasePool = Pick<Pool, 'query'>;

interface PlayerDependencyRow {
  id: string;
  game_name: string;
  tag_line: string;
  event_selections: string;
  event_participations: string;
  active_event_participations: string;
  ended_event_participations: string;
}

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('INVALID_PLAYER_DEPENDENCY_COUNT');
  }
  return count;
}

export async function getAdminDatabasePlayerDeleteDependencies(
  playerId: number,
  pool: DatabasePool = db,
): Promise<AdminDatabasePlayerDeleteDependencies | null> {
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error('INVALID_PLAYER_ID');
  }
  const result = await pool.query<PlayerDependencyRow>(
    `
      SELECT
        p.id,
        p.game_name,
        p.tag_line,
        (
          SELECT COUNT(*)::TEXT
          FROM event_player_selections eps
          WHERE eps.player_id = p.id
        ) AS event_selections,
        (
          SELECT COUNT(*)::TEXT
          FROM event_participants ep
          WHERE ep.player_id = p.id
        ) AS event_participations,
        (
          SELECT COUNT(*)::TEXT
          FROM event_participants ep
          JOIN events e
            ON e.id = ep.event_id
          WHERE
            ep.player_id = p.id
            AND e.status = 'active'
        ) AS active_event_participations,
        (
          SELECT COUNT(*)::TEXT
          FROM event_participants ep
          JOIN events e
            ON e.id = ep.event_id
          WHERE
            ep.player_id = p.id
            AND e.status = 'ended'
        ) AS ended_event_participations
      FROM players p
      WHERE p.id = $1
      LIMIT 1
    `,
    [playerId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const eventSelections = parseCount(row.event_selections);
  const eventParticipations = parseCount(row.event_participations);
  const activeEventParticipations = parseCount(row.active_event_participations);
  const endedEventParticipations = parseCount(row.ended_event_participations);
  return {
    playerId: Number(row.id),
    playerName: `${row.game_name}#${row.tag_line}`,
    eventSelections,
    eventParticipations,
    activeEventParticipations,
    endedEventParticipations,
    canDelete: eventParticipations === 0,
  };
}
