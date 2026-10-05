import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '@lp-tracker/contracts';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminHealth: vi.fn(),
}));
vi.mock('../src/auth/admin-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('../src/services/health.service', () => ({
  getAdminHealth: mocks.getAdminHealth,
}));

import { createApp } from '../src/app';
import { adminHealthRoutes } from '../src/routes/admin-health.routes';

const health: HealthResponse = {
  status: 'ok',
  build: {
    version: '2.5.6',
    gitHead: 'abc1234',
  },
  database: {
    connected: true,
  },
  provider: {
    name: 'riot',
    connected: true,
    rateLimit: {
      buckets: [
        {
          limit: 100,
          count: 17,
          windowSeconds: 120,
        },
      ],
      restricted: false,
    },
    warning: null,
  },
  event: {
    id: 42,
    status: 'active',
  },
  players: {
    enabled: 10,
    event: 8,
    cached: 8,
  },
  scheduler: {
    targetRefreshMs: 10_000,
    spacingMs: 5_000,
    spacingSeconds: 5,
  },
};

async function createTestApp() {
  const app = createApp();
  await app.register(adminHealthRoutes);
  await app.ready();
  return app;
}

describe('admin health routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      id: 1,
      username: 'admin',
    });
    mocks.getAdminHealth.mockResolvedValue(health);
  });
  it('returns detailed health information for an authenticated admin', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(health);
      expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
      expect(mocks.getAdminHealth).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
  it('rejects unauthenticated health requests before loading diagnostics', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'Authentication required',
      });
      expect(mocks.getAdminHealth).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
