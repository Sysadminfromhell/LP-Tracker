import type { Pool } from 'pg';
import type { AdminDatabaseDeleteEndedEventResponse } from '@lp-tracker/contracts';
import { db } from './client';

type DatabasePool = Pick<Pool, 'connect'>;

interface EventRow {
  id: string;
  name: string;
  status: string;
}

export async function deleteAdminDatabaseEndedEvent(
  eventId: number,
  pool: DatabasePool = db,
): Promise<AdminDatabaseDeleteEndedEventResponse> {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new Error('INVALID_EVENT_ID');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query<EventRow>(
      `
        SELECT
          id,
          name,
          status
        FROM "public"."events"
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [eventId],
    );
    const event = eventResult.rows[0];
    if (!event) {
      throw new Error('EVENT_NOT_FOUND');
    }
    if (event.status !== 'ended') {
      throw new Error('EVENT_NOT_ENDED');
    }
    const deleteResult = await client.query(
      `
        DELETE FROM "public"."events"
        WHERE
          id = $1
          AND status = 'ended'
      `,
      [eventId],
    );
    if (deleteResult.rowCount !== 1) {
      throw new Error('EVENT_DELETE_FAILED');
    }
    await client.query('COMMIT');
    return {
      eventId,
      eventName: event.name,
      deletedAt: new Date().toISOString(),
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[ADMIN DATABASE] Ended event delete rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
