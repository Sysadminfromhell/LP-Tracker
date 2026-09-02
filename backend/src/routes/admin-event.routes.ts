import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/admin-auth';
import { getPlayers } from '../db/players';
import {
  cancelScheduledEvent,
  endAdminEvent,
  getAdminEventById,
  getAdminEvents,
  getEventParticipantPlayerIds,
  scheduleAdminEvent,
  updateAdminEventName,
  updateScheduledEvent,
} from '../db/admin-events';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { refreshPlayersForSnapshot } from '../services/player-refresh.service';
import { isOperationBusy, setRefreshInProgress } from '../runtime/operation-state';

function parseEventId(value: string): number | null {
  const eventId = Number(value);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return null;
  }
  return eventId;
}
export async function adminEventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/events', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const events = await getAdminEvents();
    return {
      events,
    };
  });
  app.get<{
    Params: {
      eventId: string;
    };
  }>('/api/admin/events/:eventId', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const eventId = parseEventId(request.params.eventId);
    if (eventId === null) {
      return reply.code(400).send({
        error: 'Invalid event ID',
      });
    }
    const event = await getAdminEventById(eventId);
    if (!event) {
      return reply.code(404).send({
        error: 'Event not found',
      });
    }
    return {
      event,
    };
  });
  app.patch<{
    Params: {
      eventId: string;
    };
    Body: {
      name?: string;
    };
  }>('/api/admin/events/:eventId/name', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const eventId = parseEventId(request.params.eventId);
    if (eventId === null) {
      return reply.code(400).send({
        error: 'Invalid event ID',
      });
    }
    const name = request.body.name?.trim();
    if (!name) {
      return reply.code(400).send({
        error: 'Event name is required',
      });
    }
    try {
      const event = await updateAdminEventName(eventId, name);
      if (!event) {
        return reply.code(404).send({
          error: 'Event not found',
        });
      }
      await loadLeaderboardFromDatabase();
      console.log(`[ADMIN] Event ${eventId} renamed to "${event.name}"`);
      return {
        ok: true,
        event,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ADMIN] Could not rename event ${eventId}: ${message}`);
      return reply.code(500).send({
        error: 'Could not update event',
      });
    }
  });
  app.patch<{
    Params: {
      eventId: string;
    };
    Body: {
      name?: string;
      startsAt?: string;
      endsAt?: string;
    };
  }>('/api/admin/events/:eventId', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const eventId = parseEventId(request.params.eventId);
    if (eventId === null) {
      return reply.code(400).send({
        error: 'Invalid event ID',
      });
    }
    const currentEvent = await getAdminEventById(eventId);
    if (!currentEvent) {
      return reply.code(404).send({
        error: 'Event not found',
      });
    }
    if (currentEvent.status !== 'draft') {
      return reply.code(409).send({
        error: 'Only scheduled events can be edited',
      });
    }
    const name = request.body.name?.trim();
    const startsAt = request.body.startsAt;
    const endsAt = request.body.endsAt;
    if (!name || !startsAt || !endsAt) {
      return reply.code(400).send({
        error: 'Event name, start and end are required',
      });
    }
    try {
      const event = await updateScheduledEvent(eventId, {
        name,
        startsAt,
        endsAt,
      });
      await loadLeaderboardFromDatabase();
      console.log(
        `[ADMIN] Scheduled event "${event.name}" updated: ` +
          `${event.startsAt} -> ${event.endsAt}`,
      );
      return {
        ok: true,
        event,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'SCHEDULED_EVENT_NOT_FOUND') {
        return reply.code(409).send({
          error: 'The event is no longer scheduled',
        });
      }
      if (message === 'INVALID_EVENT_DATE') {
        return reply.code(400).send({
          error: 'Invalid event date',
        });
      }
      if (message === 'EVENT_END_BEFORE_START') {
        return reply.code(400).send({
          error: 'Event end must be after event start',
        });
      }
      if (message === 'EVENT_SCHEDULE_CONFLICT') {
        return reply.code(409).send({
          error: 'Event overlaps another scheduled or active event',
        });
      }
      if (message === 'EVENT_START_IN_PAST') {
        return reply.code(400).send({
          error: 'Event start must be in the future',
        });
      }
      console.error(`[ADMIN] Could not update scheduled event ${eventId}: ${message}`);
      return reply.code(500).send({
        error: 'Could not update scheduled event',
      });
    }
  });
  app.delete<{
    Params: {
      eventId: string;
    };
  }>('/api/admin/events/:eventId', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const eventId = parseEventId(request.params.eventId);
    if (eventId === null) {
      return reply.code(400).send({
        error: 'Invalid event ID',
      });
    }
    const currentEvent = await getAdminEventById(eventId);
    if (!currentEvent) {
      return reply.code(404).send({
        error: 'Event not found',
      });
    }
    if (currentEvent.status !== 'draft') {
      return reply.code(409).send({
        error: 'Only scheduled events can be canceled',
      });
    }
    try {
      await cancelScheduledEvent(eventId);
      await loadLeaderboardFromDatabase();
      console.log(`[ADMIN] Scheduled event "${currentEvent.name}" canceled`);
      return {
        ok: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'SCHEDULED_EVENT_NOT_FOUND') {
        return reply.code(409).send({
          error: 'The event is no longer scheduled',
        });
      }
      console.error(`[ADMIN] Could not cancel scheduled event ${eventId}: ${message}`);
      return reply.code(500).send({
        error: 'Could not cancel scheduled event',
      });
    }
  });
  app.post<{
    Body: {
      name?: string;
      startsAt?: string;
      endsAt?: string;
    };
  }>('/api/admin/events', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const name = request.body.name?.trim();
    const startsAt = request.body.startsAt;
    const endsAt = request.body.endsAt;
    if (!name || !startsAt || !endsAt) {
      return reply.code(400).send({
        error: 'Event name, start and end are required',
      });
    }
    try {
      const event = await scheduleAdminEvent({
        name,
        startsAt,
        endsAt,
      });
      await loadLeaderboardFromDatabase();
      console.log(
        `[ADMIN] Event "${event.name}" scheduled from ${event.startsAt} to ${event.endsAt}`,
      );
      return reply.code(201).send({
        ok: true,
        event,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'EVENT_SCHEDULE_CONFLICT') {
        return reply.code(409).send({
          error: 'Event overlaps another scheduled or active event',
        });
      }
      if (message === 'EVENT_START_IN_PAST') {
        return reply.code(400).send({
          error: 'Event start must be in the future',
        });
      }
      if (message === 'INVALID_EVENT_DATE') {
        return reply.code(400).send({
          error: 'Invalid event date',
        });
      }
      if (message === 'EVENT_END_BEFORE_START') {
        return reply.code(400).send({
          error: 'Event end must be after event start',
        });
      }
      console.error(`[ADMIN] Could not schedule event: ${message}`);
      return reply.code(500).send({
        error: 'Could not schedule event',
      });
    }
  });
  app.post<{
    Params: {
      eventId: string;
    };
  }>('/api/admin/events/:eventId/end', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    const eventId = parseEventId(request.params.eventId);
    if (eventId === null) {
      return reply.code(400).send({
        error: 'Invalid event ID',
      });
    }
    const event = await getAdminEventById(eventId);
    if (!event) {
      return reply.code(404).send({
        error: 'Event not found',
      });
    }
    if (event.status !== 'active') {
      return reply.code(409).send({
        error: 'Only active events can be ended',
      });
    }
    if (isOperationBusy()) {
      return reply.code(409).send({
        error: 'A player refresh or event transition is currently in progress',
      });
    }
    setRefreshInProgress(true);
    try {
      const participantIds = new Set(await getEventParticipantPlayerIds(event.id));
      const allPlayers = await getPlayers(false);
      const eventPlayers = allPlayers.filter((player) => participantIds.has(player.id));
      if (eventPlayers.length !== participantIds.size) {
        return reply.code(409).send({
          error: 'Not every event participant could be loaded',
        });
      }
      console.log(
        `[ADMIN] Refreshing ${eventPlayers.length} participant(s) ` +
          `before ending "${event.name}"...`,
      );
      const failedPlayers = await refreshPlayersForSnapshot(eventPlayers);
      if (failedPlayers.length > 0) {
        console.error(
          `[ADMIN] Could not end "${event.name}": ` +
            `${failedPlayers.length} player refresh(es) failed`,
        );
        return reply.code(502).send({
          error: 'Could not refresh every participant before ending the event',
        });
      }
      const endedEvent = await endAdminEvent(event.id);
      await loadLeaderboardFromDatabase();
      console.log(
        `[ADMIN] Event "${endedEvent.name}" ended with ` +
          `${endedEvent.participantCount} participant(s)`,
      );
      return {
        ok: true,
        event: endedEvent,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'ACTIVE_EVENT_NOT_FOUND') {
        return reply.code(404).send({
          error: 'No active event found',
        });
      }
      if (message === 'EVENT_END_SNAPSHOT_INCOMPLETE') {
        return reply.code(409).send({
          error: 'Could not create a final snapshot for every participant',
        });
      }
      console.error(`[ADMIN] Could not end event: ${message}`);
      return reply.code(500).send({
        error: 'Could not end event',
      });
    } finally {
      setRefreshInProgress(false);
    }
  });
}
