import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  testDatabaseConnection: vi.fn(),
  runMigrations: vi.fn(),
  ensureInitialAdmin: vi.fn(),
  deleteAllAdminSessions: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  getLeaderboardMeta: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  testDatabaseConnection: mocks.testDatabaseConnection,
}));
vi.mock('../src/db/migrations', () => ({
  runMigrations: mocks.runMigrations,
}));
vi.mock('../src/db/admins', () => ({
  ensureInitialAdmin: mocks.ensureInitialAdmin,
}));
vi.mock('../src/db/admin-sessions', () => ({
  deleteAllAdminSessions: mocks.deleteAllAdminSessions,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
  getLeaderboardMeta: mocks.getLeaderboardMeta,
}));

import { bootstrapApplication } from '../src/runtime/bootstrap';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.testDatabaseConnection.mockResolvedValue(undefined);
  mocks.runMigrations.mockResolvedValue(undefined);
  mocks.ensureInitialAdmin.mockResolvedValue(undefined);
  mocks.deleteAllAdminSessions.mockResolvedValue(3);
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  mocks.getLeaderboardMeta.mockReturnValue({
    event: {
      id: 1,
      name: 'Test Event',
      status: 'active',
    },
    totalPlayers: 10,
    cachedPlayers: 8,
  });
});

describe('application bootstrap', () => {
  it('initializes the application in the required order', async () => {
    await bootstrapApplication();
    expect(mocks.testDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(mocks.runMigrations).toHaveBeenCalledTimes(1);
    expect(mocks.ensureInitialAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAllAdminSessions).toHaveBeenCalledTimes(1);
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.getLeaderboardMeta).toHaveBeenCalledTimes(1);
    expect(mocks.testDatabaseConnection.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.runMigrations.mock.invocationCallOrder[0],
    );
    expect(mocks.runMigrations.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.ensureInitialAdmin.mock.invocationCallOrder[0],
    );
    expect(mocks.ensureInitialAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAllAdminSessions.mock.invocationCallOrder[0],
    );
    expect(mocks.deleteAllAdminSessions.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadLeaderboardFromDatabase.mock.invocationCallOrder[0],
    );
    expect(mocks.loadLeaderboardFromDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getLeaderboardMeta.mock.invocationCallOrder[0],
    );
  });
  it('invalidates all existing admin sessions during startup', async () => {
    mocks.deleteAllAdminSessions.mockResolvedValue(7);
    await bootstrapApplication();
    expect(mocks.deleteAllAdminSessions).toHaveBeenCalledTimes(1);
  });
  it('returns the loaded leaderboard metadata', async () => {
    const meta = {
      event: {
        id: 1,
        name: 'Test Event',
        status: 'active',
      },
      totalPlayers: 10,
      cachedPlayers: 8,
    };
    mocks.getLeaderboardMeta.mockReturnValue(meta);
    const result = await bootstrapApplication();
    expect(result).toBe(meta);
  });
  it('stops startup when migrations fail', async () => {
    mocks.runMigrations.mockRejectedValue(new Error('Migration failed'));
    await expect(bootstrapApplication()).rejects.toThrow('Migration failed');
    expect(mocks.ensureInitialAdmin).not.toHaveBeenCalled();
    expect(mocks.deleteAllAdminSessions).not.toHaveBeenCalled();
    expect(mocks.loadLeaderboardFromDatabase).not.toHaveBeenCalled();
  });
});
