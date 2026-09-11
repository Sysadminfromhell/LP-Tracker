import {
  applyLpReconciliationResolutions,
  completeClaimedLpReconciliation,
  getLpReconciliationContext,
  retryClaimedLpReconciliation,
} from '../db/lp-reconciliation';
import { resolveLpObservationDeltas } from './lp-observation-resolver';
export interface LpReconciliationRunResult {
  status: 'resolved' | 'retry' | 'complete';
  resolvedMatches: number;
  message: string;
}
export function getLpReconciliationRetryDelaySeconds(attemptCount: number): number {
  if (attemptCount <= 1) return 120;
  if (attemptCount === 2) return 300;
  if (attemptCount === 3) return 900;
  if (attemptCount === 4) return 1800;
  return 3600;
}
export async function reconcileLpParticipant(
  eventParticipantId: number,
  attemptCount: number,
): Promise<LpReconciliationRunResult> {
  const retry = async (
    message: string,
    delaySeconds = getLpReconciliationRetryDelaySeconds(attemptCount),
  ): Promise<LpReconciliationRunResult> => {
    await retryClaimedLpReconciliation(eventParticipantId, attemptCount, delaySeconds, message);
    return {
      status: 'retry',
      resolvedMatches: 0,
      message,
    };
  };
  try {
    const context = await getLpReconciliationContext(eventParticipantId);
    if (!context || context.unresolvedMatches.length === 0) {
      await completeClaimedLpReconciliation(eventParticipantId, attemptCount);
      return {
        status: 'complete',
        resolvedMatches: 0,
        message: 'No unresolved matches',
      };
    }
    if (context.eventStatus !== 'active' && context.eventStatus !== 'ended') {
      return retry(`Event is ${context.eventStatus}`);
    }
    if (!context.unresolvedBlockSynchronized) {
      return retry('Unresolved block is not fully synchronized');
    }
    const resolutions = resolveLpObservationDeltas(
      context.leftRankScore,
      context.unresolvedMatches.map((match) => ({
        id: match.providerMatchId,
        createdAt: match.gameCreatedAt,
        durationSeconds: match.durationSeconds,
        result: match.result,
      })),
      context.rankObservations.map((observation) => ({
        rankScore: observation.rankScore,
        observedAt: observation.observedAt,
      })),
      {
        rightRankScore: context.rightRankScore,
        rightBoundaryAt: context.rightBoundaryAt,
      },
    );
    if (resolutions.length === 0) {
      return retry(`Resolved 0/${context.unresolvedMatches.length} matches`);
    }
    const result = await applyLpReconciliationResolutions({
      eventParticipantId,
      attemptCount,
      expectedLeftRankScore: context.leftRankScore,
      expectedRightRankScore: context.rightRankScore,
      expectedRightBoundaryAt: context.rightBoundaryAt,
      resolutions: resolutions.map((resolution) => ({
        providerMatchId: resolution.matchId,
        lpDelta: resolution.lpDelta,
        rankScoreAfter: resolution.rankScoreAfter,
      })),
    });
    if (!result.applied) {
      if (!result.remainingUnresolved) {
        await completeClaimedLpReconciliation(eventParticipantId, attemptCount);

        return {
          status: 'complete',
          resolvedMatches: 0,
          message: result.reason ?? 'Already resolved',
        };
      }
      return retry(result.reason ?? 'Could not apply LP reconciliation');
    }
    if (result.remainingUnresolved) {
      await retryClaimedLpReconciliation(eventParticipantId, attemptCount, 30, null);
      return {
        status: 'resolved',
        resolvedMatches: result.resolvedMatches,
        message:
          `Resolved ${result.resolvedMatches} match(es), ` + `more unresolved matches remain`,
      };
    }
    const completed = await completeClaimedLpReconciliation(eventParticipantId, attemptCount);
    if (!completed) {
      await retryClaimedLpReconciliation(
        eventParticipantId,
        attemptCount,
        30,
        'Reconciliation state changed before completion',
      );
      return {
        status: 'retry',
        resolvedMatches: result.resolvedMatches,
        message: 'Reconciliation state changed before completion',
      };
    }
    return {
      status: 'resolved',
      resolvedMatches: result.resolvedMatches,
      message: 'LP reconciliation complete',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return retry(message);
  }
}
