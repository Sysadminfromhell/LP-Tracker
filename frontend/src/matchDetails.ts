export type MatchParticipantSide = 'ALLY' | 'ENEMY';
export type MatchParticipantPosition = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'UNKNOWN';

export interface MatchDetailParticipant {
  side: MatchParticipantSide;
  position: MatchParticipantPosition;
  championId: number;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  laneCs: number;
  jungleCs: number;
  cs: number;
  damageToChampions: number;
  items: string[];
  isTrackedPlayer: boolean;
}

export interface MatchDetailsResponse {
  matchId: string;
  durationSeconds: number;
  participants: MatchDetailParticipant[];
}

const detailCache = new Map<string, MatchDetailsResponse>();
const pendingRequests = new Map<string, Promise<MatchDetailsResponse | null>>();

function getCacheKey(eventId: number, playerId: number, matchId: string): string {
  return `${eventId}:${playerId}:${matchId}`;
}

export function getCachedMatchDetails(
  eventId: number,
  playerId: number,
  matchId: string,
): MatchDetailsResponse | null {
  return detailCache.get(getCacheKey(eventId, playerId, matchId)) ?? null;
}

export async function loadMatchDetails(
  eventId: number,
  playerId: number,
  matchId: string,
): Promise<MatchDetailsResponse | null> {
  const key = getCacheKey(eventId, playerId, matchId);
  const cached = detailCache.get(key);
  if (cached) {
    return cached;
  }
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }
  const request = (async () => {
    const response = await fetch(
      `/api/events/${eventId}/players/${playerId}/matches/` + encodeURIComponent(matchId),
      {
        cache: 'no-store',
      },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Match detail API returned HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(
        'Match detail API returned unexpected ' + `Content-Type: ${contentType ?? 'unknown'}`,
      );
    }
    const details = (await response.json()) as MatchDetailsResponse;
    detailCache.set(key, details);
    return details;
  })();
  pendingRequests.set(key, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(key);
  }
}
