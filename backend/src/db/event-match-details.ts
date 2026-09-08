import type { PoolClient } from 'pg';
import type {
  MatchParticipantPosition,
  MatchParticipantSide,
  SummonerMatch,
} from '../providers/league-data.types';

type QueryClient = Pick<PoolClient, 'query'>;

export interface EventMatchDetailParticipant {
  side: MatchParticipantSide;
  position: MatchParticipantPosition;
  championId: number;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  laneCs: number;
  jungleCs: number;
  cs: number;
  damageToChampions: number;
  items: string[];
  isTrackedPlayer: boolean;
}
export interface EventMatchDetails {
  durationSeconds: number;
  participants: EventMatchDetailParticipant[];
}
interface EventMatchDetailRow {
  event_match_id: string;
  duration_seconds: number;
}
interface EventMatchDetailParticipantRow {
  side: MatchParticipantSide;
  position: MatchParticipantPosition;
  champion_id: number;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  lane_cs: number;
  jungle_cs: number;
  cs: number;
  damage_to_champions: number;
  items: string[];
  is_tracked_player: boolean;
}

export async function replaceEventMatchDetails(
  client: QueryClient,
  eventMatchId: number,
  match: SummonerMatch,
): Promise<void> {
  const participants = match.participants;
  if (!participants || participants.length === 0) {
    throw new Error(`Match ${match.id} does not contain rich participant details`);
  }
  const trackedPlayerCount = participants.filter(
    (participant) => participant.isTrackedPlayer,
  ).length;
  if (trackedPlayerCount !== 1) {
    throw new Error(
      `Match ${match.id} must contain exactly one tracked player, ` + `found ${trackedPlayerCount}`,
    );
  }
  await client.query(
    `
      INSERT INTO event_match_details (
        event_match_id,
        duration_seconds
      )
      VALUES (
        $1,
        $2
      )
      ON CONFLICT (event_match_id)
      DO UPDATE SET
        duration_seconds = EXCLUDED.duration_seconds,
        updated_at = NOW()
    `,
    [eventMatchId, match.durationSeconds],
  );
  await client.query(
    `
      DELETE FROM event_match_participants
      WHERE event_match_id = $1
    `,
    [eventMatchId],
  );
  const params: unknown[] = [eventMatchId];
  const values = participants.map((participant, index) => {
    const offset = 2 + index * 13;
    params.push(
      participant.side,
      participant.position,
      participant.championId,
      participant.champion,
      participant.kills,
      participant.deaths,
      participant.assists,
      participant.laneCs,
      participant.jungleCs,
      participant.cs,
      participant.damageToChampions,
      participant.items,
      participant.isTrackedPlayer,
    );
    return `(
        $1,
        $${offset},
        $${offset + 1},
        $${offset + 2},
        $${offset + 3},
        $${offset + 4},
        $${offset + 5},
        $${offset + 6},
        $${offset + 7},
        $${offset + 8},
        $${offset + 9},
        $${offset + 10},
        $${offset + 11},
        $${offset + 12}
      )`;
  });
  await client.query(
    `
      INSERT INTO event_match_participants (
        event_match_id,
        side,
        position,
        champion_id,
        champion,
        kills,
        deaths,
        assists,
        lane_cs,
        jungle_cs,
        cs,
        damage_to_champions,
        items,
        is_tracked_player
      )
      VALUES
        ${values.join(',\n')}
    `,
    params,
  );
}
export async function pruneEventMatchDetails(
  client: QueryClient,
  eventParticipantId: number,
  keepMatches = 3,
): Promise<void> {
  if (!Number.isInteger(keepMatches) || keepMatches < 0) {
    throw new Error(`keepMatches must be a non-negative integer, got ${keepMatches}`);
  }
  await client.query(
    `
      DELETE FROM event_match_details AS details
      USING event_matches AS match
      WHERE
        details.event_match_id = match.id
        AND match.event_participant_id = $1
        AND match.id NOT IN (
          SELECT recent_match.id
          FROM event_matches AS recent_match
          WHERE recent_match.event_participant_id = $1
          ORDER BY
            recent_match.game_created_at DESC,
            recent_match.id DESC
          LIMIT $2
        )
    `,
    [eventParticipantId, keepMatches],
  );
}
interface EventMatchIdRow {
  id: string;
}
export async function syncRecentEventMatchDetails(
  client: QueryClient,
  eventParticipantId: number,
  recentMatches: SummonerMatch[],
): Promise<void> {
  const richMatches = recentMatches
    .filter(
      (match) =>
        match.gameType === 'SOLORANKED' &&
        match.participants !== undefined &&
        match.participants.length > 0,
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 3);
  await client.query('BEGIN');
  try {
    for (const match of richMatches) {
      const eventMatchResult = await client.query<EventMatchIdRow>(
        `
            SELECT id
            FROM event_matches
            WHERE
              event_participant_id = $1
              AND provider_match_id = $2
            LIMIT 1
          `,
        [eventParticipantId, match.id],
      );
      const eventMatch = eventMatchResult.rows[0];
      if (!eventMatch) {
        continue;
      }
      await replaceEventMatchDetails(client, Number(eventMatch.id), match);
    }
    await pruneEventMatchDetails(client, eventParticipantId, 3);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
export async function getEventMatchDetails(
  client: QueryClient,
  eventId: number,
  playerId: number,
  providerMatchId: string,
): Promise<EventMatchDetails | null> {
  const detailResult = await client.query<EventMatchDetailRow>(
    `
        SELECT
          details.event_match_id,
          details.duration_seconds
        FROM event_match_details AS details
        JOIN event_matches AS match
          ON match.id = details.event_match_id
        JOIN event_participants AS participant
          ON participant.id = match.event_participant_id
        WHERE
          participant.event_id = $1
          AND participant.player_id = $2
          AND match.provider_match_id = $3
        LIMIT 1
      `,
    [eventId, playerId, providerMatchId],
  );
  const detail = detailResult.rows[0];
  if (!detail) {
    return null;
  }
  const participantResult = await client.query<EventMatchDetailParticipantRow>(
    `
        SELECT
          side,
          position,
          champion_id,
          champion,
          kills,
          deaths,
          assists,
          lane_cs,
          jungle_cs,
          cs,
          damage_to_champions,
          items,
          is_tracked_player
        FROM event_match_participants
        WHERE event_match_id = $1
        ORDER BY
          CASE position
            WHEN 'TOP' THEN 1
            WHEN 'JUNGLE' THEN 2
            WHEN 'MID' THEN 3
            WHEN 'ADC' THEN 4
            WHEN 'SUPPORT' THEN 5
            ELSE 6
          END,
          CASE side
            WHEN 'ALLY' THEN 1
            ELSE 2
          END
      `,
    [detail.event_match_id],
  );
  return {
    durationSeconds: detail.duration_seconds,
    participants: participantResult.rows.map((participant) => ({
      side: participant.side,
      position: participant.position,
      championId: participant.champion_id,
      champion: participant.champion,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      laneCs: participant.lane_cs,
      jungleCs: participant.jungle_cs,
      cs: participant.cs,
      damageToChampions: participant.damage_to_champions,
      items: participant.items,
      isTrackedPlayer: participant.is_tracked_player,
    })),
  };
}
