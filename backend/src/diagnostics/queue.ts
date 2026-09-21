import type { Pool } from 'pg';
import { db } from '../db/client';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';
import { isExpectedReconciliationRetryReason } from './reconciliation';

type QueryClient = Pick<Pool, 'query'>;

interface QueueRow {
  event_participant_id: string;
  event_id: string;
  event_name: string;
  event_status: 'draft' | 'scheduled' | 'active' | 'ended';
  player_id: string;
  game_name: string;
  tag_line: string;
  attempt_count: number;
  next_attempt_at: Date;
  last_attempt_at: Date | null;
  last_error: string | null;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  unresolved_matches: string;
  pending_matches: string;
  unknown_matches: string;
  is_due: boolean;
  lease_active: boolean;
}
interface MissingQueueRow {
  event_participant_id: string;
  event_id: string;
  event_name: string;
  event_status: 'active' | 'ended';
  player_id: string;
  game_name: string;
  tag_line: string;
  unresolved_matches: string;
  pending_matches: string;
  unknown_matches: string;
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

export async function runQueueDiagnostics(client: QueryClient = db): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];

  const queueResult = await client.query<QueueRow>(
    `
      SELECT
        q.event_participant_id,
        e.id AS event_id,
        e.name AS event_name,
        e.status AS event_status,
        p.id AS player_id,
        p.game_name,
        p.tag_line,
        q.attempt_count,
        q.next_attempt_at,
        q.last_attempt_at,
        q.last_error,
        q.locked_until,
        q.created_at,
        q.updated_at,
        (
          COUNT(em.id) FILTER (
            WHERE em.lp_delta_status IN ('pending', 'unknown')
          )
        )::TEXT AS unresolved_matches,
        (
          COUNT(em.id) FILTER (
            WHERE em.lp_delta_status = 'pending'
          )
        )::TEXT AS pending_matches,
        (
          COUNT(em.id) FILTER (
            WHERE em.lp_delta_status = 'unknown'
          )
        )::TEXT AS unknown_matches,
        (
          q.next_attempt_at <= NOW()
          AND (
            q.locked_until IS NULL
            OR q.locked_until <= NOW()
          )
        ) AS is_due,
        (
          q.locked_until IS NOT NULL
          AND q.locked_until > NOW()
        ) AS lease_active
      FROM lp_reconciliation_queue q
      JOIN event_participants ep
        ON ep.id = q.event_participant_id
      JOIN events e
        ON e.id = ep.event_id
      JOIN players p
        ON p.id = ep.player_id
      LEFT JOIN event_matches em
        ON em.event_participant_id = ep.id
      GROUP BY
        q.event_participant_id,
        e.id,
        e.name,
        e.status,
        p.id,
        p.game_name,
        p.tag_line,
        q.attempt_count,
        q.next_attempt_at,
        q.last_attempt_at,
        q.last_error,
        q.locked_until,
        q.created_at,
        q.updated_at
      ORDER BY
        q.next_attempt_at ASC,
        q.event_participant_id ASC
    `,
  );
  const queueRows = queueResult.rows;
  const due = queueRows.filter((row) => row.is_due);
  const leased = queueRows.filter((row) => row.lease_active);
  const expectedRetries = queueRows.filter((row) =>
    isExpectedReconciliationRetryReason(row.last_error),
  );
  const withErrors = queueRows.filter(
    (row) => row.last_error !== null && !isExpectedReconciliationRetryReason(row.last_error),
  );
  const withoutUnresolvedMatches = queueRows.filter((row) => Number(row.unresolved_matches) === 0);
  const invalidEventState = queueRows.filter(
    (row) => row.event_status !== 'active' && row.event_status !== 'ended',
  );
  checks.push({
    code: 'RECONCILIATION_QUEUE_SUMMARY',
    status: 'ok',
    message:
      queueRows.length === 0
        ? 'Reconciliation queue is empty'
        : `${queueRows.length} reconciliation queue item(s) found`,
    details: {
      total: queueRows.length,
      due: due.length,
      leased: leased.length,
      waiting: queueRows.length - due.length - leased.length,
      expectedRetries: expectedRetries.length,
      withErrors: withErrors.length,
    },
  });
  checks.push({
    code: 'RECONCILIATION_QUEUE_RETRIES',
    status: 'ok',
    message:
      expectedRetries.length === 0
        ? 'No reconciliation jobs are waiting on expected retry conditions'
        : `${expectedRetries.length} queue item(s) are waiting on expected retry conditions`,
    details:
      expectedRetries.length > 0
        ? expectedRetries.map((row) => ({
            participantId: Number(row.event_participant_id),
            eventId: Number(row.event_id),
            playerId: Number(row.player_id),
            player: `${row.game_name}#${row.tag_line}`,
            attempts: row.attempt_count,
            reason: row.last_error,
            nextAttemptAt: row.next_attempt_at.toISOString(),
          }))
        : undefined,
  });
  checks.push({
    code: 'RECONCILIATION_QUEUE_ERRORS',
    status: withErrors.length > 0 ? 'warning' : 'ok',
    message:
      withErrors.length > 0
        ? `${withErrors.length} queue item(s) contain a previous error`
        : 'No reconciliation queue errors are stored',
    details:
      withErrors.length > 0
        ? withErrors.map((row) => ({
            participantId: Number(row.event_participant_id),
            eventId: Number(row.event_id),
            player: `${row.game_name}#${row.tag_line}`,
            attempts: row.attempt_count,
            lastError: row.last_error,
            nextAttemptAt: row.next_attempt_at.toISOString(),
          }))
        : undefined,
  });
  checks.push({
    code: 'RECONCILIATION_QUEUE_WORK',
    status: withoutUnresolvedMatches.length > 0 ? 'warning' : 'ok',
    message:
      withoutUnresolvedMatches.length > 0
        ? `${withoutUnresolvedMatches.length} queue item(s) have no unresolved matches`
        : 'All queue items contain unresolved matches',
    details:
      withoutUnresolvedMatches.length > 0
        ? withoutUnresolvedMatches.map((row) => ({
            participantId: Number(row.event_participant_id),
            eventId: Number(row.event_id),
            player: `${row.game_name}#${row.tag_line}`,
            attempts: row.attempt_count,
          }))
        : undefined,
  });
  checks.push({
    code: 'RECONCILIATION_QUEUE_EVENT_STATE',
    status: invalidEventState.length > 0 ? 'warning' : 'ok',
    message:
      invalidEventState.length > 0
        ? `${invalidEventState.length} queue item(s) belong to a draft or scheduled event`
        : 'All queue items belong to active or ended events',
    details:
      invalidEventState.length > 0
        ? invalidEventState.map((row) => ({
            participantId: Number(row.event_participant_id),
            eventId: Number(row.event_id),
            event: row.event_name,
            status: row.event_status,
            player: `${row.game_name}#${row.tag_line}`,
          }))
        : undefined,
  });
  const missingQueueResult = await client.query<MissingQueueRow>(
    `
      SELECT
        ep.id AS event_participant_id,
        e.id AS event_id,
        e.name AS event_name,
        e.status AS event_status,
        p.id AS player_id,
        p.game_name,
        p.tag_line,
        COUNT(em.id)::TEXT AS unresolved_matches,
        (
          COUNT(em.id) FILTER (
            WHERE em.lp_delta_status = 'pending'
          )
        )::TEXT AS pending_matches,
        (
          COUNT(em.id) FILTER (
            WHERE em.lp_delta_status = 'unknown'
          )
        )::TEXT AS unknown_matches
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      JOIN players p
        ON p.id = ep.player_id
      JOIN event_matches em
        ON em.event_participant_id = ep.id
        AND em.lp_delta_status IN ('pending', 'unknown')
      WHERE
        e.status IN ('active', 'ended')
        AND NOT EXISTS (
          SELECT 1
          FROM lp_reconciliation_queue q
          WHERE q.event_participant_id = ep.id
        )
      GROUP BY
        ep.id,
        e.id,
        e.name,
        e.status,
        p.id,
        p.game_name,
        p.tag_line
      ORDER BY
        e.id,
        ep.id
    `,
  );
  checks.push({
    code: 'RECONCILIATION_QUEUE_COVERAGE',
    status: missingQueueResult.rows.length > 0 ? 'warning' : 'ok',
    message:
      missingQueueResult.rows.length > 0
        ? `${missingQueueResult.rows.length} participant(s) have unresolved matches without a queue entry`
        : 'All unresolved active/ended participants are represented in the queue',
    details:
      missingQueueResult.rows.length > 0
        ? missingQueueResult.rows.map((row) => ({
            participantId: Number(row.event_participant_id),
            eventId: Number(row.event_id),
            event: row.event_name,
            playerId: Number(row.player_id),
            player: `${row.game_name}#${row.tag_line}`,
            unresolved: Number(row.unresolved_matches),
            pending: Number(row.pending_matches),
            unknown: Number(row.unknown_matches),
          }))
        : undefined,
  });
  return {
    scope: 'queue',
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
