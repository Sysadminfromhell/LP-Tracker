import type { Pool } from 'pg';
import { db } from '../db/client';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';
import { isExpectedReconciliationRetryReason } from './reconciliation';

type QueryClient = Pick<Pool, 'query'>;

interface PlayerRow {
  id: string;
  game_name: string;
  tag_line: string;
  region: string;
  enabled: boolean;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rank_score: number | null;
  season_wins: number | null;
  season_losses: number | null;
  last_successful_fetch_at: Date | null;
  last_fetch_attempt_at: Date | null;
  last_error: string | null;
  cache_updated_at: Date | null;
}
interface PlayerEventRow {
  participant_id: string;
  event_id: string;
  event_name: string;
  event_status: 'draft' | 'scheduled' | 'active' | 'ended';
  start_rank_score: number;
  last_resolved_rank_score: number;
  end_rank_score: number | null;
  matches: string;
  resolved_matches: string;
  pending_matches: string;
  unknown_matches: string;
  attempt_count: number | null;
  next_attempt_at: Date | null;
  last_attempt_at: Date | null;
  queue_last_error: string | null;
  locked_until: Date | null;
}

function getReportStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === 'error')) {
    return 'error';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'ok';
}

export async function runPlayerDiagnostics(
  playerId: number,
  client: QueryClient = db,
): Promise<DiagnosticReport> {
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error(`Invalid player id: ${playerId}`);
  }
  const checks: DiagnosticCheck[] = [];
  const playerResult = await client.query<PlayerRow>(
    `
      SELECT
        p.id,
        p.game_name,
        p.tag_line,
        p.region,
        p.enabled,
        pc.tier,
        pc.division,
        pc.lp,
        pc.rank_score,
        pc.season_wins,
        pc.season_losses,
        pc.last_successful_fetch_at,
        pc.last_fetch_attempt_at,
        pc.last_error,
        pc.updated_at AS cache_updated_at
      FROM players p
      LEFT JOIN player_cache pc
        ON pc.player_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [playerId],
  );
  const player = playerResult.rows[0];
  if (!player) {
    return {
      scope: `player:${playerId}`,
      generatedAt: new Date().toISOString(),
      status: 'error',
      checks: [
        {
          code: 'PLAYER_NOT_FOUND',
          status: 'error',
          message: `Player ${playerId} does not exist`,
        },
      ],
    };
  }
  checks.push({
    code: 'PLAYER_IDENTITY',
    status: 'ok',
    message: `${player.game_name}#${player.tag_line} (${player.region})`,
    details: {
      id: Number(player.id),
      gameName: player.game_name,
      tagLine: player.tag_line,
      region: player.region,
      enabled: player.enabled,
    },
  });
  if (player.cache_updated_at === null) {
    checks.push({
      code: 'PLAYER_CACHE',
      status: 'warning',
      message: 'Player has no cached provider data',
    });
  } else {
    checks.push({
      code: 'PLAYER_CACHE',
      status: player.last_error ? 'warning' : 'ok',
      message: player.last_error
        ? 'Player cache contains a provider error'
        : 'Player cache is available',
      details: {
        tier: player.tier,
        division: player.division,
        lp: player.lp,
        rankScore: player.rank_score,
        seasonWins: player.season_wins,
        seasonLosses: player.season_losses,
        lastSuccessfulFetchAt: player.last_successful_fetch_at?.toISOString() ?? null,
        lastFetchAttemptAt: player.last_fetch_attempt_at?.toISOString() ?? null,
        lastError: player.last_error,
        updatedAt: player.cache_updated_at.toISOString(),
      },
    });
  }
  const eventsResult = await client.query<PlayerEventRow>(
    `
      SELECT
        ep.id AS participant_id,
        e.id AS event_id,
        e.name AS event_name,
        e.status AS event_status,
        ep.start_rank_score,
        ep.last_resolved_rank_score,
        ep.end_rank_score,
        COUNT(em.id)::TEXT AS matches,
        COUNT(em.id) FILTER (
          WHERE em.lp_delta_status = 'resolved'
        )::TEXT AS resolved_matches,
        COUNT(em.id) FILTER (
          WHERE em.lp_delta_status = 'pending'
        )::TEXT AS pending_matches,
        COUNT(em.id) FILTER (
          WHERE em.lp_delta_status = 'unknown'
        )::TEXT AS unknown_matches,
        q.attempt_count,
        q.next_attempt_at,
        q.last_attempt_at,
        q.last_error AS queue_last_error,
        q.locked_until
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      LEFT JOIN event_matches em
        ON em.event_participant_id = ep.id
      LEFT JOIN lp_reconciliation_queue q
        ON q.event_participant_id = ep.id
      WHERE ep.player_id = $1
      GROUP BY
        ep.id,
        e.id,
        e.name,
        e.status,
        ep.start_rank_score,
        ep.last_resolved_rank_score,
        ep.end_rank_score,
        q.attempt_count,
        q.next_attempt_at,
        q.last_attempt_at,
        q.last_error,
        q.locked_until

      ORDER BY
        e.id DESC
    `,
    [playerId],
  );
  checks.push({
    code: 'PLAYER_EVENTS',
    status: 'ok',
    message:
      eventsResult.rows.length === 0
        ? 'Player has not participated in an event'
        : `Player has participated in ${eventsResult.rows.length} event(s)`,
    details: eventsResult.rows.map((row) => ({
      participantId: Number(row.participant_id),
      eventId: Number(row.event_id),
      event: row.event_name,
      status: row.event_status,
      startRankScore: row.start_rank_score,
      lastResolvedRankScore: row.last_resolved_rank_score,
      endRankScore: row.end_rank_score,
      matches: Number(row.matches),
      resolved: Number(row.resolved_matches),
      pending: Number(row.pending_matches),
      unknown: Number(row.unknown_matches),
      reconciliation:
        row.attempt_count === null
          ? null
          : {
              attempts: row.attempt_count,
              nextAttemptAt: row.next_attempt_at?.toISOString() ?? null,
              lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
              lastError: row.queue_last_error,
              lockedUntil: row.locked_until?.toISOString() ?? null,
            },
    })),
  });
  const unresolvedWithoutQueue = eventsResult.rows.filter(
    (row) =>
      Number(row.pending_matches) + Number(row.unknown_matches) > 0 &&
      row.attempt_count === null &&
      (row.event_status === 'active' || row.event_status === 'ended'),
  );
  if (unresolvedWithoutQueue.length > 0) {
    checks.push({
      code: 'PLAYER_RECONCILIATION_QUEUE',
      status: 'warning',
      message: `${unresolvedWithoutQueue.length} event participation(s) contain unresolved matches without a reconciliation queue entry`,
      details: unresolvedWithoutQueue.map((row) => ({
        participantId: Number(row.participant_id),
        eventId: Number(row.event_id),
        event: row.event_name,
        pending: Number(row.pending_matches),
        unknown: Number(row.unknown_matches),
      })),
    });
  } else {
    const queueErrors = eventsResult.rows.filter(
      (row) =>
        row.queue_last_error !== null && !isExpectedReconciliationRetryReason(row.queue_last_error),
    );
    checks.push({
      code: 'PLAYER_RECONCILIATION_QUEUE',
      status: queueErrors.length > 0 ? 'warning' : 'ok',
      message:
        queueErrors.length > 0
          ? `${queueErrors.length} reconciliation queue entry(s) contain an error`
          : 'Player reconciliation queue state looks consistent',
      details:
        queueErrors.length > 0
          ? queueErrors.map((row) => ({
              participantId: Number(row.participant_id),
              eventId: Number(row.event_id),
              attempts: row.attempt_count,
              lastError: row.queue_last_error,
            }))
          : undefined,
    });
  }
  return {
    scope: `player:${playerId}`,
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
