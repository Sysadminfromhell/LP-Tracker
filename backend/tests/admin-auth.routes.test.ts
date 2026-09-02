import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Admin } from '../src/db/admins';

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  createAdminSession: vi.fn(),
  deleteAdminSession: vi.fn(),
  getAdminBySessionToken: vi.fn(),
}));
vi.mock('../src/db/admins', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
}));
vi.mock('../src/db/admin-sessions', () => ({
  createAdminSession: mocks.createAdminSession,
  deleteAdminSession: mocks.deleteAdminSession,
  getAdminBySessionToken: mocks.getAdminBySessionToken,
}));

import { createApp } from '../src/app';
import { adminAuthRoutes } from '../src/routes/admin-auth.routes';
import { ADMIN_COOKIE_NAME } from '../src/auth/admin-auth';

const originalNodeEnv = process.env.NODE_ENV;
const admin: Admin = {
  id: 1,
  username: 'admin',
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  lastLoginAt: '2026-09-02T20:00:00.000Z',
};

async function createTestApp(): Promise<FastifyInstance> {
  const app = createApp();
  await app.register(adminAuthRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'development';
  mocks.authenticateAdmin.mockResolvedValue(null);
  mocks.createAdminSession.mockResolvedValue({
    token: 'session-token',
    expiresAt: '2026-09-03T08:00:00.000Z',
  });
  mocks.deleteAdminSession.mockResolvedValue(undefined);
  mocks.getAdminBySessionToken.mockResolvedValue(null);
});

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('admin auth routes', () => {
  it('rejects login requests without username or password', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: {
          username: 'admin',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Username and password are required',
      });
      expect(mocks.authenticateAdmin).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects invalid credentials', async () => {
    mocks.authenticateAdmin.mockResolvedValue(null);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: {
          username: 'admin',
          password: 'wrong-password',
        },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'Invalid username or password',
      });
      expect(mocks.authenticateAdmin).toHaveBeenCalledWith('admin', 'wrong-password');
      expect(mocks.createAdminSession).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('logs in an admin and creates a session cookie', async () => {
    mocks.authenticateAdmin.mockResolvedValue(admin);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: {
          username: '  admin  ',
          password: 'correct-password',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.authenticateAdmin).toHaveBeenCalledWith('admin', 'correct-password');
      expect(mocks.createAdminSession).toHaveBeenCalledWith(admin.id);
      expect(response.json()).toEqual({
        ok: true,
        admin: {
          id: admin.id,
          username: admin.username,
        },
      });
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(String(setCookie)).toContain(`${ADMIN_COOKIE_NAME}=session-token`);
      expect(String(setCookie)).toContain('HttpOnly');
      expect(String(setCookie)).toContain('SameSite=Strict');
    } finally {
      await app.close();
    }
  });
  it('rejects /me without a valid session', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/me',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'Authentication required',
      });
    } finally {
      await app.close();
    }
  });
  it('returns the authenticated admin from /me', async () => {
    mocks.getAdminBySessionToken.mockResolvedValue(admin);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/me',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=session-token`,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.getAdminBySessionToken).toHaveBeenCalledWith('session-token');
      expect(response.json()).toEqual({
        authenticated: true,
        admin: {
          id: admin.id,
          username: admin.username,
          lastLoginAt: admin.lastLoginAt,
        },
      });
    } finally {
      await app.close();
    }
  });
  it('logs out and deletes the current session', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/logout',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=session-token`,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.deleteAdminSession).toHaveBeenCalledWith('session-token');
      expect(response.json()).toEqual({
        ok: true,
      });
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(String(setCookie)).toContain(`${ADMIN_COOKIE_NAME}=`);
    } finally {
      await app.close();
    }
  });
  it('still logs out when deleting the DB session fails', async () => {
    mocks.deleteAdminSession.mockRejectedValue(new Error('DB exploded'));
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/logout',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=session-token`,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
  it('rate limits repeated login attempts', async () => {
    mocks.authenticateAdmin.mockResolvedValue(null);
    const app = await createTestApp();
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/admin/login',
          payload: {
            username: 'admin',
            password: 'wrong-password',
          },
        });
        expect(response.statusCode).toBe(401);
      }
      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: {
          username: 'admin',
          password: 'wrong-password',
        },
      });
      expect(blockedResponse.statusCode).toBe(429);
      expect(mocks.authenticateAdmin).toHaveBeenCalledTimes(5);
    } finally {
      await app.close();
    }
  });
});
