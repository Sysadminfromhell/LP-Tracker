import { describe, expect, it, vi } from 'vitest';
import { enqueueRefresh, getRefreshQueueState } from '../src/runtime/refresh-queue';

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

describe('refresh queue', () => {
  it('runs refresh tasks one at a time in FIFO order', async () => {
    const first = deferred<void>();
    const order: string[] = [];
    const firstResult = enqueueRefresh(async () => {
      order.push('first-start');
      await first.promise;
      order.push('first-end');
      return 'first';
    });
    const secondResult = enqueueRefresh(async () => {
      order.push('second');
      return 'second';
    });
    await vi.waitFor(() => {
      expect(order).toEqual(['first-start']);
    });
    expect(getRefreshQueueState()).toEqual({
      running: true,
      pending: 1,
    });
    first.resolve();
    await expect(firstResult).resolves.toBe('first');
    await expect(secondResult).resolves.toBe('second');
    expect(order).toEqual(['first-start', 'first-end', 'second']);
    expect(getRefreshQueueState()).toEqual({
      running: false,
      pending: 0,
    });
  });
  it('continues processing the queue when a task fails', async () => {
    const firstResult = enqueueRefresh(async () => {
      throw new Error('Refresh failed');
    });
    const secondResult = enqueueRefresh(async () => {
      return 'success';
    });
    await expect(firstResult).rejects.toThrow('Refresh failed');
    await expect(secondResult).resolves.toBe('success');
    expect(getRefreshQueueState()).toEqual({
      running: false,
      pending: 0,
    });
  });
  it('returns task results to the caller', async () => {
    const result = await enqueueRefresh(async () => {
      return {
        playerId: 42,
        refreshed: true,
      };
    });
    expect(result).toEqual({
      playerId: 42,
      refreshed: true,
    });
  });
});
