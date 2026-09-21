import type { Pool } from 'pg';
import { db } from '../db/client';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';

type QueryClient = Pick<Pool, 'query'>;
type EventStatus = 'draft' | 'scheduled' | 'active' | 'ended';

interface LatestEventRow {
  id: string;
  name: string;
  status: EventStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  participant_count: string;
}
interface EventRow {
  id: string;
  name: string;
  status: EventStatus;
  starts_at: Date | null;
  ends_at: Date | null;
}
interface ParticipantRow {
  event_id: string;
  event_name: string;
  participant_id: string;
  player_id: string;
}
interface InvalidMatchRow {
  event_id: string;
  event_name: string;
  participant_id: string;
  provider_match_id: string;
  snapshot_captured_at: Date;
  game_created_at: Date;
  event_ends_at: Date | null;
}
interface MatchStatusRow {
  lp_delta_status: string;
  count: string;
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

export async function runEventDiagnostics(client: QueryClient = db): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];
  const latestEventResult = await client.query<LatestEventRow>(
    `
      SELECT
        e.id,
        e.name,
        e.status,
        e.starts_at,
        e.ends_at,
        COUNT(ep.id)::TEXT AS participant_count
      FROM events e
      LEFT JOIN event_participants ep
        ON ep.event_id = e.id
      GROUP BY e.id
      ORDER BY e.id DESC
      LIMIT 1
    `,
  );
  const latestEvent = latestEventResult.rows[0];
  if (!latestEvent) {
    checks.push({
      code: 'EVENTS_EMPTY',
      status: 'ok',
      message: 'No events exist yet.',
    });
    return {
      scope: 'event',
      generatedAt: new Date().toISOString(),
      status: 'ok',
      checks,
    };
  }
  checks.push({
    code: 'LATEST_EVENT',
    status: 'ok',
    message: `Latest event is "${latestEvent.name}"`,
    details: {
      id: Number(latestEvent.id),
      name: latestEvent.name,
      status: latestEvent.status,
      startsAt: latestEvent.starts_at?.toISOString() ?? null,
      endsAt: latestEvent.ends_at?.toISOString() ?? null,
      participants: Number(latestEvent.participant_count),
    },
  });
  const activeEventsResult = await client.query<EventRow>(
    `
      SELECT
        id,
        name,
        status,
        starts_at,
        ends_at
      FROM events
      WHERE status = 'active'
      ORDER BY id
    `,
  );
  checks.push({
    code: 'ACTIVE_EVENT_COUNT',
    status: activeEventsResult.rows.length > 1 ? 'error' : 'ok',
    message:
      activeEventsResult.rows.length > 1
        ? `${activeEventsResult.rows.length} active events exist at the same time`
        : 'At most one active event exists',
    details:
      activeEventsResult.rows.length > 1
        ? activeEventsResult.rows.map((event) => ({
            id: Number(event.id),
            name: event.name,
            status: event.status,
          }))
        : undefined,
  });
  const invalidWindowsResult = await client.query<EventRow>(
    `
      SELECT
        id,
        name,
        status,
        starts_at,
        ends_at
      FROM events
      WHERE
        (
          status IN ('scheduled', 'active', 'ended')
          AND starts_at IS NULL
        )
        OR (
          starts_at IS NOT NULL
          AND ends_at IS NOT NULL
          AND ends_at <= starts_at
        )
      ORDER BY id
    `,
  );
  checks.push({
    code: 'EVENT_TIME_WINDOWS',
    status: invalidWindowsResult.rows.length > 0 ? 'error' : 'ok',
    message:
      invalidWindowsResult.rows.length > 0
        ? `${invalidWindowsResult.rows.length} event(s) have an invalid time window`
        : 'All event time windows are valid',
    details:
      invalidWindowsResult.rows.length > 0
        ? invalidWindowsResult.rows.map((event) => ({
            id: Number(event.id),
            name: event.name,
            status: event.status,
            startsAt: event.starts_at?.toISOString() ?? null,
            endsAt: event.ends_at?.toISOString() ?? null,
          }))
        : undefined,
  });
  const incompleteStartSnapshots = await client.query<ParticipantRow>(
    `
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        ep.id AS participant_id,
        ep.player_id
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      WHERE
        e.status IN ('active', 'ended')
        AND (
          ep.start_tier IS NULL
          OR ep.start_lp IS NULL
          OR ep.start_rank_score IS NULL
          OR ep.start_wins IS NULL
          OR ep.start_losses IS NULL
          OR ep.snapshot_captured_at IS NULL
        )
      ORDER BY
        e.id,
        ep.player_id
    `,
  );
  checks.push({
    code: 'EVENT_START_SNAPSHOTS',
    status: incompleteStartSnapshots.rows.length > 0 ? 'error' : 'ok',
    message:
      incompleteStartSnapshots.rows.length > 0
        ? `${incompleteStartSnapshots.rows.length} participant(s) have an incomplete start snapshot`
        : 'All active/ended participants have complete start snapshots',
    details: incompleteStartSnapshots.rows.length > 0 ? incompleteStartSnapshots.rows : undefined,
  });
  const incompleteEndSnapshots = await client.query<ParticipantRow>(
    `
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        ep.id AS participant_id,
        ep.player_id
      FROM event_participants ep
      JOIN events e
        ON e.id = ep.event_id
      WHERE
        e.status = 'ended'
        AND (
          ep.end_tier IS NULL
          OR ep.end_lp IS NULL
          OR ep.end_rank_score IS NULL
          OR ep.end_wins IS NULL
          OR ep.end_losses IS NULL
          OR ep.ended_snapshot_at IS NULL
        )
      ORDER BY
        e.id,
        ep.player_id
    `,
  );
  checks.push({
    code: 'EVENT_END_SNAPSHOTS',
    status: incompleteEndSnapshots.rows.length > 0 ? 'error' : 'ok',
    message:
      incompleteEndSnapshots.rows.length > 0
        ? `${incompleteEndSnapshots.rows.length} participant(s) have an incomplete end snapshot`
        : 'All ended events have complete final snapshots',
    details: incompleteEndSnapshots.rows.length > 0 ? incompleteEndSnapshots.rows : undefined,
  });
  const invalidMatchesResult = await client.query<InvalidMatchRow>(
    `
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        ep.id AS participant_id,
        em.provider_match_id,
        ep.snapshot_captured_at,
        em.game_created_at,
        e.ends_at AS event_ends_at
      FROM event_matches em
      JOIN event_participants ep
        ON ep.id = em.event_participant_id
      JOIN events e
        ON e.id = ep.event_id
      WHERE
        em.game_created_at < ep.snapshot_captured_at
        OR (
          e.ends_at IS NOT NULL
          AND em.game_created_at > e.ends_at
        )
      ORDER BY
        e.id,
        em.game_created_at
    `,
  );
  checks.push({
    code: 'EVENT_MATCH_WINDOWS',
    status: invalidMatchesResult.rows.length > 0 ? 'error' : 'ok',
    message:
      invalidMatchesResult.rows.length > 0
        ? `${invalidMatchesResult.rows.length} event match(es) are outside their allowed time window`
        : 'No event matches exist outside their allowed time window',
    details:
      invalidMatchesResult.rows.length > 0
        ? invalidMatchesResult.rows.map((match) => ({
            eventId: Number(match.event_id),
            event: match.event_name,
            participantId: Number(match.participant_id),
            matchId: match.provider_match_id,
            participantStart: match.snapshot_captured_at.toISOString(),
            matchCreatedAt: match.game_created_at.toISOString(),
            eventEndsAt: match.event_ends_at?.toISOString() ?? null,
          }))
        : undefined,
  });
  const eventsWithoutParticipants = await client.query<EventRow>(
    `
      SELECT
        e.id,
        e.name,
        e.status,
        e.starts_at,
        e.ends_at
      FROM events e
      WHERE
        e.status IN ('active', 'ended')
        AND NOT EXISTS (
          SELECT 1
          FROM event_participants ep
          WHERE ep.event_id = e.id
        )
      ORDER BY e.id
    `,
  );
  checks.push({
    code: 'EVENT_PARTICIPANTS',
    status: eventsWithoutParticipants.rows.length > 0 ? 'error' : 'ok',
    message:
      eventsWithoutParticipants.rows.length > 0
        ? `${eventsWithoutParticipants.rows.length} active/ended event(s) have no participants`
        : 'All active/ended events contain participants',
    details:
      eventsWithoutParticipants.rows.length > 0
        ? eventsWithoutParticipants.rows.map((event) => ({
            id: Number(event.id),
            name: event.name,
            status: event.status,
          }))
        : undefined,
  });
  const matchStatusResult = await client.query<MatchStatusRow>(
    `
      SELECT
        em.lp_delta_status,
        COUNT(*)::TEXT AS count
      FROM event_matches em
      JOIN event_participants ep
        ON ep.id = em.event_participant_id
      WHERE ep.event_id = $1
      GROUP BY em.lp_delta_status
      ORDER BY em.lp_delta_status
    `,
    [Number(latestEvent.id)],
  );
  checks.push({
    code: 'EVENT_MATCH_STATES',
    status: 'ok',
    message:
      matchStatusResult.rows.length === 0
        ? 'Latest event has no recorded matches'
        : 'Latest event match states collected',
    details: matchStatusResult.rows.map((row) => ({
      status: row.lp_delta_status,
      matches: Number(row.count),
    })),
  });
  return {
    scope: 'event',
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
