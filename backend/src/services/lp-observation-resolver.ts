export interface LpObservationMatchReference {
  id: string;
  createdAt: string;
  durationSeconds: number | null;
  result: 'WIN' | 'LOSE';
}

export interface LpRankObservationReference {
  rankScore: number;
  observedAt: string;
}
export interface LpObservationResolutionOptions {
  rightRankScore?: number | null;
  rightBoundaryAt?: string | null;
}
export interface ResolvedObservationLpDelta {
  matchId: string;
  lpDelta: number;
  rankScoreAfter: number;
}
interface TimedMatch {
  id: string;
  createdAt: number;
  endAt: number | null;
  result: 'WIN' | 'LOSE';
}
interface TimedObservation {
  rankScore: number;
  observedAt: number;
}

function parseTimestamp(value: string, label: string): number {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return timestamp;
}
function isValidDelta(result: 'WIN' | 'LOSE', delta: number): boolean {
  if (result === 'WIN') {
    return delta > 0;
  }

  return delta < 0;
}

export function resolveLpObservationDeltas(
  previousRankScore: number,
  matches: LpObservationMatchReference[],
  observations: LpRankObservationReference[],
  options: LpObservationResolutionOptions = {},
): ResolvedObservationLpDelta[] {
  if (!Number.isFinite(previousRankScore)) {
    throw new Error(`Invalid previous rank score: ${previousRankScore}`);
  }
  const rightRankScore = options.rightRankScore ?? null;
  const rightBoundaryAt =
    options.rightBoundaryAt === undefined || options.rightBoundaryAt === null
      ? null
      : parseTimestamp(options.rightBoundaryAt, 'right boundary');
  if (rightRankScore !== null && !Number.isFinite(rightRankScore)) {
    throw new Error(`Invalid right rank score: ${rightRankScore}`);
  }
  const timedMatches: TimedMatch[] = matches
    .map((match) => {
      const createdAt = parseTimestamp(match.createdAt, 'match timestamp');
      const durationValid =
        match.durationSeconds !== null &&
        Number.isFinite(match.durationSeconds) &&
        match.durationSeconds > 0;
      return {
        id: match.id,
        createdAt,
        endAt: durationValid ? createdAt + match.durationSeconds! * 1000 : null,
        result: match.result,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const timedObservations: TimedObservation[] = observations
    .map((observation) => {
      if (!Number.isFinite(observation.rankScore)) {
        throw new Error(`Invalid observation rank score: ${observation.rankScore}`);
      }

      return {
        rankScore: observation.rankScore,
        observedAt: parseTimestamp(observation.observedAt, 'observation timestamp'),
      };
    })
    .sort((a, b) => a.observedAt - b.observedAt);
  if (timedMatches.length === 0) {
    return [];
  }
  const resolutions: ResolvedObservationLpDelta[] = [];
  let previousScore = previousRankScore;
  for (let index = 0; index < timedMatches.length - 1; index++) {
    const match = timedMatches[index];
    const nextMatch = timedMatches[index + 1];
    if (match.endAt === null || match.endAt >= nextMatch.createdAt) {
      break;
    }
    const scores = new Set(
      timedObservations
        .filter(
          (observation) =>
            observation.observedAt > match.endAt! && observation.observedAt < nextMatch.createdAt,
        )
        .map((observation) => observation.rankScore),
    );
    if (scores.size !== 1) {
      break;
    }
    const rankScoreAfter = [...scores][0];
    if (rankScoreAfter === previousScore) {
      break;
    }
    const lpDelta = rankScoreAfter - previousScore;
    if (!isValidDelta(match.result, lpDelta)) {
      break;
    }
    resolutions.push({
      matchId: match.id,
      lpDelta,
      rankScoreAfter,
    });
    previousScore = rankScoreAfter;
  }
  if (
    resolutions.length !== timedMatches.length - 1 ||
    rightRankScore === null ||
    rightBoundaryAt === null
  ) {
    return resolutions;
  }
  const finalMatch = timedMatches.at(-1);
  if (!finalMatch || finalMatch.endAt === null || finalMatch.endAt >= rightBoundaryAt) {
    return resolutions;
  }
  const lpDelta = rightRankScore - previousScore;
  if (!isValidDelta(finalMatch.result, lpDelta)) {
    return resolutions;
  }
  resolutions.push({
    matchId: finalMatch.id,
    lpDelta,
    rankScoreAfter: rightRankScore,
  });
  return resolutions;
}
