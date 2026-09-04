import type { ServerResponse } from 'node:http';

export type LiveUpdateEvent = 'leaderboard' | 'player-refreshed';
export interface PlayerRefreshedLiveUpdate {
  playerId: number;
  lastUpdated: string;
}

const clients = new Set<ServerResponse>();

export function addLiveUpdateClient(response: ServerResponse): () => void {
  clients.add(response);
  return () => {
    clients.delete(response);
  };
}
export function broadcastLiveUpdate(event: 'leaderboard'): void;
export function broadcastLiveUpdate(
  event: 'player-refreshed',
  data: PlayerRefreshedLiveUpdate,
): void;
export function broadcastLiveUpdate(
  event: LiveUpdateEvent,
  data: object = {},
): void {
  const message =
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.destroyed || client.writableEnded) {
      clients.delete(client);
      continue;
    }
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}
export function closeLiveUpdateClients(): void {
  for (const client of clients) {
    if (!client.writableEnded) {
      client.end();
    }
  }

  clients.clear();
}