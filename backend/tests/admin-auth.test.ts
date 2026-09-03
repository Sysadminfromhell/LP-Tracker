import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Admin } from '../src/db/admins';

const mocks = vi.hoisted(() => ({
  getAdminBySessionToken: vi.fn(),
}));

vi.mock('../src/db/admin-sessions', () => ({
  getAdminBySessionToken: mocks.getAdminBySessionToken,
}));

import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  getRequestAdmin,
  requireAdmin,
} from '../src/auth/admin-auth';

const originalNodeEnv = process.env.NODE_ENV;
const admin: Admin = {
  id: 1,
  username: 'admin',
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  lastLoginAt: null,
};

function createRequest(token?: string): FastifyRequest {
  return {
    cookies:
      token === undefined
        ? {}
        : {
            [ADMIN_COOKIE_NAME]: token,
          },
  } as unknown as FastifyRequest;
}
function createReply() {
  const reply = {
    clearCookie: vi.fn(),
    code: vi.fn(),
    send: vi.fn(),
  };
  reply.code.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply as unknown as FastifyReply & {
    clearCookie: ReturnType<typeof vi.fn>;
    code: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('admin auth', () => {
  it('uses secure cookies in production', () => {
    process.env.NODE_ENV = 'production';
    expect(getAdminCookieOptions()).toEqual({
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
  });
  it('uses non-secure cookies outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(getAdminCookieOptions()).toEqual({
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    });
  });
  it('returns null when no admin session cookie exists', async () => {
    const request = createRequest();
    const result = await getRequestAdmin(request);
    expect(result).toBeNull();
    expect(mocks.getAdminBySessionToken).not.toHaveBeenCalled();
  });
  it('resolves the admin from the session cookie', async () => {
    mocks.getAdminBySessionToken.mockResolvedValue(admin);
    const request = createRequest('session-token');
    const result = await getRequestAdmin(request);
    expect(result).toBe(admin);
    expect(mocks.getAdminBySessionToken).toHaveBeenCalledWith('session-token');
  });
  it('returns the authenticated admin without touching the reply', async () => {
    mocks.getAdminBySessionToken.mockResolvedValue(admin);
    const request = createRequest('session-token');
    const reply = createReply();
    const result = await requireAdmin(request, reply);
    expect(result).toBe(admin);
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(reply.clearCookie).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests with 401', async () => {
    const request = createRequest();
    const reply = createReply();
    const result = await requireAdmin(request, reply);
    expect(result).toBeNull();
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Authentication required',
    });
    expect(reply.clearCookie).not.toHaveBeenCalled();
  });
  it('clears an invalid session cookie before returning 401', async () => {
    process.env.NODE_ENV = 'production';
    mocks.getAdminBySessionToken.mockResolvedValue(null);
    const request = createRequest('expired-token');
    const reply = createReply();
    const result = await requireAdmin(request, reply);
    expect(result).toBeNull();
    expect(mocks.getAdminBySessionToken).toHaveBeenCalledWith('expired-token');
    expect(reply.clearCookie).toHaveBeenCalledWith(ADMIN_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Authentication required',
    });
  });
});
