import type { SummonerMatch } from '../providers/league-data.types';

const MATCH_FETCH_LIMITS = [5, 20, 50, 100] as const;

export interface MatchSyncCursor {
  providerMatchId: string;
  gameCreatedAt: string;
}
export interface IncrementalMatchSyncResult {
  matches: SummonerMatch[];
  requestedLimit: number;
  anchorReached: boolean;
}

type MatchFetcher = (limit: number) => Promise<SummonerMatch[]>;
export async function fetchIncrementalMatches(
  fetchMatches: MatchFetcher,
  eventStartsAt: string,
  cursor: MatchSyncCursor | null,
): Promise<IncrementalMatchSyncResult> {
  const eventStartTimestamp = new Date(eventStartsAt).getTime();
  if (!Number.isFinite(eventStartTimestamp)) {
    throw new Error('Invalid event start timestamp');
  }
  const collectedMatches = new Map<string, SummonerMatch>();
  let requestedLimit: number = MATCH_FETCH_LIMITS[0];
  for (const limit of MATCH_FETCH_LIMITS) {
    requestedLimit = limit;
    const matches = await fetchMatches(limit);
    for (const match of matches) {
      collectedMatches.set(match.id, match);
    }
    if (matches.length === 0) {
      return {
        matches: [],
        requestedLimit,
        anchorReached: true,
      };
    }
    const cursorIdReached =
      cursor !== null && matches.some((match) => match.id === cursor.providerMatchId);
    const cursorTimestamp = cursor === null ? null : new Date(cursor.gameCreatedAt).getTime();
    const cursorTimestampReached =
      cursorTimestamp !== null &&
      Number.isFinite(cursorTimestamp) &&
      matches.some((match) => new Date(match.createdAt).getTime() <= cursorTimestamp);
    const eventStartReached = matches.some(
      (match) => new Date(match.createdAt).getTime() <= eventStartTimestamp,
    );
    if (cursorIdReached || cursorTimestampReached || eventStartReached) {
      return {
        matches: [...collectedMatches.values()],
        requestedLimit,
        anchorReached: true,
      };
    }
  }
  return {
    matches: [...collectedMatches.values()],
    requestedLimit,
    anchorReached: false,
  };
}
