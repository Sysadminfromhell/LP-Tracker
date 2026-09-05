interface RefreshQueueEntry {
  run: () => Promise<void>;
}

export interface RefreshQueueState {
  running: boolean;
  pending: number;
}

const queue: RefreshQueueEntry[] = [];
let running = false;

async function drainQueue(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) {
        continue;
      }
      await entry.run();
    }
  } finally {
    running = false;
  }
}
export function enqueueRefresh<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      run: async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    });

    void drainQueue();
  });
}
export function getRefreshQueueState(): RefreshQueueState {
  return {
    running,
    pending: queue.length,
  };
}
