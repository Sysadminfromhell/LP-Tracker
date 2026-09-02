import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/db/players';
import type { DbEvent } from '../src/db/events';
import type { AdminEvent } from '../src/db/admin-events';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getActiveEvent: vi.fn(),
  activateScheduledEvent: vi.fn(),
  endAdminEvent: vi.fn(),
  getDueScheduledEvent: vi.fn(),
  getEventParticipantPlayerIds: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  refreshPlayersForSnapshot: vi.fn(),
  isOperationBusy: vi.fn(),
  setLifecycleInProgress: vi.fn(),
  setRefreshInProgress: vi.fn(),
}));
vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/db/events', () => ({
  getActiveEvent: mocks.getActiveEvent,
}));
vi.mock('../src/db/admin-events', () => ({
  activateScheduledEvent: mocks.activateScheduledEvent,
  endAdminEvent: mocks.endAdminEvent,
  getDueScheduledEvent: mocks.getDueScheduledEvent,
  getEventParticipantPlayerIds: mocks.getEventParticipantPlayerIds,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/services/player-refresh.service', () => ({
  refreshPlayersForSnapshot: mocks.refreshPlayersForSnapshot,
}));
vi.mock('../src/runtime/operation-state', () => ({
  isOperationBusy: mocks.isOperationBusy,
  setLifecycleInProgress: mocks.setLifecycleInProgress,
  setRefreshInProgress: mocks.setRefreshInProgress,
}));

import { startEventLifecycle, stopEventLifecycle } from '../src/jobs/event-lifecycle';

const players: Player[] = [
  {
    id: 1,
    gameName: 'PlayerOne',
    tagLine: 'EUW',
    region: 'EUW',
    twitchUsername: null,
    twitterUsername: null,
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 2,
    gameName: 'PlayerTwo',
    tagLine: 'EUW',
    region: 'EUW',
    twitchUsername: null,
    twitterUsername: null,
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];
const expiredActiveEvent: DbEvent = {
  id: 1,
  name: 'Event One',
  startsAt: '2026-09-01T18:00:00.000Z',
  endsAt: '2026-09-02T20:00:00.000Z',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T18:00:00.000Z',
};
const dueScheduledEvent: AdminEvent = {
  id: 2,
  name: 'Event Two',
  startsAt: '2026-09-02T20:00:00.000Z',
  endsAt: '2026-09-03T20:00:00.000Z',
  status: 'draft',
  participantCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const endedEvent: AdminEvent = {
  id: 1,
  name: 'Event One',
  startsAt: '2026-09-01T18:00:00.000Z',
  endsAt: '2026-09-02T20:00:00.000Z',
  status: 'ended',
  participantCount: 2,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T20:00:00.000Z',
};
const activatedEvent: AdminEvent = {
  ...dueScheduledEvent,
  status: 'active',
  participantCount: 2,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-02T20:00:00.000Z'));
  vi.clearAllMocks();
  mocks.isOperationBusy.mockReturnValue(false);
  mocks.getActiveEvent.mockResolvedValue(expiredActiveEvent);
  mocks.getEventParticipantPlayerIds.mockResolvedValue([1, 2]);
  mocks.getPlayers.mockResolvedValue(players);
  mocks.refreshPlayersForSnapshot.mockResolvedValue([]);
  mocks.endAdminEvent.mockResolvedValue(endedEvent);
  mocks.getDueScheduledEvent.mockResolvedValue(dueScheduledEvent);
  mocks.activateScheduledEvent.mockResolvedValue(activatedEvent);
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  stopEventLifecycle();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('event lifecycle reliability', () => {
  it('ends an expired event before starting a due back-to-back event', async () => {
    startEventLifecycle();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.endAdminEvent).toHaveBeenCalledWith(
      expiredActiveEvent.id,
      expiredActiveEvent.endsAt,
    );
    expect(mocks.activateScheduledEvent).toHaveBeenCalledWith(dueScheduledEvent.id);
    const endOrder = mocks.endAdminEvent.mock.invocationCallOrder[0];
    const activateOrder = mocks.activateScheduledEvent.mock.invocationCallOrder[0];
    expect(endOrder).toBeLessThan(activateOrder);
    expect(mocks.refreshPlayersForSnapshot).toHaveBeenCalledTimes(2);
    expect(mocks.refreshPlayersForSnapshot).toHaveBeenNthCalledWith(1, players);
    expect(mocks.refreshPlayersForSnapshot).toHaveBeenNthCalledWith(2, players);
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(2);
  });
  it('ends an expired event even when the final refresh fails for a player', async () => {
    mocks.getDueScheduledEvent.mockResolvedValue(null);
    mocks.refreshPlayersForSnapshot.mockResolvedValueOnce([players[0]]);
    startEventLifecycle();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refreshPlayersForSnapshot).toHaveBeenCalledWith(players);
    expect(mocks.endAdminEvent).toHaveBeenCalledWith(
      expiredActiveEvent.id,
      expiredActiveEvent.endsAt,
    );
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Using their last successful cached state for the final snapshot.'),
    );
  });
  it('does not activate a scheduled event when the initial refresh fails', async () => {
    mocks.getActiveEvent.mockResolvedValue(null);
    mocks.refreshPlayersForSnapshot.mockResolvedValueOnce([players[0]]);
    startEventLifecycle();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refreshPlayersForSnapshot).toHaveBeenCalledWith(players);
    expect(mocks.activateScheduledEvent).not.toHaveBeenCalled();
    expect(mocks.loadLeaderboardFromDatabase).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('1 player refresh(es) failed'),
    );
  });
});
