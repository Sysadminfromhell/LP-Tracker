import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runDatabaseDiagnostics: vi.fn(),
  runEventDiagnostics: vi.fn(),
  runQueueDiagnostics: vi.fn(),
  runProviderDiagnostics: vi.fn(),
}));
vi.mock('../src/diagnostics/database', () => ({
  runDatabaseDiagnostics: mocks.runDatabaseDiagnostics,
}));
vi.mock('../src/diagnostics/event', () => ({
  runEventDiagnostics: mocks.runEventDiagnostics,
}));
vi.mock('../src/diagnostics/queue', () => ({
  runQueueDiagnostics: mocks.runQueueDiagnostics,
}));
vi.mock('../src/diagnostics/provider', () => ({
  runProviderDiagnostics: mocks.runProviderDiagnostics,
}));

import { runSummaryDiagnostics } from '../src/diagnostics/summary';

function mockDatabaseOk(): void {
  mocks.runDatabaseDiagnostics.mockResolvedValue({
    scope: 'database',
    generatedAt: '2026-09-21T20:00:00.000Z',
    status: 'ok',
    checks: [],
  });
}
function mockEventOk(): void {
  mocks.runEventDiagnostics.mockResolvedValue({
    scope: 'event',
    generatedAt: '2026-09-21T20:00:00.000Z',
    status: 'ok',
    checks: [],
  });
}
function mockQueueOk(): void {
  mocks.runQueueDiagnostics.mockResolvedValue({
    scope: 'queue',
    generatedAt: '2026-09-21T20:00:00.000Z',
    status: 'ok',
    checks: [],
  });
}
function mockProviderOk(): void {
  mocks.runProviderDiagnostics.mockResolvedValue({
    scope: 'provider',
    generatedAt: '2026-09-21T20:00:00.000Z',
    status: 'ok',
    checks: [],
  });
}

describe('summary diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns ok when all diagnostic scopes are healthy', async () => {
    mocks.runDatabaseDiagnostics.mockResolvedValue({
      scope: 'database',
      generatedAt: '2026-09-21T20:00:00.000Z',
      status: 'ok',
      checks: [
        {
          code: 'DATABASE_CONNECTION',
          status: 'ok',
          message: 'Database connected',
        },
      ],
    });
    mocks.runEventDiagnostics.mockResolvedValue({
      scope: 'event',
      generatedAt: '2026-09-21T20:00:00.000Z',
      status: 'ok',
      checks: [
        {
          code: 'ACTIVE_EVENT_COUNT',
          status: 'ok',
          message: 'At most one active event exists',
        },
      ],
    });
    mocks.runQueueDiagnostics.mockResolvedValue({
      scope: 'queue',
      generatedAt: '2026-09-21T20:00:00.000Z',
      status: 'ok',
      checks: [
        {
          code: 'RECONCILIATION_QUEUE_COVERAGE',
          status: 'ok',
          message: 'Queue coverage is complete',
        },
      ],
    });
    mockProviderOk();
    const report = await runSummaryDiagnostics();
    expect(report.scope).toBe('summary');
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual([
      {
        code: 'SUMMARY_DATABASE',
        status: 'ok',
        message: 'Database diagnostics completed with status ok',
        details: {
          checks: 1,
          warnings: [],
          errors: [],
        },
      },
      {
        code: 'SUMMARY_EVENT',
        status: 'ok',
        message: 'Event diagnostics completed with status ok',
        details: {
          checks: 1,
          warnings: [],
          errors: [],
        },
      },
      {
        code: 'SUMMARY_QUEUE',
        status: 'ok',
        message: 'Queue diagnostics completed with status ok',
        details: {
          checks: 1,
          warnings: [],
          errors: [],
        },
      },
      {
        code: 'SUMMARY_PROVIDER',
        status: 'ok',
        message: 'Provider diagnostics completed with status ok',
        details: {
          checks: 0,
          warnings: [],
          errors: [],
        },
      },
    ]);
  });
  it('returns warning when one diagnostic scope contains warnings', async () => {
    mockDatabaseOk();
    mockEventOk();
    mockProviderOk();
    mocks.runQueueDiagnostics.mockResolvedValue({
      scope: 'queue',
      generatedAt: '2026-09-21T20:00:00.000Z',
      status: 'warning',
      checks: [
        {
          code: 'RECONCILIATION_QUEUE_ERRORS',
          status: 'warning',
          message: 'Queue contains previous errors',
        },
        {
          code: 'RECONCILIATION_QUEUE_COVERAGE',
          status: 'warning',
          message: 'Queue coverage is incomplete',
        },
      ],
    });
    const report = await runSummaryDiagnostics();
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'SUMMARY_QUEUE',
      status: 'warning',
      message: 'Queue diagnostics completed with status warning',
      details: {
        checks: 2,
        warnings: ['RECONCILIATION_QUEUE_ERRORS', 'RECONCILIATION_QUEUE_COVERAGE'],
        errors: [],
      },
    });
  });
  it('returns error when one diagnostic scope contains errors', async () => {
    mockDatabaseOk();
    mockQueueOk();
    mockProviderOk();
    mocks.runEventDiagnostics.mockResolvedValue({
      scope: 'event',
      generatedAt: '2026-09-21T20:00:00.000Z',
      status: 'error',
      checks: [
        {
          code: 'EVENT_END_SNAPSHOTS',
          status: 'error',
          message: 'Final snapshots are incomplete',
        },
      ],
    });
    const report = await runSummaryDiagnostics();
    expect(report.status).toBe('error');
    expect(report.checks).toContainEqual({
      code: 'SUMMARY_EVENT',
      status: 'error',
      message: 'Event diagnostics completed with status error',
      details: {
        checks: 1,
        warnings: [],
        errors: ['EVENT_END_SNAPSHOTS'],
      },
    });
  });
  it('runs every top-level diagnostic scope once', async () => {
    mockDatabaseOk();
    mockEventOk();
    mockQueueOk();
    mockProviderOk();
    await runSummaryDiagnostics();
    expect(mocks.runDatabaseDiagnostics).toHaveBeenCalledTimes(1);
    expect(mocks.runProviderDiagnostics).toHaveBeenCalledTimes(1);
    expect(mocks.runEventDiagnostics).toHaveBeenCalledTimes(1);
    expect(mocks.runQueueDiagnostics).toHaveBeenCalledTimes(1);
  });
});
