import { db } from './client';
import { syncRecentEventMatchDetails } from './event-match-details';
import type { RankedLpHistoryEntry, SummonerMatch } from '../providers/league-data.types';
import { resolveLpHistoryDeltas } from '../services/lp-history-resolver';

interface ParticipantState {
  id: string;
  last_resolved_rank_score: number;
}
interface PendingMatchRow {
  id: string;
  provider_match_id: string;
  game_created_at: Date;
}
export interface EventRefreshResult {
  newMatches: number;
  resolvedMatches: number;
  unknownMatches: number;
}
export interface EventRefreshOptions {
  resolveLpDeltas?: boolean;
}
export async function updateEventAfterPlayerRefresh(
  eventParticipantId: number,
  eventStartsAt: string,
  eventEndsAt: string | null,
  recentMatches: SummonerMatch[],
  currentRankScore: number,
  lpHistory: RankedLpHistoryEntry[] = [],
  options: EventRefreshOptions = {},
): Promise<EventRefreshResult> {
  const client = await db.connect();
  const resolveLpDeltas = options.resolveLpDeltas ?? true;
  try {
    await client.query('BEGIN');
    const participantResult = await client.query<ParticipantState>(
      `
        SELECT
          id,
          last_resolved_rank_score
        FROM event_participants
        WHERE id = $1
        FOR UPDATE
        `,
      [eventParticipantId],
    );
    if (participantResult.rows.length === 0) {
      throw new Error(`Event participant ${eventParticipantId} not found`);
    }
    const participant = participantResult.rows[0];

    const eventStart = new Date(eventStartsAt).getTime();
    const eventEnd = eventEndsAt === null ? null : new Date(eventEndsAt).getTime();
    const rankedMatches = recentMatches
      .filter((match) => {
        if (match.gameType !== 'SOLORANKED') {
          return false;
        }
        const matchCreatedAt = new Date(match.createdAt).getTime();
        if (matchCreatedAt < eventStart) {
          return false;
        }
        if (eventEnd !== null && matchCreatedAt > eventEnd) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let newMatches = 0;
    for (const match of rankedMatches) {
      const result = await client.query(
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
            NULL,
            'pending'
          )
          ON CONFLICT (
            event_participant_id,
            provider_match_id
          )
          DO NOTHING
          RETURNING id
          `,
        [
          eventParticipantId,
          match.id,
          match.createdAt,
          match.championId,
          match.champion,
          match.position,
          match.kills,
          match.deaths,
          match.assists,
          match.cs,
          match.result,
        ],
      );
      if (result.rowCount === 1) {
        newMatches++;
      }
    }
    const pendingResult = await client.query<PendingMatchRow>(
      `
    SELECT
      id,
      provider_match_id,
      game_created_at
    FROM event_matches
    WHERE
      event_participant_id = $1
      AND lp_delta_status = 'pending'
    ORDER BY
      game_created_at ASC
    FOR UPDATE
    `,
      [eventParticipantId],
    );
    const pending = pendingResult.rows;
    const previousRankScore = participant.last_resolved_rank_score;
    const scoreChanged = currentRankScore !== previousRankScore;
    let resolvedMatches = 0;
    let unknownMatches = 0;
    let resolvedFromHistory = false;

    if (resolveLpDeltas && pending.length > 1 && lpHistory.length > 0) {
      const historyResolutions = resolveLpHistoryDeltas(
        previousRankScore,
        pending.map((match) => ({
          id: match.provider_match_id,
          createdAt: match.game_created_at.toISOString(),
        })),
        lpHistory,
      );

      const finalResolution = historyResolutions.at(-1);
      const completeHistoryResolution =
        historyResolutions.length === pending.length &&
        finalResolution?.rankScoreAfter === currentRankScore;

      if (completeHistoryResolution) {
        const resolutionsByMatchId = new Map(
          historyResolutions.map((resolution) => [resolution.matchId, resolution]),
        );
        for (const match of pending) {
          const resolution = resolutionsByMatchId.get(match.provider_match_id);
          if (!resolution) {
            throw new Error(`LP history resolution missing for match ${match.provider_match_id}`);
          }
          await client.query(
            `
        UPDATE event_matches
        SET
          lp_delta = $2,
          lp_delta_status = 'resolved',
          updated_at = NOW()
        WHERE id = $1
        `,
            [match.id, resolution.lpDelta],
          );
        }
        await client.query(
          `
      UPDATE event_participants
      SET
        last_resolved_rank_score = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
          [eventParticipantId, currentRankScore],
        );
        resolvedMatches = pending.length;
        resolvedFromHistory = true;
      }
    }
    if (resolveLpDeltas && !resolvedFromHistory) {
      if (pending.length === 1 && scoreChanged) {
        const lpDelta = currentRankScore - previousRankScore;
        await client.query(
          `
      UPDATE event_matches
      SET
        lp_delta = $2,
        lp_delta_status = 'resolved',
        updated_at = NOW()
      WHERE id = $1
      `,
          [pending[0].id, lpDelta],
        );
        await client.query(
          `
      UPDATE event_participants
      SET
        last_resolved_rank_score = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
          [eventParticipantId, currentRankScore],
        );
        resolvedMatches = 1;
      } else if (pending.length > 1 && scoreChanged) {
        await client.query(
          `
      UPDATE event_matches
      SET
        lp_delta = NULL,
        lp_delta_status = 'unknown',
        updated_at = NOW()
      WHERE
        event_participant_id = $1
        AND lp_delta_status = 'pending'
      `,
          [eventParticipantId],
        );
        await client.query(
          `
      UPDATE event_participants
      SET
        last_resolved_rank_score = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
          [eventParticipantId, currentRankScore],
        );
        unknownMatches = pending.length;
      } else if (pending.length === 0 && scoreChanged) {
        await client.query(
          `
      UPDATE event_participants
      SET
        last_resolved_rank_score = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
          [eventParticipantId, currentRankScore],
        );
      }
    }
    await client.query('COMMIT');
    const refreshResult = {
      newMatches,
      resolvedMatches,
      unknownMatches,
    };
    try {
      await syncRecentEventMatchDetails(client, eventParticipantId, recentMatches);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[EVENT] Participant ${eventParticipantId}: ` +
          `could not sync rich match details: ${message}`,
      );
    }
    return refreshResult;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
