import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/db/players';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getActiveEvent: vi.fn(),
  refreshPlayer: vi.fn(),
  isOperationBusy: vi.fn(),
  setRefreshInProgress: vi.fn(),
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
vi.mock('../src/runtime/operation-state', () => ({
  isOperationBusy: mocks.isOperationBusy,
  setRefreshInProgress: mocks.setRefreshInProgress,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.isOperationBusy.mockReturnValue(false);
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
  it('continues with the next player after a refresh failure', async () => {
    mocks.refreshPlayer
      .mockRejectedValueOnce(new Error('Provider exploded'))
      .mockResolvedValueOnce(true);
    startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refreshPlayer).toHaveBeenNthCalledWith(1, firstPlayer);
    expect(console.error).toHaveBeenCalledWith('[SCHEDULER] Refresh failed:', expect.any(Error));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.refreshPlayer).toHaveBeenNthCalledWith(2, secondPlayer);
    expect(mocks.setRefreshInProgress).toHaveBeenCalledWith(false);
  });
});
