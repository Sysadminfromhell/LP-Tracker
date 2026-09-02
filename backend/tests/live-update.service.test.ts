import type { ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addLiveUpdateClient,
  broadcastLiveUpdate,
  closeLiveUpdateClients,
} from '../src/services/live-update.service';

interface FakeResponseState {
  destroyed: boolean;
  writableEnded: boolean;
  writes: string[];
  endCalls: number;
}

function createFakeResponse(): {
  response: ServerResponse;
  state: FakeResponseState;
} {
  const state: FakeResponseState = {
    destroyed: false,
    writableEnded: false,
    writes: [],
    endCalls: 0,
  };
  const response = {
    get destroyed() {
      return state.destroyed;
    },
    get writableEnded() {
      return state.writableEnded;
    },
    write(chunk: string) {
      state.writes.push(chunk);
      return true;
    },
    end() {
      state.endCalls += 1;
      state.writableEnded = true;
      return response;
    },
  } as unknown as ServerResponse;
  return {
    response,
    state,
  };
}
afterEach(() => {
  closeLiveUpdateClients();
});
describe('live update service', () => {
  it('broadcasts leaderboard events to connected clients', () => {
    const { response, state } = createFakeResponse();
    addLiveUpdateClient(response);
    broadcastLiveUpdate('leaderboard');
    expect(state.writes).toEqual(['event: leaderboard\ndata: {}\n\n']);
  });
  it('broadcasts to all connected clients', () => {
    const first = createFakeResponse();
    const second = createFakeResponse();
    addLiveUpdateClient(first.response);
    addLiveUpdateClient(second.response);
    broadcastLiveUpdate('leaderboard');
    expect(first.state.writes).toHaveLength(1);
    expect(second.state.writes).toHaveLength(1);
  });
  it('stops broadcasting after a client is removed', () => {
    const { response, state } = createFakeResponse();
    const removeClient = addLiveUpdateClient(response);
    removeClient();
    broadcastLiveUpdate('leaderboard');
    expect(state.writes).toHaveLength(0);
  });
  it('removes destroyed clients automatically', () => {
    const { response, state } = createFakeResponse();
    addLiveUpdateClient(response);
    state.destroyed = true;
    broadcastLiveUpdate('leaderboard');
    expect(state.writes).toHaveLength(0);
    state.destroyed = false;
    broadcastLiveUpdate('leaderboard');
    expect(state.writes).toHaveLength(0);
  });
  it('closes all connected clients during shutdown', () => {
    const first = createFakeResponse();
    const second = createFakeResponse();
    addLiveUpdateClient(first.response);
    addLiveUpdateClient(second.response);
    closeLiveUpdateClients();
    expect(first.state.endCalls).toBe(1);
    expect(second.state.endCalls).toBe(1);
    broadcastLiveUpdate('leaderboard');
    expect(first.state.writes).toHaveLength(0);
    expect(second.state.writes).toHaveLength(0);
  });
  it('does not end clients that already finished', () => {
    const { response, state } = createFakeResponse();
    state.writableEnded = true;
    addLiveUpdateClient(response);
    closeLiveUpdateClients();
    expect(state.endCalls).toBe(0);
  });
});
