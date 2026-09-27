export interface LpObservationMatchReference {
  id: string;
  createdAt: string;
  durationSeconds: number | null;
  result: 'WIN' | 'LOSE';
}

export interface LpRankObservationReference {
  id?: number;
  rankScore: number;
  observedAt: string;
}
export interface LpObservationResolutionOptions {
  rightRankScore?: number | null;
  rightBoundaryAt?: string | null;
  onDiagnostic?: (message: string) => void;
}
export interface ResolvedObservationLpDelta {
  matchId: string;
  lpDelta: number;
  rankScoreAfter: number;
  observationId?: number;
}
interface TimedMatch {
  id: string;
  startAt: number | null;
  endAt: number;
  result: 'WIN' | 'LOSE';
}
interface TimedObservation {
  id: number | null;
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
  const reportDiagnostic = (message: string): void => {
    options.onDiagnostic?.(message);
  };
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
      const endAt = parseTimestamp(match.createdAt, 'match timestamp');
      const durationValid =
        match.durationSeconds !== null &&
        Number.isFinite(match.durationSeconds) &&
        match.durationSeconds > 0;
      return {
        id: match.id,
        startAt: durationValid ? endAt - match.durationSeconds! * 1000 : null,
        endAt,
        result: match.result,
      };
    })
    .sort((a, b) => a.endAt - b.endAt || a.id.localeCompare(b.id));
  const timedObservations: TimedObservation[] = observations
    .map((observation) => {
      if (!Number.isFinite(observation.rankScore)) {
        throw new Error(`Invalid observation rank score: ${observation.rankScore}`);
      }
      if (
        observation.id !== undefined &&
        (!Number.isInteger(observation.id) || observation.id <= 0)
      ) {
        throw new Error(`Invalid observation id: ${observation.id}`);
      }
      return {
        id: observation.id ?? null,
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
    if (nextMatch.startAt === null) {
      reportDiagnostic(`Match ${match.id}: next match start cannot be determined`);
      break;
    }
    if (match.endAt >= nextMatch.startAt) {
      reportDiagnostic(`Match ${match.id}: match window overlaps next match`);
      break;
    }
    const matchingObservations = timedObservations.filter(
      (observation) =>
        observation.observedAt > match.endAt && observation.observedAt < nextMatch.startAt!,
    );
    if (matchingObservations.length === 0) {
      reportDiagnostic(
        `Match ${match.id}: no rank observation between match end and next match start`,
      );
      break;
    }
    const validObservations = matchingObservations.filter((observation) =>
      isValidDelta(match.result, observation.rankScore - previousScore),
    );
    if (validObservations.length === 0) {
      const observedScores = [
        ...new Set(matchingObservations.map((observation) => observation.rankScore)),
      ];
      reportDiagnostic(
        `Match ${match.id}: no valid ${match.result} LP change from ` +
          `${previousScore}; observed rank score(s): ${observedScores.join(', ')}`,
      );
      break;
    }
    const scores = new Set(validObservations.map((observation) => observation.rankScore));
    if (scores.size !== 1) {
      reportDiagnostic(
        `Match ${match.id}: conflicting valid rank scores: ` + `${[...scores].join(', ')}`,
      );
      break;
    }
    const rankScoreAfter = [...scores][0];
    const evidenceObservation = validObservations.find(
      (observation) => observation.rankScore === rankScoreAfter,
    );
    if (!evidenceObservation) {
      break;
    }
    const lpDelta = rankScoreAfter - previousScore;
    resolutions.push({
      matchId: match.id,
      lpDelta,
      rankScoreAfter,
      ...(evidenceObservation.id !== null ? { observationId: evidenceObservation.id } : {}),
    });
    previousScore = rankScoreAfter;
  }
  if (resolutions.length !== timedMatches.length - 1) {
    return resolutions;
  }
  const finalMatch = timedMatches.at(-1);
  if (!finalMatch) {
    return resolutions;
  }
  const finalObservations = timedObservations.filter(
    (observation) =>
      observation.observedAt > finalMatch.endAt &&
      (rightBoundaryAt === null || observation.observedAt < rightBoundaryAt),
  );
  if (finalObservations.length === 0) {
    reportDiagnostic(`Match ${finalMatch.id}: no rank observation after match end`);
  }
  const validFinalObservations = finalObservations.filter((observation) =>
    isValidDelta(finalMatch.result, observation.rankScore - previousScore),
  );
  if (finalObservations.length > 0 && validFinalObservations.length === 0) {
    const observedScores = [
      ...new Set(finalObservations.map((observation) => observation.rankScore)),
    ];
    reportDiagnostic(
      `Match ${finalMatch.id}: no valid ${finalMatch.result} LP change from ` +
        `${previousScore}; observed rank score(s): ${observedScores.join(', ')}`,
    );
  }
  const finalObservationScores = new Set(
    validFinalObservations.map((observation) => observation.rankScore),
  );
  if (finalObservationScores.size > 1) {
    reportDiagnostic(
      `Match ${finalMatch.id}: conflicting valid rank scores after match: ` +
        `${[...finalObservationScores].join(', ')}`,
    );
    reportDiagnostic(`Match ${finalMatch.id}: no usable rank observation or right rank anchor`);
    return resolutions;
  }
  if (finalObservationScores.size === 1) {
    const rankScoreAfter = [...finalObservationScores][0];
    const evidenceObservation = validFinalObservations.find(
      (observation) => observation.rankScore === rankScoreAfter,
    );
    if (!evidenceObservation) {
      return resolutions;
    }
    const lpDelta = rankScoreAfter - previousScore;
    resolutions.push({
      matchId: finalMatch.id,
      lpDelta,
      rankScoreAfter,
      ...(evidenceObservation.id !== null ? { observationId: evidenceObservation.id } : {}),
    });
    return resolutions;
  }
  if (rightRankScore === null || rightBoundaryAt === null || finalMatch.endAt >= rightBoundaryAt) {
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
