import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../src/utils/with-timeout';

describe('withTimeout', () => {
  it('returns the original result when the promise resolves in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'timeout')).resolves.toBe('ok');
  });
  it('forwards errors from the original promise', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('provider failed')), 1000, 'timeout'),
    ).rejects.toThrow('provider failed');
  });
  it('rejects when the timeout is exceeded', async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<string>(() => {});
      const result = expect(
        withTimeout(pending, 5000, 'Provider request timed out'),
      ).rejects.toThrow('Provider request timed out');
      await vi.advanceTimersByTimeAsync(5000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
