export type JobType =
  | 'event-start'
  | 'event-end'
  | 'manual-player-refresh'
  | 'manual-refresh-all'
  | 'scheduled-player-refresh';
export type CoordinatorLock = 'event-transition';
export const JOB_PRIORITIES: Readonly<Record<JobType, number>> = {
  'event-end': 110,
  'event-start': 100,
  'manual-refresh-all': 60,
  'manual-player-refresh': 50,
  'scheduled-player-refresh': 10,
};

export interface JobRequest {
  type: JobType;
  key?: string;
  priority?: number;
}
export interface JobSnapshot {
  id: string;
  type: JobType;
  key: string | null;
  priority: number;
  enqueuedAt: number;
  startedAt: number | null;
}
export interface JobCoordinatorState {
  accepting: boolean;
  running: JobSnapshot | null;
  pending: JobSnapshot[];
  locks: CoordinatorLock[];
}
interface QueuedJob {
  snapshot: JobSnapshot;
  dedupeKey: string | null;
  execute: () => Promise<void>;
}
export class JobCoordinatorStoppedError extends Error {
  constructor() {
    super('JOB_COORDINATOR_STOPPED');
    this.name = 'JobCoordinatorStoppedError';
  }
}
export class JobCoordinator {
  private readonly queue: QueuedJob[] = [];
  private readonly jobsByKey = new Map<string, Promise<unknown>>();
  private readonly idleWaiters = new Set<() => void>();
  private readonly locks = new Set<CoordinatorLock>();
  private accepting = true;
  private draining = false;
  private runningJob: JobSnapshot | null = null;
  private nextJobId = 0;
  enqueue<T>(request: JobRequest, task: () => Promise<T>): Promise<T> {
    if (!this.accepting) {
      return Promise.reject(new JobCoordinatorStoppedError());
    }
    const dedupeKey = request.key ? `${request.type}:${request.key}` : null;
    if (dedupeKey) {
      const existingJob = this.jobsByKey.get(dedupeKey);
      if (existingJob) {
        return existingJob as Promise<T>;
      }
    }
    const snapshot: JobSnapshot = {
      id: this.createJobId(),
      type: request.type,
      key: request.key ?? null,
      priority: request.priority ?? JOB_PRIORITIES[request.type],
      enqueuedAt: Date.now(),
      startedAt: null,
    };
    let resolvePromise!: (value: T) => void;
    let rejectPromise!: (error: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const queuedJob: QueuedJob = {
      snapshot,
      dedupeKey,
      execute: async () => {
        try {
          resolvePromise(await task());
        } catch (error) {
          rejectPromise(error);
        }
      },
    };
    this.queue.push(queuedJob);
    this.sortQueue();
    if (dedupeKey) {
      this.jobsByKey.set(dedupeKey, promise);
    }
    void this.drainQueue();
    return promise;
  }
  getState(): JobCoordinatorState {
    return {
      accepting: this.accepting,
      running: this.runningJob ? { ...this.runningJob } : null,
      pending: this.queue.map((job) => ({
        ...job.snapshot,
      })),
      locks: [...this.locks],
    };
  }
  tryAcquireLock(lock: CoordinatorLock): (() => void) | null {
    if (!this.accepting || this.locks.has(lock)) {
      return null;
    }
    this.locks.add(lock);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.locks.delete(lock);
      this.resolveIdleWaiters();
    };
  }
  isLockHeld(lock: CoordinatorLock): boolean {
    return this.locks.has(lock);
  }
  stopAcceptingJobs(): void {
    this.accepting = false;
  }
  waitForIdle(): Promise<void> {
    if (this.isIdle()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleWaiters.add(resolve);
    });
  }
  private async drainQueue(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) {
          continue;
        }
        job.snapshot.startedAt = Date.now();
        this.runningJob = {
          ...job.snapshot,
        };
        try {
          await job.execute();
        } finally {
          if (job.dedupeKey) {
            this.jobsByKey.delete(job.dedupeKey);
          }
          this.runningJob = null;
        }
      }
    } finally {
      this.draining = false;
      this.resolveIdleWaiters();
    }
  }
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.snapshot.priority !== b.snapshot.priority) {
        return b.snapshot.priority - a.snapshot.priority;
      }
      return a.snapshot.enqueuedAt - b.snapshot.enqueuedAt;
    });
  }
  private createJobId(): string {
    this.nextJobId += 1;
    return `job-${this.nextJobId}`;
  }
  private isIdle(): boolean {
    return (
      !this.draining && this.runningJob === null && this.queue.length === 0 && this.locks.size === 0
    );
  }
  private resolveIdleWaiters(): void {
    if (!this.isIdle()) {
      return;
    }
    for (const resolve of this.idleWaiters) {
      resolve();
    }
    this.idleWaiters.clear();
  }
}
export const jobCoordinator = new JobCoordinator();
