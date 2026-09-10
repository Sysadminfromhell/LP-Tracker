import { claimLpReconciliationJobs } from '../db/lp-reconciliation';
import { jobCoordinator } from '../runtime/job-coordinator';
import { reconcileLpParticipant } from '../services/lp-reconciliation.service';

const INTERVAL_MS = 30_000;
const MAX_JOBS_PER_TICK = 5;
const LEASE_SECONDS = 120;
let workerTimer: NodeJS.Timeout | null = null;
let stopped = true;

async function processDueJobs(): Promise<void> {
  for (let index = 0; index < MAX_JOBS_PER_TICK; index++) {
    const jobs = await claimLpReconciliationJobs(1, LEASE_SECONDS);
    const job = jobs[0];
    if (!job) {
      return;
    }
    const result = await reconcileLpParticipant(job.eventParticipantId, job.attemptCount);
    console.log(
      `[LP RECONCILIATION] Participant ${job.eventParticipantId}: ` +
        `${result.status} | ${result.resolvedMatches} resolved | ${result.message}`,
    );
  }
}
async function workerTick(): Promise<void> {
  if (stopped) {
    return;
  }
  try {
    await jobCoordinator.enqueue(
      {
        type: 'lp-reconciliation',
        key: 'worker',
      },
      processDueJobs,
    );
  } catch (error) {
    if (!stopped) {
      console.error('[LP RECONCILIATION] Worker failed:', error);
    }
  } finally {
    if (!stopped) {
      workerTimer = setTimeout(() => {
        void workerTick();
      }, INTERVAL_MS);
    }
  }
}
export function startLpReconciliationWorker(): void {
  if (workerTimer || !stopped) {
    return;
  }
  stopped = false;
  void workerTick();
}
export function stopLpReconciliationWorker(): void {
  stopped = true;
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
}
