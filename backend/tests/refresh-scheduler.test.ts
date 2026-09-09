import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/db/players';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getActiveEvent: vi.fn(),
  getEventParticipantPlayerIds: vi.fn(),
  refreshPlayer: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  isLockHeld: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/db/events', () => ({
  getActiveEvent: mocks.getActiveEvent,
}));
vi.mock('../src/db/admin-events', () => ({
  getEventParticipantPlayerIds: mocks.getEventParticipantPlayerIds,
}));
vi.mock('../src/services/player-refresh.service', () => ({
  refreshPlayer: mocks.refreshPlayer,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/runtime/job-coordinator', () => ({
  jobCoordinator: {
    enqueue: mocks.enqueueJob,
    isLockHeld: mocks.isLockHeld,
  },
}));

import { startRefreshScheduler, stopRefreshScheduler } from '../src/jobs/refresh-scheduler';

const firstPlayer: Player = {
  id: 1,
  gameName: 'BrokenPlayer',
  tagLine: 'EUW',
  region: 'EUW',
  twitchUsername: null,
  twitterUsername: null,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const secondPlayer: Player = {
  ...firstPlayer,
  id: 2,
  gameName: 'HealthyPlayer',
};
const nonParticipantPlayer: Player = {
  ...firstPlayer,
  id: 3,
  gameName: 'NotInEvent',
};

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.isLockHeld.mockReturnValue(false);
  mocks.enqueueJob.mockImplementation(async (_request: unknown, task: () => Promise<unknown>) =>
    task(),
  );
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  mocks.getActiveEvent.mockResolvedValue({
    id: 1,
    name: 'Test Event',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-01-02T00:00:00.000Z',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  mocks.getEventParticipantPlayerIds.mockResolvedValue([1, 2]);
  mocks.getPlayers.mockResolvedValue([firstPlayer, secondPlayer, nonParticipantPlayer]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  stopRefreshScheduler();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('refresh scheduler reliability', () => {
  it('pauses automatic refresh while an event transition lock is held', async () => {
    mocks.isLockHeld.mockReturnValue(true);
    startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.isLockHeld).toHaveBeenCalledWith('event-transition');
    expect(mocks.getActiveEvent).not.toHaveBeenCalled();
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
    expect(mocks.refreshPlayer).not.toHaveBeenCalled();
  });
  it('refreshes only active event participants in one scheduler batch', async () => {
    mocks.refreshPlayer.mockResolvedValue(true);
    startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getEventParticipantPlayerIds).toHaveBeenCalledWith(1);
    expect(mocks.getPlayers).toHaveBeenCalledWith(false);
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      {
        type: 'scheduled-player-refresh',
        key: 'event:1:players:1,2',
      },
      expect.any(Function),
    );
    expect(mocks.refreshPlayer).toHaveBeenCalledTimes(2);
    expect(mocks.refreshPlayer).toHaveBeenCalledWith(firstPlayer, {
      updateLeaderboard: false,
    });
    expect(mocks.refreshPlayer).toHaveBeenCalledWith(secondPlayer, {
      updateLeaderboard: false,
    });
    expect(mocks.refreshPlayer).not.toHaveBeenCalledWith(nonParticipantPlayer, expect.anything());
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
  });
  it('starts both player refreshes before either one completes', async () => {
    const refreshGate = deferred();
    mocks.refreshPlayer.mockImplementation(async () => {
      await refreshGate.promise;
      return true;
    });
    startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refreshPlayer).toHaveBeenCalledTimes(2);
    expect(mocks.loadLeaderboardFromDatabase).not.toHaveBeenCalled();
    refreshGate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
  });
});
