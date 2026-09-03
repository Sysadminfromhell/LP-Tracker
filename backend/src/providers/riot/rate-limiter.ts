import type { RiotRateLimitStatus } from './rate-limit';

type Sleep = (milliseconds: number) => Promise<void>;
type Now = () => number;

const RATE_LIMIT_SAFETY_FACTOR = 1.05;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class RiotRateLimiter {
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt: number | null = null;
  private minimumIntervalMs = 0;
  private nextRequestAt = 0;
  private blockedUntil = 0;
  constructor(
    private readonly sleep: Sleep = defaultSleep,
    private readonly now: Now = Date.now,
  ) {}
  update(status: RiotRateLimitStatus | null): void {
    if (!status || status.buckets.length === 0) {
      return;
    }
    const intervals = status.buckets.map((bucket) => (bucket.windowSeconds * 1000) / bucket.limit);
    const strictestInterval = Math.max(...intervals);
    const minimumIntervalMs = Math.ceil(strictestInterval * RATE_LIMIT_SAFETY_FACTOR);
    this.minimumIntervalMs = minimumIntervalMs;
    if (this.lastRequestAt !== null) {
      this.nextRequestAt = Math.max(this.nextRequestAt, this.lastRequestAt + minimumIntervalMs);
    }
  }
  blockFor(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + seconds * 1000);
  }
  async schedule<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.queue.then(async () => {
      await this.waitUntilAllowed();
      const startedAt = this.now();
      this.lastRequestAt = startedAt;
      this.nextRequestAt = startedAt + this.minimumIntervalMs;
      return operation();
    });
    this.queue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }
  private async waitUntilAllowed(): Promise<void> {
    const waitUntil = Math.max(this.nextRequestAt, this.blockedUntil);
    const waitMs = waitUntil - this.now();
    if (waitMs <= 0) {
      return;
    }
    await this.sleep(waitMs);
  }
}
