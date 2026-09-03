import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const mocks = vi.hoisted(() => ({
  addLiveUpdateClient: vi.fn(),
  removeClient: vi.fn(),
}));

vi.mock('../src/services/live-update.service', () => ({
  addLiveUpdateClient: mocks.addLiveUpdateClient,
}));

import { liveUpdateRoutes } from '../src/routes/live-update.routes';

type RouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

function createRawResponse() {
  const raw = new EventEmitter() as EventEmitter & {
    writeHead: ReturnType<typeof vi.fn>;
    flushHeaders: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    destroyed: boolean;
    writableEnded: boolean;
  };
  raw.writeHead = vi.fn();
  raw.flushHeaders = vi.fn();
  raw.write = vi.fn();
  raw.destroyed = false;
  raw.writableEnded = false;
  return raw;
}

async function getRouteHandler(): Promise<RouteHandler> {
  let handler: RouteHandler | null = null;
  const app = {
    get: vi.fn((path: string, routeHandler: RouteHandler) => {
      expect(path).toBe('/api/live');
      handler = routeHandler;
    }),
  } as unknown as FastifyInstance;
  await liveUpdateRoutes(app);
  if (!handler) {
    throw new Error('Live update route was not registered');
  }
  return handler;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.addLiveUpdateClient.mockReturnValue(mocks.removeClient);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('live update route', () => {
  it('initializes an SSE connection with the expected headers', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    expect(reply.hijack).toHaveBeenCalledTimes(1);
    expect(raw.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(raw.flushHeaders).toHaveBeenCalledTimes(1);
  });
  it('sends the SSE retry directive immediately', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    expect(raw.write).toHaveBeenCalledWith('retry: 5000\n\n');
  });
  it('registers the raw response as a live update client', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    expect(mocks.addLiveUpdateClient).toHaveBeenCalledTimes(1);
    expect(mocks.addLiveUpdateClient).toHaveBeenCalledWith(raw);
  });
  it('sends a heartbeat every 15 seconds', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    raw.write.mockClear();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(raw.write).toHaveBeenCalledTimes(1);
    expect(raw.write).toHaveBeenCalledWith(': keep-alive\n\n');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(raw.write).toHaveBeenCalledTimes(2);
  });
  it('does not send heartbeat data to destroyed connections', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    raw.write.mockClear();
    raw.destroyed = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(raw.write).not.toHaveBeenCalled();
  });
  it('does not send heartbeat data to ended connections', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    raw.write.mockClear();
    raw.writableEnded = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(raw.write).not.toHaveBeenCalled();
  });
  it('removes the client and stops heartbeat on close', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    raw.write.mockClear();
    raw.emit('close');
    expect(mocks.removeClient).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(raw.write).not.toHaveBeenCalled();
  });
  it('removes the client and stops heartbeat on error', async () => {
    const handler = await getRouteHandler();
    const raw = createRawResponse();
    const reply = {
      hijack: vi.fn(),
      raw,
    } as unknown as FastifyReply;
    await handler({} as FastifyRequest, reply);
    raw.write.mockClear();
    raw.emit('error', new Error('socket exploded'));
    expect(mocks.removeClient).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(raw.write).not.toHaveBeenCalled();
  });
});
