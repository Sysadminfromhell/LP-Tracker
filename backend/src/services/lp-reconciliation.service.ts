import {
  applyLpReconciliationResolutions,
  completeLpReconciliation,
  getLpReconciliationContext,
  retryLpReconciliation,
} from '../db/lp-reconciliation';
import { calculateRankScore } from '../rank';
import { getLeagueDataProvider } from './league-data.service';
import { resolveLpHistoryDeltas } from './lp-history-resolver';

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
  const retry = async (message: string): Promise<LpReconciliationRunResult> => {
    await retryLpReconciliation(
      eventParticipantId,
      getLpReconciliationRetryDelaySeconds(attemptCount),
      message,
    );
    return {
      status: 'retry',
      resolvedMatches: 0,
      message,
    };
  };
  try {
    const context = await getLpReconciliationContext(eventParticipantId);
    if (!context || context.unresolvedMatches.length === 0) {
      await completeLpReconciliation(eventParticipantId);

      return {
        status: 'complete',
        resolvedMatches: 0,
        message: 'No unresolved matches',
      };
    }
    if (context.eventStatus !== 'active' && context.eventStatus !== 'ended') {
      await completeLpReconciliation(eventParticipantId);
      return {
        status: 'complete',
        resolvedMatches: 0,
        message: `Event is ${context.eventStatus}`,
      };
    }
    const provider = await getLeagueDataProvider();
    const profile = await provider.getSummonerProfile(
      context.gameName,
      context.tagLine,
      context.region,
    );
    if (profile.lpHistory.length === 0) {
      return retry('No LP history available');
    }
    let expectedRightRankScore = context.rightRankScore;
    if (expectedRightRankScore === null && context.eventStatus === 'active') {
      const solo = profile.queues.find((queue) => queue.gameType === 'SOLORANKED');
      if (!solo) {
        return retry('No Solo Queue rank available');
      }
      expectedRightRankScore = calculateRankScore(solo.tier, solo.division, solo.lp);
      if (expectedRightRankScore === null) {
        return retry('Invalid Solo Queue rank');
      }
    }
    if (expectedRightRankScore === null) {
      return retry('No right rank anchor available');
    }
    const resolutions = resolveLpHistoryDeltas(
      context.leftRankScore,
      context.unresolvedMatches.map((match) => ({
        id: match.providerMatchId,
        createdAt: match.gameCreatedAt,
      })),
      profile.lpHistory,
      {
        rightBoundaryAt: context.rightBoundaryAt,
      },
    );
    if (resolutions.length !== context.unresolvedMatches.length) {
      return retry(`Resolved ${resolutions.length}/${context.unresolvedMatches.length} matches`);
    }
    const finalResolution = resolutions.at(-1);
    if (!finalResolution) {
      return retry('No LP resolutions produced');
    }
    if (finalResolution.rankScoreAfter !== expectedRightRankScore) {
      return retry(
        `LP chain ended at ${finalResolution.rankScoreAfter}, expected ${expectedRightRankScore}`,
      );
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
        await completeLpReconciliation(eventParticipantId);
        return {
          status: 'complete',
          resolvedMatches: 0,
          message: result.reason ?? 'Already resolved',
        };
      }
      return retry(result.reason ?? 'Could not apply LP reconciliation');
    }
    if (result.remainingUnresolved) {
      await retryLpReconciliation(eventParticipantId, 30, null);

      return {
        status: 'resolved',
        resolvedMatches: result.resolvedMatches,
        message: 'Resolved block, more unresolved matches remain',
      };
    }
    await completeLpReconciliation(eventParticipantId);
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
