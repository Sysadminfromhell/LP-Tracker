import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { AdminEvent } from '../src/db/admin-events';
import type { Player } from '../src/db/players';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getPlayers: vi.fn(),
  cancelScheduledEvent: vi.fn(),
  endAdminEvent: vi.fn(),
  getAdminEventById: vi.fn(),
  getAdminEvents: vi.fn(),
  getEventParticipantPlayerIds: vi.fn(),
  scheduleAdminEvent: vi.fn(),
  updateAdminEventName: vi.fn(),
  updateScheduledEvent: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  refreshPlayersForSnapshot: vi.fn(),
  isOperationBusy: vi.fn(),
  setRefreshInProgress: vi.fn(),
}));

vi.mock('../src/auth/admin-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/db/admin-events', () => ({
  cancelScheduledEvent: mocks.cancelScheduledEvent,
  endAdminEvent: mocks.endAdminEvent,
  getAdminEventById: mocks.getAdminEventById,
  getAdminEvents: mocks.getAdminEvents,
  getEventParticipantPlayerIds: mocks.getEventParticipantPlayerIds,
  scheduleAdminEvent: mocks.scheduleAdminEvent,
  updateAdminEventName: mocks.updateAdminEventName,
  updateScheduledEvent: mocks.updateScheduledEvent,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/services/player-refresh.service', () => ({
  refreshPlayersForSnapshot: mocks.refreshPlayersForSnapshot,
}));
vi.mock('../src/runtime/operation-state', () => ({
  isOperationBusy: mocks.isOperationBusy,

  setRefreshInProgress: mocks.setRefreshInProgress,
}));

import { adminEventRoutes } from '../src/routes/admin-event.routes';

const draftEvent: AdminEvent = {
  id: 1,
  name: 'September Event',
  startsAt: '2026-09-05T18:00:00.000Z',
  endsAt: '2026-09-10T18:00:00.000Z',
  status: 'draft',
  participantCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const activeEvent: AdminEvent = {
  ...draftEvent,
  id: 2,
  name: 'Active Event',
  startsAt: '2026-09-01T18:00:00.000Z',
  status: 'active',
  participantCount: 2,
};
const endedEvent: AdminEvent = {
  ...activeEvent,
  status: 'ended',
  participantCount: 2,
  updatedAt: '2026-09-02T20:00:00.000Z',
};
const firstPlayer: Player = {
  id: 10,
  gameName: 'Alpha',
  tagLine: 'EUW',
  region: 'EUW',
  twitchUsername: null,
  twitterUsername: null,
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const secondPlayer: Player = {
  ...firstPlayer,
  id: 11,
  gameName: 'Bravo',
};

async function createTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(adminEventRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: 1,
    username: 'admin',
  });
  mocks.getAdminEvents.mockResolvedValue([draftEvent, activeEvent]);
  mocks.getAdminEventById.mockResolvedValue(draftEvent);
  mocks.scheduleAdminEvent.mockResolvedValue(draftEvent);
  mocks.updateAdminEventName.mockResolvedValue(draftEvent);
  mocks.updateScheduledEvent.mockResolvedValue(draftEvent);
  mocks.cancelScheduledEvent.mockResolvedValue(undefined);
  mocks.getEventParticipantPlayerIds.mockResolvedValue([firstPlayer.id, secondPlayer.id]);
  mocks.getPlayers.mockResolvedValue([firstPlayer, secondPlayer]);
  mocks.refreshPlayersForSnapshot.mockResolvedValue([]);
  mocks.endAdminEvent.mockResolvedValue(endedEvent);
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  mocks.isOperationBusy.mockReturnValue(false);
});

