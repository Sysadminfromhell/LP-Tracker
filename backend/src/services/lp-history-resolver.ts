import type { RankedLpHistoryEntry } from '../providers/league-data.types';
import { calculateRankScore } from '../rank';

export interface LpHistoryMatchReference {
  id: string;
  createdAt: string;
}
export interface ResolvedMatchLpDelta {
  matchId: string;
  lpDelta: number;
  rankScoreAfter: number;
}
export interface LpHistoryResolutionOptions {
  rightBoundaryAt?: string | null;
}
interface ScoredHistoryEntry {
  createdAt: number;
  rankScore: number;
}

export function resolveLpHistoryDeltas(
  previousRankScore: number,
  matches: LpHistoryMatchReference[],
  lpHistory: RankedLpHistoryEntry[],
  options: LpHistoryResolutionOptions = {},
): ResolvedMatchLpDelta[] {
  const rankedMatches = [...matches].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const history: ScoredHistoryEntry[] = lpHistory
    .map((entry) => {
      const rankScore = calculateRankScore(entry.tier, entry.division, entry.lp);
      if (rankScore === null) {
        return null;
      }
      return {
        createdAt: new Date(entry.createdAt).getTime(),
        rankScore,
      };
    })
    .filter((entry): entry is ScoredHistoryEntry => entry !== null)
    .sort((a, b) => a.createdAt - b.createdAt);

  let rightBoundary = Number.POSITIVE_INFINITY;
  if (options.rightBoundaryAt !== undefined && options.rightBoundaryAt !== null) {
    rightBoundary = new Date(options.rightBoundaryAt).getTime();
    if (!Number.isFinite(rightBoundary)) {
      throw new Error(`Invalid LP history right boundary: ${options.rightBoundaryAt}`);
    }
  }

  const resolutions: ResolvedMatchLpDelta[] = [];
  let previousScore = previousRankScore;
  let historyIndex = 0;

  for (let index = 0; index < rankedMatches.length; index++) {
    const match = rankedMatches[index];
    const windowStart = new Date(match.createdAt).getTime();
    const nextMatch = rankedMatches[index + 1];
    const windowEnd = nextMatch ? new Date(nextMatch.createdAt).getTime() : rightBoundary;
    while (historyIndex < history.length && history[historyIndex].createdAt < windowStart) {
      historyIndex++;
    }
    const candidates: ScoredHistoryEntry[] = [];
    let candidateIndex = historyIndex;
    while (candidateIndex < history.length && history[candidateIndex].createdAt < windowEnd) {
      candidates.push(history[candidateIndex]);
      candidateIndex++;
    }
    if (candidates.length !== 1) {
      break;
    }
    const rankScoreAfter = candidates[0].rankScore;
    resolutions.push({
      matchId: match.id,
      lpDelta: rankScoreAfter - previousScore,
      rankScoreAfter,
    });
    previousScore = rankScoreAfter;
    historyIndex = candidateIndex;
  }
  return resolutions;
}
