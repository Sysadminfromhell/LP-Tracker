import { db } from './client';
import { getEventMatchDetails, type EventMatchDetails } from './event-match-details';

export async function findEventMatchDetails(
  eventId: number,
  playerId: number,
  providerMatchId: string,
): Promise<EventMatchDetails | null> {
  return getEventMatchDetails(db, eventId, playerId, providerMatchId);
}