describe('admin event routes', () => {
  it('returns all admin events', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/events',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        events: [draftEvent, activeEvent],
      });
    } finally {
      await app.close();
    }
  });
  it('rejects invalid event IDs', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/events/nope',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Invalid event ID',
      });
      expect(mocks.getAdminEventById).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('returns 404 for an unknown event', async () => {
    mocks.getAdminEventById.mockResolvedValue(null);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/events/999',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: 'Event not found',
      });
    } finally {
      await app.close();
    }
  });
  it('renames an event and reloads the leaderboard', async () => {
    const renamedEvent = {
      ...draftEvent,
      name: 'Renamed Event',
    };
    mocks.updateAdminEventName.mockResolvedValue(renamedEvent);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/events/1/name',
        payload: {
          name: '  Renamed Event  ',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.updateAdminEventName).toHaveBeenCalledWith(1, 'Renamed Event');
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(response.json()).toEqual({
        ok: true,
        event: renamedEvent,
      });
    } finally {
      await app.close();
    }
  });
  it('allows editing only draft events', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/events/2',
        payload: {
          name: 'Changed',
          startsAt: '2026-09-06T18:00:00.000Z',
          endsAt: '2026-09-08T18:00:00.000Z',
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'Only scheduled events can be edited',
      });
      expect(mocks.updateScheduledEvent).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('updates a scheduled event', async () => {
    const updated = {
      ...draftEvent,
      name: 'Updated Event',
      startsAt: '2026-09-06T18:00:00.000Z',
      endsAt: '2026-09-09T18:00:00.000Z',
    };
    mocks.updateScheduledEvent.mockResolvedValue(updated);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/events/1',
        payload: {
          name: '  Updated Event  ',
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.updateScheduledEvent).toHaveBeenCalledWith(1, {
        name: 'Updated Event',
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
      });
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
  it.each([
    ['INVALID_EVENT_DATE', 400, 'Invalid event date'],
    ['EVENT_END_BEFORE_START', 400, 'Event end must be after event start'],
    ['EVENT_START_IN_PAST', 400, 'Event start must be in the future'],
    ['EVENT_SCHEDULE_CONFLICT', 409, 'Event overlaps another scheduled or active event'],
    ['SCHEDULED_EVENT_NOT_FOUND', 409, 'The event is no longer scheduled'],
  ])('maps scheduled-event update error %s', async (errorCode, expectedStatus, expectedMessage) => {
    mocks.updateScheduledEvent.mockRejectedValue(new Error(errorCode));
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/events/1',
        payload: {
          name: 'Event',
          startsAt: '2026-09-06T18:00:00.000Z',
          endsAt: '2026-09-08T18:00:00.000Z',
        },
      });
      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toEqual({
        error: expectedMessage,
      });
    } finally {
      await app.close();
    }
  });
  it('allows canceling only draft events', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/events/2',
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'Only scheduled events can be canceled',
      });
      expect(mocks.cancelScheduledEvent).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('cancels a scheduled event', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/events/1',
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.cancelScheduledEvent).toHaveBeenCalledWith(1);
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
  it('schedules a new event', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events',
        payload: {
          name: '  September Event  ',
          startsAt: draftEvent.startsAt,
          endsAt: draftEvent.endsAt,
        },
      });
      expect(response.statusCode).toBe(201);
      expect(mocks.scheduleAdminEvent).toHaveBeenCalledWith({
        name: 'September Event',
        startsAt: draftEvent.startsAt,
        endsAt: draftEvent.endsAt,
      });
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(response.json()).toEqual({
        ok: true,
        event: draftEvent,
      });
    } finally {
      await app.close();
    }
  });
  it.each([
    ['EVENT_SCHEDULE_CONFLICT', 409, 'Event overlaps another scheduled or active event'],
    ['EVENT_START_IN_PAST', 400, 'Event start must be in the future'],
    ['INVALID_EVENT_DATE', 400, 'Invalid event date'],
    ['EVENT_END_BEFORE_START', 400, 'Event end must be after event start'],
  ])('maps schedule error %s', async (errorCode, expectedStatus, expectedMessage) => {
    mocks.scheduleAdminEvent.mockRejectedValue(new Error(errorCode));
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events',
        payload: {
          name: 'Event',
          startsAt: '2026-09-06T18:00:00.000Z',
          endsAt: '2026-09-08T18:00:00.000Z',
        },
      });
      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toEqual({
        error: expectedMessage,
      });
    } finally {
      await app.close();
    }
  });
  it('allows only active events to be ended', async () => {
    mocks.getAdminEventById.mockResolvedValue(draftEvent);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events/1/end',
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'Only active events can be ended',
      });
      expect(mocks.setRefreshInProgress).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects ending an event while another operation is running', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    mocks.isOperationBusy.mockReturnValue(true);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events/2/end',
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'A player refresh or event transition is currently in progress',
      });
      expect(mocks.setRefreshInProgress).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects ending an event when not every participant can be loaded', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    mocks.getEventParticipantPlayerIds.mockResolvedValue([10, 11]);
    mocks.getPlayers.mockResolvedValue([firstPlayer]);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events/2/end',
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'Not every event participant could be loaded',
      });
      expect(mocks.refreshPlayersForSnapshot).not.toHaveBeenCalled();
      expect(mocks.setRefreshInProgress).toHaveBeenNthCalledWith(1, true);
      expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
    } finally {
      await app.close();
    }
  });
  it('rejects ending an event when a participant snapshot refresh fails', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    mocks.refreshPlayersForSnapshot.mockResolvedValue([secondPlayer]);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events/2/end',
      });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: 'Could not refresh every participant before ending the event',
      });
      expect(mocks.endAdminEvent).not.toHaveBeenCalled();
      expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
    } finally {
      await app.close();
    }
  });
  it('refreshes all participants before successfully ending an event', async () => {
    mocks.getAdminEventById.mockResolvedValue(activeEvent);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/events/2/end',
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.getEventParticipantPlayerIds).toHaveBeenCalledWith(2);
      expect(mocks.getPlayers).toHaveBeenCalledWith(false);
      expect(mocks.refreshPlayersForSnapshot).toHaveBeenCalledWith([firstPlayer, secondPlayer]);
      expect(mocks.endAdminEvent).toHaveBeenCalledWith(2);
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
      expect(response.json()).toEqual({
        ok: true,
        event: endedEvent,
      });
    } finally {
      await app.close();
    }
  });
  it.each([
    ['ACTIVE_EVENT_NOT_FOUND', 404, 'No active event found'],

    [
      'EVENT_END_SNAPSHOT_INCOMPLETE',
      409,
      'Could not create a final snapshot for every participant',
    ],
  ])(
    'maps event-end error %s and releases the operation lock',
    async (errorCode, expectedStatus, expectedMessage) => {
      mocks.getAdminEventById.mockResolvedValue(activeEvent);
      mocks.endAdminEvent.mockRejectedValue(new Error(errorCode));
      const app = await createTestApp();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/admin/events/2/end',
        });
        expect(response.statusCode).toBe(expectedStatus);
        expect(response.json()).toEqual({
          error: expectedMessage,
        });
        expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
      } finally {
        await app.close();
      }
    },
  );
});
