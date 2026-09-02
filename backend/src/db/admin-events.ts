import { db } from './client';

export type AdminEventStatus = 'draft' | 'active' | 'ended';
export interface AdminEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  status: AdminEventStatus;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}
interface AdminEventRow {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date | null;
  status: AdminEventStatus;
  participant_count: string;
  created_at: Date;
  updated_at: Date;
}
export interface ScheduleAdminEventInput {
  name: string;
  startsAt: string;
  endsAt: string;
}
function isEventScheduleConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23P01' &&
    'constraint' in error &&
    error.constraint === 'events_open_time_no_overlap'
  );
}
export async function scheduleAdminEvent(input: ScheduleAdminEventInput): Promise<AdminEvent> {
  const name = input.name.trim();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!name) {
    throw new Error('EVENT_NAME_REQUIRED');
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('INVALID_EVENT_DATE');
  }
  if (endsAt <= startsAt) {
    throw new Error('EVENT_END_BEFORE_START');
  }
  if (startsAt.getTime() < Date.now()) {
    throw new Error('EVENT_START_IN_PAST');
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{
      id: string;
    }>(
      `
      INSERT INTO events (
        name,
        starts_at,
        ends_at,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        'draft'
      )
      RETURNING id
      `,
      [name, startsAt, endsAt],
    );
    await client.query('COMMIT');
    const eventId = Number(result.rows[0].id);
    const event = await getAdminEventById(eventId);
    if (!event || event.id !== eventId) {
      throw new Error('EVENT_NOT_FOUND_AFTER_SCHEDULE');
    }
    return event;
  } catch (error) {
    await client.query('ROLLBACK');
    if (isEventScheduleConflict(error)) {
      throw new Error('EVENT_SCHEDULE_CONFLICT');
    }
    throw error;
  } finally {
    client.release();
  }
}
export async function updateScheduledEvent(
  eventId: number,
  input: ScheduleAdminEventInput,
): Promise<AdminEvent> {
  const name = input.name.trim();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!name) {
    throw new Error('EVENT_NAME_REQUIRED');
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('INVALID_EVENT_DATE');
  }
  if (endsAt <= startsAt) {
    throw new Error('EVENT_END_BEFORE_START');
  }
  if (startsAt.getTime() < Date.now()) {
    throw new Error('EVENT_START_IN_PAST');
  }
  try {
    const result = await db.query<{
      id: string;
    }>(
      `
    UPDATE events
    SET
      name = $2,
      starts_at = $3,
      ends_at = $4,
      updated_at = NOW()
    WHERE
      id = $1
      AND status = 'draft'
    RETURNING id
    `,
      [eventId, name, startsAt, endsAt],
    );
    if (result.rows.length === 0) {
      throw new Error('SCHEDULED_EVENT_NOT_FOUND');
    }
    const event = await getAdminEventById(eventId);
    if (!event || event.id !== eventId) {
      throw new Error('EVENT_NOT_FOUND_AFTER_UPDATE');
    }
    return event;
  } catch (error) {
    if (isEventScheduleConflict(error)) {
      throw new Error('EVENT_SCHEDULE_CONFLICT');
    }
    throw error;
  }
}
export async function cancelScheduledEvent(eventId: number): Promise<void> {
  const result = await db.query<{
    id: string;
  }>(
    `
    DELETE FROM events
    WHERE
      id = $1
      AND status = 'draft'
    RETURNING id
    `,
    [eventId],
  );
  if (result.rows.length === 0) {
    throw new Error('SCHEDULED_EVENT_NOT_FOUND');
  }
}
function mapAdminEvent(row: AdminEventRow): AdminEvent {
  return {
    id: Number(row.id),
    name: row.name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    status: row.status,
    participantCount: Number(row.participant_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export async function getAdminEvents(): Promise<AdminEvent[]> {
  const result = await db.query<AdminEventRow>(
    `
    SELECT
      e.id,
      e.name,
      e.starts_at,
      e.ends_at,
      e.status,
      e.created_at,
      e.updated_at,
      COUNT(ep.id)::TEXT AS participant_count
    FROM events e
    LEFT JOIN event_participants ep
      ON ep.event_id = e.id
    GROUP BY e.id
    ORDER BY
      CASE
        WHEN e.status = 'active' THEN 0
        WHEN e.status = 'draft' THEN 1
        ELSE 2
      END,
      e.starts_at ASC,
      e.id ASC
    `,
  );

  return result.rows.map(mapAdminEvent);
}
export async function getAdminEventById(eventId: number): Promise<AdminEvent | null> {
  const result = await db.query<AdminEventRow>(
    `
    SELECT
      e.id,
      e.name,
      e.starts_at,
      e.ends_at,
      e.status,
      e.created_at,
      e.updated_at,
      COUNT(ep.id)::TEXT AS participant_count
    FROM events e
    LEFT JOIN event_participants ep
      ON ep.event_id = e.id
    WHERE e.id = $1
    GROUP BY e.id
    LIMIT 1
    `,
    [eventId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapAdminEvent(result.rows[0]);
}
export async function updateAdminEventName(
  eventId: number,
  name: string,
): Promise<AdminEvent | null> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('EVENT_NAME_REQUIRED');
  }
  const result = await db.query(
    `
    UPDATE events
    SET
      name = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [eventId, trimmedName],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return getAdminEventById(eventId);
}
export async function endAdminEvent(
  eventId: number,
  scheduledEndsAt: string | null = null,
): Promise<AdminEvent> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query<{
      id: string;
    }>(
      `
      SELECT id
      FROM events
      WHERE
        id = $1
        AND status = 'active'
      LIMIT 1
      FOR UPDATE
      `,
      [eventId],
    );
    if (eventResult.rows.length === 0) {
      throw new Error('ACTIVE_EVENT_NOT_FOUND');
    }
    const participantCountResult = await client.query<{
      participant_count: string;
    }>(
      `
      SELECT COUNT(*)::TEXT AS participant_count
      FROM event_participants
      WHERE event_id = $1
      `,
      [eventId],
    );
    const participantCount = Number(participantCountResult.rows[0].participant_count);
    const snapshotResult = await client.query(
      `
      UPDATE event_participants ep
      SET
        end_tier = pc.tier,
        end_division = pc.division,
        end_lp = pc.lp,
        end_rank_score = pc.rank_score,
        end_wins = pc.season_wins,
        end_losses = pc.season_losses,
        ended_snapshot_at = NOW(),
        updated_at = NOW()
      FROM player_cache pc
      WHERE
        ep.event_id = $1
        AND pc.player_id = ep.player_id
        AND pc.tier IS NOT NULL
        AND pc.lp IS NOT NULL
        AND pc.rank_score IS NOT NULL
        AND pc.season_wins IS NOT NULL
        AND pc.season_losses IS NOT NULL
      `,
      [eventId],
    );
    if (snapshotResult.rowCount !== participantCount) {
      throw new Error('EVENT_END_SNAPSHOT_INCOMPLETE');
    }
    await client.query(
      `
      UPDATE events
      SET
      ends_at = COALESCE($2::TIMESTAMPTZ, NOW()),
      status = 'ended',
      updated_at = NOW()
      WHERE id = $1
      `,
      [eventId, scheduledEndsAt],
    );
    await client.query('COMMIT');
    const event = await getAdminEventById(eventId);
    if (!event || event.id !== eventId) {
      throw new Error('EVENT_NOT_FOUND_AFTER_END');
    }
    return event;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function getDueScheduledEvent(): Promise<AdminEvent | null> {
  const result = await db.query<AdminEventRow>(
    `
    SELECT
      e.id,
      e.name,
      e.starts_at,
      e.ends_at,
      e.status,
      e.created_at,
      e.updated_at,
      COUNT(ep.id)::TEXT AS participant_count
    FROM events e
    LEFT JOIN event_participants ep
      ON ep.event_id = e.id
    WHERE
      id = $1
      AND status = 'draft'
      AND starts_at <= NOW()
      AND ends_at > NOW()
    GROUP BY e.id
    ORDER BY e.starts_at ASC
    LIMIT 1
    `,
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapAdminEvent(result.rows[0]);
}
export async function getEventParticipantPlayerIds(eventId: number): Promise<number[]> {
  const result = await db.query<{
    player_id: string;
  }>(
    `
    SELECT player_id
    FROM event_participants
    WHERE event_id = $1
    ORDER BY player_id
    `,
    [eventId],
  );
  return result.rows.map((row) => Number(row.player_id));
}
export async function activateScheduledEvent(eventId: number): Promise<AdminEvent> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query(
      `
      SELECT id
      FROM events
      WHERE
        id = $1
        AND status = 'draft'
        AND starts_at <= NOW()
        AND ends_at > NOW()
      LIMIT 1
      FOR UPDATE
      `,
      [eventId],
    );
    if (eventResult.rows.length === 0) {
      throw new Error('SCHEDULED_EVENT_NOT_READY');
    }
    const activeEventResult = await client.query(
      `
      SELECT id
      FROM events
      WHERE status = 'active'
      LIMIT 1
      FOR UPDATE
      `,
    );
    if (activeEventResult.rows.length > 0) {
      throw new Error('ACTIVE_EVENT_ALREADY_EXISTS');
    }
    const enabledPlayersResult = await client.query<{
      player_count: string;
    }>(
      `
      SELECT COUNT(*)::TEXT AS player_count
      FROM players
      WHERE enabled = TRUE
      `,
    );
    const enabledPlayerCount = Number(enabledPlayersResult.rows[0].player_count);
    if (enabledPlayerCount === 0) {
      throw new Error('NO_ENABLED_PLAYERS');
    }
    const snapshotPlayersResult = await client.query<{
      player_count: string;
    }>(
      `
      SELECT COUNT(*)::TEXT AS player_count
      FROM players p
      JOIN player_cache pc
        ON pc.player_id = p.id
      WHERE
        p.enabled = TRUE
        AND pc.tier IS NOT NULL
        AND pc.lp IS NOT NULL
        AND pc.rank_score IS NOT NULL
        AND pc.season_wins IS NOT NULL
        AND pc.season_losses IS NOT NULL
      `,
    );
    const snapshotPlayerCount = Number(snapshotPlayersResult.rows[0].player_count);
    if (snapshotPlayerCount !== enabledPlayerCount) {
      throw new Error('PLAYER_CACHE_INCOMPLETE');
    }
    const participantResult = await client.query(
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
        p.enabled = TRUE
        AND pc.tier IS NOT NULL
        AND pc.lp IS NOT NULL
        AND pc.rank_score IS NOT NULL
        AND pc.season_wins IS NOT NULL
        AND pc.season_losses IS NOT NULL
      `,
      [eventId],
    );
    if (participantResult.rowCount !== enabledPlayerCount) {
      throw new Error('EVENT_PARTICIPANT_SNAPSHOT_FAILED');
    }
    await client.query(
      `
      UPDATE events
      SET
        status = 'active',
        updated_at = NOW()
      WHERE id = $1
      `,
      [eventId],
    );
    await client.query('COMMIT');
    const event = await getAdminEventById(eventId);
    if (!event || event.id !== eventId) {
      throw new Error('EVENT_NOT_FOUND_AFTER_ACTIVATION');
    }
    return event;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
