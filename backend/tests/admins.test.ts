import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  verify: vi.fn(),
  hash: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));
vi.mock('argon2', () => ({
  argon2id: 2,
  hash: mocks.hash,
  verify: mocks.verify,
}));

import { authenticateAdmin } from '../src/db/admins';

const adminRow = {
  id: '1',
  username: 'admin',
  password_hash: '$argon2id$real-hash',
  enabled: true,
  created_at: new Date('2026-09-01T00:00:00.000Z'),
  updated_at: new Date('2026-09-01T00:00:00.000Z'),
  last_login_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue(false);
});

describe('admin authentication', () => {
  it('performs password verification for an unknown username', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });
    const result = await authenticateAdmin('unknown', 'wrong-password');
    expect(result).toBeNull();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'wrong-password',
    );
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('performs password verification for a disabled admin', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          ...adminRow,
          enabled: false,
        },
      ],
      rowCount: 1,
    });
    const result = await authenticateAdmin('admin', 'wrong-password');
    expect(result).toBeNull();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledWith(adminRow.password_hash, 'wrong-password');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('rejects an invalid password after verification', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [adminRow],
      rowCount: 1,
    });
    mocks.verify.mockResolvedValueOnce(false);
    const result = await authenticateAdmin('admin', 'wrong-password');
    expect(result).toBeNull();
    expect(mocks.verify).toHaveBeenCalledWith(adminRow.password_hash, 'wrong-password');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('returns the admin and updates last login after successful verification', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [adminRow],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });
    mocks.verify.mockResolvedValueOnce(true);
    const result = await authenticateAdmin('admin', 'correct-password');
    expect(result).not.toBeNull();
    expect(result?.username).toBe('admin');
    expect(mocks.verify).toHaveBeenCalledWith(adminRow.password_hash, 'correct-password');
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE admins'), [
      adminRow.id,
    ]);
  });
});
