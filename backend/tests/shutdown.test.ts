import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const mocks = vi.hoisted(() => ({
  closeDatabase: vi.fn(),
  stopRefreshScheduler: vi.fn(),
  stopEventLifecycle: vi.fn(),
  disconnectLeagueDataProvider: vi.fn(),
  closeLiveUpdateClients: vi.fn(),
  stopAcceptingJobs: vi.fn(),
  waitForIdle: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  closeDatabase: mocks.closeDatabase,
}));
vi.mock('../src/jobs/refresh-scheduler', () => ({
  stopRefreshScheduler: mocks.stopRefreshScheduler,
}));
vi.mock('../src/jobs/event-lifecycle', () => ({
  stopEventLifecycle: mocks.stopEventLifecycle,
}));
vi.mock('../src/services/league-data.service', () => ({
  disconnectLeagueDataProvider: mocks.disconnectLeagueDataProvider,
}));
vi.mock('../src/services/live-update.service', () => ({
  closeLiveUpdateClients: mocks.closeLiveUpdateClients,
}));
vi.mock('../src/runtime/job-coordinator', () => ({
  jobCoordinator: {
    stopAcceptingJobs: mocks.stopAcceptingJobs,
    waitForIdle: mocks.waitForIdle,
  },
}));

import { createShutdownHandler } from '../src/runtime/shutdown';

function createTestApp() {
  return {
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as FastifyInstance & {
    close: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.closeDatabase.mockResolvedValue(undefined);
  mocks.disconnectLeagueDataProvider.mockResolvedValue(undefined);
  mocks.waitForIdle.mockResolvedValue(undefined);
});

describe('application shutdown', () => {
  it('stops runtime services and closes application resources', async () => {
    const app = createTestApp();
    const shutdown = createShutdownHandler(app);
    await shutdown();
    expect(mocks.stopRefreshScheduler).toHaveBeenCalledTimes(1);
    expect(mocks.stopEventLifecycle).toHaveBeenCalledTimes(1);
    expect(mocks.stopAcceptingJobs).toHaveBeenCalledTimes(1);
    expect(mocks.waitForIdle).toHaveBeenCalledTimes(1);
    expect(mocks.closeLiveUpdateClients).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectLeagueDataProvider).toHaveBeenCalledTimes(1);
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(mocks.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it('only performs shutdown once', async () => {
    const app = createTestApp();
    const shutdown = createShutdownHandler(app);
    await shutdown();
    await shutdown();
    expect(mocks.stopRefreshScheduler).toHaveBeenCalledTimes(1);
    expect(mocks.stopEventLifecycle).toHaveBeenCalledTimes(1);
    expect(mocks.stopAcceptingJobs).toHaveBeenCalledTimes(1);
    expect(mocks.waitForIdle).toHaveBeenCalledTimes(1);
    expect(mocks.closeLiveUpdateClients).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectLeagueDataProvider).toHaveBeenCalledTimes(1);
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(mocks.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it('continues cleanup when provider disconnect fails', async () => {
    mocks.disconnectLeagueDataProvider.mockRejectedValue(new Error('Provider disconnect failed'));
    const app = createTestApp();
    const shutdown = createShutdownHandler(app);
    await expect(shutdown()).resolves.toBeUndefined();
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(mocks.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it('closes the database even when the Fastify close fails', async () => {
    const app = createTestApp();
    app.close.mockRejectedValue(new Error('Fastify close failed'));
    const shutdown = createShutdownHandler(app);
    await expect(shutdown()).resolves.toBeUndefined();
    expect(mocks.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it('waits for coordinator work before closing dependent resources', async () => {
    let resolveIdle!: () => void;
    const idlePromise = new Promise<void>((resolve) => {
      resolveIdle = resolve;
    });
    mocks.waitForIdle.mockReturnValue(idlePromise);
    const app = createTestApp();
    const shutdown = createShutdownHandler(app);
    const shutdownPromise = shutdown();
    await vi.waitFor(() => {
      expect(mocks.waitForIdle).toHaveBeenCalledTimes(1);
    });
    expect(mocks.stopAcceptingJobs).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectLeagueDataProvider).not.toHaveBeenCalled();
    expect(app.close).not.toHaveBeenCalled();
    expect(mocks.closeDatabase).not.toHaveBeenCalled();
    resolveIdle();
    await shutdownPromise;
    expect(mocks.disconnectLeagueDataProvider).toHaveBeenCalledTimes(1);
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(mocks.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it('shuts down resources in the expected order', async () => {
    const app = createTestApp();
    const shutdown = createShutdownHandler(app);
    await shutdown();
    expect(mocks.stopRefreshScheduler.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.stopEventLifecycle.mock.invocationCallOrder[0],
    );
    expect(mocks.stopEventLifecycle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.stopAcceptingJobs.mock.invocationCallOrder[0],
    );
    expect(mocks.stopAcceptingJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.waitForIdle.mock.invocationCallOrder[0],
    );
    expect(mocks.waitForIdle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeLiveUpdateClients.mock.invocationCallOrder[0],
    );
    expect(mocks.closeLiveUpdateClients.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.disconnectLeagueDataProvider.mock.invocationCallOrder[0],
    );
    expect(mocks.disconnectLeagueDataProvider.mock.invocationCallOrder[0]).toBeLessThan(
      app.close.mock.invocationCallOrder[0],
    );
    expect(app.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeDatabase.mock.invocationCallOrder[0],
    );
  });
});
