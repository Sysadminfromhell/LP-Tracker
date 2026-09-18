import type { FastifyInstance } from 'fastify';
import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { errorResponseSchema, okResponseSchema } from './schemas/common.schemas';
import {
  adminEventDetailsResponseSchema,
  adminEventResponseSchema,
  adminEventsResponseSchema,
  eventNameBodySchema,
  eventParticipantPenaltiesResponseSchema,
  eventParticipantPenaltyResponseSchema,
  eventPenaltyBodySchema,
  eventScheduleBodySchema,
} from './schemas/event.schemas';
import { eventIdParamsSchema, eventPlayerIdParamsSchema } from './schemas/id.schemas';
import { requireAdmin } from '../auth/admin-auth';
import { getPlayers } from '../db/players';
import { getEventParticipantPenalties, setEventParticipantPenalty } from '../db/event-penalties';
import {
  cancelScheduledEvent,
  endAdminEvent,
  getAdminEventById,
  getAdminEvents,
  getEventParticipantPlayerIds,
  getEventSelectedPlayerIds,
  scheduleAdminEvent,
  updateAdminEventName,
  updateScheduledEvent,
} from '../db/admin-events';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { refreshPlayersForSnapshot } from '../services/player-refresh.service';
import { jobCoordinator } from '../runtime/job-coordinator';

function parseEventId(value: string): number | null {
  const eventId = Number(value);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return null;
  }
  return eventId;
}
function parsePlayerId(value: string): number | null {
  const playerId = Number(value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return null;
  }
  return playerId;
}

export async function adminEventRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<JsonSchemaToTsProvider>();
  typedApp.get(
    '/api/admin/events',
    {
      schema: {
        response: {
          200: adminEventsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const events = await getAdminEvents();
      return {
        events,
      };
    },
  );
  typedApp.get(
    '/api/admin/events/:eventId/penalties',
    {
      schema: {
        params: eventIdParamsSchema,
        response: {
          200: eventParticipantPenaltiesResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
      const participants = await getEventParticipantPenalties(eventId);
      return {
        participants,
      };
    },
  );
  typedApp.get(
    '/api/admin/events/:eventId',
    {
      schema: {
        params: eventIdParamsSchema,
        response: {
          200: adminEventDetailsResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
      const selectedPlayerIds =
        event.status === 'scheduled' ? await getEventSelectedPlayerIds(eventId) : [];
      return {
        event,
        selectedPlayerIds,
      };
    },
  );
  typedApp.patch(
    '/api/admin/events/:eventId/participants/:playerId/penalty',
    {
      schema: {
        params: eventPlayerIdParamsSchema,
        body: eventPenaltyBodySchema,
        response: {
          200: eventParticipantPenaltyResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const eventId = parseEventId(request.params.eventId);
      const playerId = parsePlayerId(request.params.playerId);
      if (eventId === null) {
        return reply.code(400).send({
          error: 'Invalid event ID',
        });
      }
      if (playerId === null) {
        return reply.code(400).send({
          error: 'Invalid player ID',
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
          error: 'Penalties can only be changed during an active event',
        });
      }
      const lpPenalty = request.body.lpPenalty;
      if (!Number.isSafeInteger(lpPenalty) || (lpPenalty ?? -1) < 0) {
        return reply.code(400).send({
          error: 'LP penalty must be a non-negative integer',
        });
      }
      try {
        const participant = await setEventParticipantPenalty({
          eventId,
          playerId,
          lpPenalty: lpPenalty as number,
          reason: request.body.reason ?? null,
        });
        await loadLeaderboardFromDatabase();
        console.log(
          `[ADMIN] LP penalty for player ${playerId} in event ${eventId} ` +
            `set to ${participant.lpPenalty}`,
        );
        return {
          ok: true,
          participant,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'PENALTY_REASON_REQUIRED') {
          return reply.code(400).send({
            error: 'A reason is required for an LP penalty',
          });
        }
        if (message === 'INVALID_LP_PENALTY') {
          return reply.code(400).send({
            error: 'LP penalty must be a non-negative integer',
          });
        }
        if (message === 'ACTIVE_EVENT_PARTICIPANT_NOT_FOUND') {
          return reply.code(404).send({
            error: 'Player is not a participant of the active event',
          });
        }
        console.error(
          `[ADMIN] Could not update LP penalty for player ${playerId} ` +
            `in event ${eventId}: ${message}`,
        );
        return reply.code(500).send({
          error: 'Could not update LP penalty',
        });
      }
    },
  );
  typedApp.patch(
    '/api/admin/events/:eventId/name',
    {
      schema: {
        params: eventIdParamsSchema,
        body: eventNameBodySchema,
        response: {
          200: adminEventResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
    },
  );
  typedApp.patch(
    '/api/admin/events/:eventId',
    {
      schema: {
        params: eventIdParamsSchema,
        body: eventScheduleBodySchema,
        response: {
          200: adminEventResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
      if (currentEvent.status !== 'scheduled') {
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
          playerIds: request.body.playerIds,
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
        if (message === 'NO_EVENT_PARTICIPANTS_SELECTED') {
          return reply.code(400).send({
            error: 'At least one event participant must be selected',
          });
        }
        if (message === 'INVALID_EVENT_PARTICIPANT_ID') {
          return reply.code(400).send({
            error: 'Invalid event participant',
          });
        }
        if (message === 'EVENT_PARTICIPANT_NOT_AVAILABLE') {
          return reply.code(409).send({
            error: 'One or more selected participants are not available',
          });
        }
        console.error(`[ADMIN] Could not update scheduled event ${eventId}: ${message}`);
        return reply.code(500).send({
          error: 'Could not update scheduled event',
        });
      }
    },
  );
  typedApp.delete(
    '/api/admin/events/:eventId',
    {
      schema: {
        params: eventIdParamsSchema,
        response: {
          200: okResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
      if (currentEvent.status !== 'scheduled') {
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
    },
  );
  typedApp.post(
    '/api/admin/events',
    {
      schema: {
        body: eventScheduleBodySchema,
        response: {
          201: adminEventResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
          playerIds: request.body.playerIds,
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
        if (message === 'NO_EVENT_PARTICIPANTS_SELECTED') {
          return reply.code(400).send({
            error: 'At least one event participant must be selected',
          });
        }
        if (message === 'INVALID_EVENT_PARTICIPANT_ID') {
          return reply.code(400).send({
            error: 'Invalid event participant',
          });
        }
        if (message === 'EVENT_PARTICIPANT_NOT_AVAILABLE') {
          return reply.code(409).send({
            error: 'One or more selected participants are not available',
          });
        }
        console.error(`[ADMIN] Could not schedule event: ${message}`);
        return reply.code(500).send({
          error: 'Could not schedule event',
        });
      }
    },
  );
  typedApp.post(
    '/api/admin/events/:eventId/end',
    {
      schema: {
        params: eventIdParamsSchema,
        response: {
          200: adminEventResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
      const releaseTransitionLock = jobCoordinator.tryAcquireLock('event-transition');
      if (!releaseTransitionLock) {
        return reply.code(409).send({
          error: 'An event transition is currently in progress',
        });
      }
      try {
        return await jobCoordinator.enqueue(
          {
            type: 'event-end',
          },
          async () => {
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
          },
        );
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
        releaseTransitionLock();
      }
    },
  );
}
