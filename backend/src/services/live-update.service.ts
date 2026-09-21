import type { ServerResponse } from 'node:http';
import type {
  LiveUpdateEvent,
  PlayerRefreshedLiveUpdate,
  ProviderHealthLiveUpdate,
} from '@lp-tracker/contracts';

type EmptyLiveUpdateEvent = Exclude<LiveUpdateEvent, 'player-refreshed' | 'provider-health'>;

const clients = new Set<ServerResponse>();

export function addLiveUpdateClient(response: ServerResponse): () => void {
  clients.add(response);
  return () => {
    clients.delete(response);
  };
}

export function broadcastLiveUpdate(event: EmptyLiveUpdateEvent): void;
export function broadcastLiveUpdate(
  event: 'player-refreshed',
  data: PlayerRefreshedLiveUpdate,
): void;
export function broadcastLiveUpdate(event: 'provider-health', data: ProviderHealthLiveUpdate): void;
export function broadcastLiveUpdate(event: LiveUpdateEvent, data: object = {}): void {
  const message = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
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
