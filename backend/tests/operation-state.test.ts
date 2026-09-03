import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadOperationState() {
  return import('../src/runtime/operation-state.js');
}

beforeEach(() => {
  vi.resetModules();
});

describe('operation state', () => {
  it('starts idle', async () => {
    const state = await loadOperationState();
    expect(state.isOperationBusy()).toBe(false);
  });
  it('reports busy while a refresh is in progress', async () => {
    const state = await loadOperationState();
    state.setRefreshInProgress(true);
    expect(state.isOperationBusy()).toBe(true);
    state.setRefreshInProgress(false);
    expect(state.isOperationBusy()).toBe(false);
  });
  it('reports busy while an event lifecycle operation is in progress', async () => {
    const state = await loadOperationState();
    state.setLifecycleInProgress(true);
    expect(state.isOperationBusy()).toBe(true);
    state.setLifecycleInProgress(false);
    expect(state.isOperationBusy()).toBe(false);
  });
  it('stays busy until both operation flags are cleared', async () => {
    const state = await loadOperationState();
    state.setRefreshInProgress(true);
    state.setLifecycleInProgress(true);
    expect(state.isOperationBusy()).toBe(true);
    state.setRefreshInProgress(false);
    expect(state.isOperationBusy()).toBe(true);
    state.setLifecycleInProgress(false);
    expect(state.isOperationBusy()).toBe(false);
  });
  it('allows the flags to be changed independently', async () => {
    const state = await loadOperationState();
    state.setRefreshInProgress(true);
    state.setLifecycleInProgress(false);
    expect(state.isOperationBusy()).toBe(true);
    state.setRefreshInProgress(false);
    state.setLifecycleInProgress(true);
    expect(state.isOperationBusy()).toBe(true);
    state.setLifecycleInProgress(false);
    expect(state.isOperationBusy()).toBe(false);
  });
});
