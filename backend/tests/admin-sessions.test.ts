import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import {
  createAdminSession,
  deleteAdminSession,
  deleteAllAdminSessions,
  deleteExpiredAdminSessions,
  getAdminBySessionToken,
} from '../src/db/admin-sessions';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T00:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('admin sessions', () => {
  it('creates a session with a 12 hour expiry and stores only the hashed token', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [],
    });
    const session = await createAdminSession(42);
    expect(session.token).toBeTruthy();
    expect(session.expiresAt).toBe('2026-09-05T12:00:00.000Z');
    const expectedHash = hashToken(session.token);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_sessions'),
      [42, expectedHash, new Date('2026-09-05T12:00:00.000Z')],
    );
    const [, params] = mocks.query.mock.calls[0];
    expect(params[1]).toBe(expectedHash);
    expect(params[1]).not.toBe(session.token);
  });
  it('returns null when the session does not resolve to an active admin', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });
    const token = 'invalid-session-token';
    const result = await getAdminBySessionToken(token);
    expect(result).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('s.expires_at > NOW()');
    expect(sql).toContain('a.enabled = TRUE');
    expect(params).toEqual([hashToken(token)]);
  });
  it('returns the admin for a valid session and updates last_used_at', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            admin_id: '7',
            username: 'admin',
            enabled: true,
            admin_created_at: new Date('2026-09-01T10:00:00.000Z'),
            admin_updated_at: new Date('2026-09-02T11:00:00.000Z'),
            last_login_at: new Date('2026-09-04T20:00:00.000Z'),
            expires_at: new Date('2026-09-05T12:00:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [],
      });
    const token = 'valid-session-token';
    const result = await getAdminBySessionToken(token);
    expect(result).toEqual({
      id: 7,
      username: 'admin',
      enabled: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T11:00:00.000Z',
      lastLoginAt: '2026-09-04T20:00:00.000Z',
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE admin_sessions'),
      [hashToken(token)],
    );
  });
  it('deletes a session using the hashed token', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [],
    });
    const token = 'session-token';
    await deleteAdminSession(token);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM admin_sessions'),
      [hashToken(token)],
    );
  });
  it('deletes expired sessions and returns the deleted row count', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 3,
      rows: [],
    });
    const deleted = await deleteExpiredAdminSessions();
    expect(deleted).toBe(3);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain('DELETE FROM admin_sessions');
    expect(sql).toContain('expires_at <= NOW()');
  });
  it('deletes all sessions and returns the deleted row count', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 5,
      rows: [],
    });
    const deleted = await deleteAllAdminSessions();
    expect(deleted).toBe(5);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain('DELETE FROM admin_sessions');
    expect(sql).not.toContain('WHERE');
  });
});
