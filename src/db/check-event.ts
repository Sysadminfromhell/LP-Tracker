import { closeDatabase, db } from './client';

type EventStatus = 'draft' | 'active' | 'ended';

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
  opgg_match_id: string;
  snapshot_captured_at: Date;
  game_created_at: Date;
  event_ends_at: Date | null;
}

interface MatchStatusRow {
  lp_delta_status: string;
  count: string;
}

function printOk(message: string): void {
  console.log(`[OK] ${message}`);
}
function printFailure(message: string): void {
  console.error(`[FAIL] ${message}`);
}
async function main(): Promise<void> {
  console.log();
  console.log('LP Tracker Event Integrity Check');
  console.log('================================');
  console.log();
  let failed = false;
  const latestEventResult = await db.query<LatestEventRow>(
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
    console.log('[INFO] No events exist yet.');
    return;
  }
  console.log('Latest event');
  console.table([
    {
      id: latestEvent.id,
      name: latestEvent.name,
      status: latestEvent.status,
      startsAt: latestEvent.starts_at?.toISOString() ?? null,
      endsAt: latestEvent.ends_at?.toISOString() ?? null,
      participants: Number(latestEvent.participant_count),
    },
  ]);
  const openEventsResult = await db.query<EventRow>(
    `
    SELECT
      id,
      name,
      status,
      starts_at,
      ends_at
    FROM events
    WHERE status IN ('draft', 'active')
    ORDER BY id
    `,
  );
  if (openEventsResult.rows.length > 1) {
    failed = true;
    printFailure(`${openEventsResult.rows.length} draft/active events exist at the same time`);
    console.table(
      openEventsResult.rows.map((event) => ({
        id: event.id,
        name: event.name,
        status: event.status,
      })),
    );
  } else {
    printOk('At most one draft/active event exists');
  }
  const invalidWindowsResult = await db.query<EventRow>(
    `
    SELECT
      id,
      name,
      status,
      starts_at,
      ends_at
    FROM events
    WHERE
      starts_at IS NULL
      OR (
        ends_at IS NOT NULL
        AND ends_at <= starts_at
      )
    ORDER BY id
    `,
  );
  if (invalidWindowsResult.rows.length > 0) {
    failed = true;
    printFailure(`${invalidWindowsResult.rows.length} event(s) have an invalid time window`);
    console.table(
      invalidWindowsResult.rows.map((event) => ({
        id: event.id,
        name: event.name,
        status: event.status,
        startsAt: event.starts_at?.toISOString() ?? null,
        endsAt: event.ends_at?.toISOString() ?? null,
      })),
    );
  } else {
    printOk('All event time windows are valid');
  }
  const incompleteStartSnapshots = await db.query<ParticipantRow>(
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
  if (incompleteStartSnapshots.rows.length > 0) {
    failed = true;
    printFailure(
      `${incompleteStartSnapshots.rows.length} participant(s) have an incomplete start snapshot`,
    );
    console.table(incompleteStartSnapshots.rows);
  } else {
    printOk('All active/ended participants have complete start snapshots');
  }
  const incompleteEndSnapshots = await db.query<ParticipantRow>(
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
  if (incompleteEndSnapshots.rows.length > 0) {
    failed = true;
    printFailure(
      `${incompleteEndSnapshots.rows.length} participant(s) have an incomplete end snapshot`,
    );
    console.table(incompleteEndSnapshots.rows);
  } else {
    printOk('All ended events have complete final snapshots');
  }
  const invalidMatchesResult = await db.query<InvalidMatchRow>(
    `
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        ep.id AS participant_id,
        em.opgg_match_id,
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
  if (invalidMatchesResult.rows.length > 0) {
    failed = true;
    printFailure(
      `${invalidMatchesResult.rows.length} event match(es) are outside their allowed time window`,
    );
    console.table(
      invalidMatchesResult.rows.map((match) => ({
        eventId: match.event_id,
        event: match.event_name,
        participantId: match.participant_id,
        matchId: match.opgg_match_id,
        participantStart: match.snapshot_captured_at.toISOString(),
        matchCreatedAt: match.game_created_at.toISOString(),
        eventEndsAt: match.event_ends_at?.toISOString() ?? null,
      })),
    );
  } else {
    printOk('No event matches exist outside their allowed time window');
  }
  const eventsWithoutParticipants = await db.query<EventRow>(
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
  if (eventsWithoutParticipants.rows.length > 0) {
    failed = true;
    printFailure(
      `${eventsWithoutParticipants.rows.length} active/ended event(s) have no participants`,
    );
    console.table(eventsWithoutParticipants.rows);
  } else {
    printOk('All active/ended events contain participants');
  }
  const matchStatusResult = await db.query<MatchStatusRow>(
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
  console.log();
  console.log('Latest event match states');
  if (matchStatusResult.rows.length === 0) {
    console.log('[INFO] No matches recorded for this event.');
  } else {
    console.table(
      matchStatusResult.rows.map((row) => ({
        status: row.lp_delta_status,
        matches: Number(row.count),
      })),
    );
  }
  console.log();
  if (failed) {
    printFailure('Event integrity check failed');
    process.exitCode = 1;
    return;
  }
  printOk('Event integrity looks good');
}
main()
  .catch((error) => {
    console.error();
    console.error('[CHECK] Event integrity check crashed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
