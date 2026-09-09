import { describe, expect, it, vi } from 'vitest';
import { JobCoordinator, JobCoordinatorStoppedError } from '../src/runtime/job-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

describe('job coordinator', () => {
  it('runs higher-priority pending jobs before lower-priority jobs', async () => {
    const coordinator = new JobCoordinator();
    const blocker = deferred<void>();
    const order: string[] = [];
    const blockerJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'blocker',
      },
      async () => {
        order.push('blocker-start');
        await blocker.promise;
        order.push('blocker-end');
      },
    );
    await vi.waitFor(() => {
      expect(coordinator.getState().running?.key).toBe('blocker');
    });
    const scheduledJob = coordinator.enqueue(
      {
        type: 'scheduled-player-refresh',
        key: 'scheduled',
      },
      async () => {
        order.push('scheduled');
      },
    );
    const manualJob = coordinator.enqueue(
      {
        type: 'manual-refresh-all',
        key: 'manual',
      },
      async () => {
        order.push('manual');
      },
    );
    const eventEndJob = coordinator.enqueue(
      {
        type: 'event-end',
        key: 'event:42',
      },
      async () => {
        order.push('event-end');
      },
    );
    expect(coordinator.getState().pending.map((job) => job.type)).toEqual([
      'event-end',
      'manual-refresh-all',
      'scheduled-player-refresh',
    ]);
    blocker.resolve();
    await Promise.all([blockerJob, scheduledJob, manualJob, eventEndJob]);
    expect(order).toEqual(['blocker-start', 'blocker-end', 'event-end', 'manual', 'scheduled']);
  });
  it('keeps FIFO order for jobs with the same priority', async () => {
    const coordinator = new JobCoordinator();
    const blocker = deferred<void>();
    const order: string[] = [];
    const blockerJob = coordinator.enqueue(
      {
        type: 'event-start',
        key: 'blocker',
      },
      async () => {
        await blocker.promise;
      },
    );
    await vi.waitFor(() => {
      expect(coordinator.getState().running?.key).toBe('blocker');
    });
    const firstJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:1',
      },
      async () => {
        order.push('first');
      },
    );
    const secondJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:2',
      },
      async () => {
        order.push('second');
      },
    );
    blocker.resolve();
    await Promise.all([blockerJob, firstJob, secondJob]);
    expect(order).toEqual(['first', 'second']);
  });
  it('deduplicates jobs with the same type and key', async () => {
    const coordinator = new JobCoordinator();
    const blocker = deferred<void>();
    const task = vi.fn(async () => {
      await blocker.promise;
      return 'refreshed';
    });
    const first = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:42',
      },
      task,
    );
    const second = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:42',
      },
      task,
    );
    expect(second).toBe(first);
    expect(task).toHaveBeenCalledTimes(1);
    blocker.resolve();
    await expect(first).resolves.toBe('refreshed');
    await expect(second).resolves.toBe('refreshed');
    expect(task).toHaveBeenCalledTimes(1);
  });
  it('does not deduplicate different job types that use the same key', async () => {
    const coordinator = new JobCoordinator();
    const order: string[] = [];
    const first = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:42',
      },
      async () => {
        order.push('manual');
      },
    );
    const second = coordinator.enqueue(
      {
        type: 'scheduled-player-refresh',
        key: 'player:42',
      },
      async () => {
        order.push('scheduled');
      },
    );
    await Promise.all([first, second]);
    expect(order).toEqual(['manual', 'scheduled']);
  });
  it('continues processing jobs after a job fails', async () => {
    const coordinator = new JobCoordinator();
    const order: string[] = [];
    const failedJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:1',
      },
      async () => {
        order.push('failed');
        throw new Error('Refresh failed');
      },
    );
    const successfulJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:2',
      },
      async () => {
        order.push('success');
        return 'done';
      },
    );
    await expect(failedJob).rejects.toThrow('Refresh failed');
    await expect(successfulJob).resolves.toBe('done');
    expect(order).toEqual(['failed', 'success']);
    expect(coordinator.getState()).toEqual({
      accepting: true,
      running: null,
      pending: [],
      locks: [],
    });
  });
  it('stops accepting new jobs and waits for existing work to become idle', async () => {
    const coordinator = new JobCoordinator();
    const blocker = deferred<void>();
    const runningJob = coordinator.enqueue(
      {
        type: 'scheduled-player-refresh',
        key: 'player:42',
      },
      async () => {
        await blocker.promise;
      },
    );
    await vi.waitFor(() => {
      expect(coordinator.getState().running?.key).toBe('player:42');
    });
    coordinator.stopAcceptingJobs();
    expect(coordinator.getState().accepting).toBe(false);
    const rejectedJob = coordinator.enqueue(
      {
        type: 'manual-player-refresh',
        key: 'player:43',
      },
      async () => {},
    );
    await expect(rejectedJob).rejects.toBeInstanceOf(JobCoordinatorStoppedError);
    let idle = false;
    const waitForIdle = coordinator.waitForIdle().then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);
    blocker.resolve();
    await runningJob;
    await waitForIdle;
    expect(idle).toBe(true);
    expect(coordinator.getState()).toEqual({
      accepting: false,
      running: null,
      pending: [],
      locks: [],
    });
  });
  it('coordinates exclusive locks and waits for them before becoming idle', async () => {
    const coordinator = new JobCoordinator();
    const release = coordinator.tryAcquireLock('event-transition');
    expect(release).not.toBeNull();
    expect(coordinator.isLockHeld('event-transition')).toBe(true);
    expect(coordinator.tryAcquireLock('event-transition')).toBeNull();
    expect(coordinator.getState().locks).toEqual(['event-transition']);
    let idle = false;
    const waitForIdle = coordinator.waitForIdle().then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);
    release?.();
    await waitForIdle;
    expect(idle).toBe(true);
    expect(coordinator.isLockHeld('event-transition')).toBe(false);
    expect(coordinator.getState().locks).toEqual([]);
    release?.();
    expect(coordinator.getState().locks).toEqual([]);
  });
  it('returns immediately from waitForIdle when there is no work', async () => {
    const coordinator = new JobCoordinator();
    await expect(coordinator.waitForIdle()).resolves.toBeUndefined();
  });
});
