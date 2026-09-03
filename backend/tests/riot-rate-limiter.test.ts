import { describe, expect, it, vi } from 'vitest';
import { RiotRateLimiter } from '../src/providers/riot/rate-limiter';

describe('RiotRateLimiter', () => {
  it('does not delay requests before rate limits are known', async () => {
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>();
    sleep.mockResolvedValue();
    let now = 1_000;
    const limiter = new RiotRateLimiter(sleep, () => now);
    await limiter.schedule(async () => 'ok');
    expect(sleep).not.toHaveBeenCalled();
  });
  it('paces requests using the strictest Riot application bucket', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new RiotRateLimiter(sleep, () => now);
    limiter.update({
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
        {
          limit: 20,
          count: 1,
          windowSeconds: 1,
        },
      ],
      restricted: true,
    });
    await limiter.schedule(async () => 'first');
    await limiter.schedule(async () => 'second');
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1260);
  });
  it('adapts automatically to production-style limits', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new RiotRateLimiter(sleep, () => now);
    limiter.update({
      buckets: [
        {
          limit: 30_000,
          count: 10,
          windowSeconds: 600,
        },
        {
          limit: 500,
          count: 1,
          windowSeconds: 10,
        },
      ],
      restricted: false,
    });
    await limiter.schedule(async () => 'first');
    await limiter.schedule(async () => 'second');
    expect(sleep).toHaveBeenCalledWith(21);
  });

  it('blocks requests for Retry-After', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new RiotRateLimiter(sleep, () => now);
    limiter.blockFor(7);
    await limiter.schedule(async () => 'ok');
    expect(sleep).toHaveBeenCalledWith(7_000);
  });
  it('keeps the longest active block', async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new RiotRateLimiter(sleep, () => now);
    limiter.blockFor(7);
    limiter.blockFor(3);
    await limiter.schedule(async () => 'ok');
    expect(sleep).toHaveBeenCalledWith(7_000);
  });
  it('continues processing after a scheduled request fails', async () => {
    const limiter = new RiotRateLimiter(
      async () => {},
      () => 1_000,
    );
    await expect(
      limiter.schedule(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(limiter.schedule(async () => 'still works')).resolves.toBe('still works');
  });
});
