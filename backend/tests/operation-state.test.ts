import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('operation state', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('starts with no lifecycle operation in progress', async () => {
    const state = await import('../src/runtime/operation-state.js');

    expect(state.getOperationState()).toEqual({
      lifecycleInProgress: false,
    });
  });

  it('tracks lifecycle operations', async () => {
    const state = await import('../src/runtime/operation-state.js');

    state.setLifecycleInProgress(true);

    expect(state.getOperationState()).toEqual({
      lifecycleInProgress: true,
    });

    state.setLifecycleInProgress(false);

    expect(state.getOperationState()).toEqual({
      lifecycleInProgress: false,
    });
  });
});
