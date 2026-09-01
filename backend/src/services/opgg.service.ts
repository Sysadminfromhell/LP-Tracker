import { OpggClient } from '../opgg/client';

let opgg: OpggClient | null = null;
let opggConnected = false;
let opggConnectPromise: Promise<OpggClient> | null = null;

export async function getOpggClient(): Promise<OpggClient> {
  if (opgg && opggConnected) {
    return opgg;
  }

  if (opggConnectPromise) {
    return opggConnectPromise;
  }

  opggConnectPromise = (async () => {
    const client = new OpggClient();

    try {
      console.log('[OP.GG] Connecting...');

      await client.connect();

      opgg = client;
      opggConnected = true;

      console.log('[OP.GG] Connected ✓');

      return client;
    } catch (error) {
      opggConnected = false;
      opgg = null;

      await client.disconnect().catch(() => {});

      throw error;
    } finally {
      opggConnectPromise = null;
    }
  })();

  return opggConnectPromise;
}

export function isOpggConnected(): boolean {
  return opggConnected;
}

export async function disconnectOpgg(): Promise<void> {
  if (!opgg) {
    return;
  }

  await opgg.disconnect().catch(() => {});

  opgg = null;
  opggConnected = false;
}
