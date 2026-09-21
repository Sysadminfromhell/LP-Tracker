export interface PlayerOverlayRouteParams {
  eventId: number;
  playerId: number;
}
export function getLegacyRedirect(hash: string): string | null {
  if (hash === '#admin') {
    return '/admin';
  }
  if (hash === '#overlay_generator') {
    return '/overlay-generator';
  }
  if (hash.startsWith('#overlay?')) {
    return `/overlay${hash.slice('#overlay'.length)}`;
  }
  return null;
}
export function createPlayerOverlayPath({ eventId, playerId }: PlayerOverlayRouteParams): string {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new Error('Invalid event id');
  }
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error('Invalid player id');
  }
  return `/overlay/events/${eventId}/players/${playerId}`;
}
