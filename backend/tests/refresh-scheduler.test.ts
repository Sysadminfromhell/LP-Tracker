import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/db/players';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getActiveEvent: vi.fn(),
  refreshPlayer: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  getOperationState: vi.fn(),
  enqueueRefresh: vi.fn(),
}));

vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/db/events', () => ({
  getActiveEvent: mocks.getActiveEvent,
}));
vi.mock('../src/services/player-refresh.service', () => ({
  refreshPlayer: mocks.refreshPlayer,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/runtime/operation-state', () => ({
  getOperationState: mocks.getOperationState,
}));
vi.mock('../src/runtime/refresh-queue', () => ({
  enqueueRefresh: mocks.enqueueRefresh,
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
  mocks.getOperationState.mockReturnValue({
    lifecycleInProgress: false,
  });
  mocks.enqueueRefresh.mockImplementation(async (task: () => Promise<unknown>) => task());
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
  mocks.getPlayers.mockResolvedValue([firstPlayer, secondPlayer]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  stopRefreshScheduler();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('refresh scheduler reliability', () => {
  it('refreshes two players in one scheduler batch', async () => {
    mocks.refreshPlayer.mockResolvedValue(true);
    startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.enqueueRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.refreshPlayer).toHaveBeenCalledTimes(2);
    expect(mocks.refreshPlayer).toHaveBeenCalledWith(firstPlayer, {
      updateLeaderboard: false,
    });
    expect(mocks.refreshPlayer).toHaveBeenCalledWith(secondPlayer, {
      updateLeaderboard: false,
    });
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
