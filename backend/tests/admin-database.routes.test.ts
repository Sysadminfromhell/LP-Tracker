import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminDatabaseDeleteEndedEventResponse,
  AdminDatabaseMaintenanceAllResponse,
  AdminDatabaseMaintenanceResponse,
  AdminDatabaseMatchDetailsPruneResponse,
  AdminDatabaseOverviewResponse,
  AdminDatabasePlayerCacheCleanupResponse,
  AdminDatabaseResetResponse,
  AdminDatabaseTableDetailsResponse,
} from '@lp-tracker/contracts';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminDatabaseOverview: vi.fn(),
  getAdminDatabaseTableDetails: vi.fn(),
  runAdminDatabaseMaintenance: vi.fn(),
  resetAdminDatabase: vi.fn(),
  runAdminDatabaseMaintenanceAll: vi.fn(),
  clearAdminDatabasePlayerCache: vi.fn(),
  pruneAdminDatabaseMatchDetails: vi.fn(),
  deleteAdminDatabaseEndedEvent: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  broadcastLiveUpdate: vi.fn(),
}));
vi.mock('../src/auth/admin-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('../src/db/admin-database', () => ({
  getAdminDatabaseOverview: mocks.getAdminDatabaseOverview,
}));
vi.mock('../src/db/admin-database-maintenance', () => ({
  runAdminDatabaseMaintenance: mocks.runAdminDatabaseMaintenance,
}));
vi.mock('../src/db/admin-database-table-details', () => ({
  getAdminDatabaseTableDetails: mocks.getAdminDatabaseTableDetails,
}));
vi.mock('../src/db/admin-database-reset', () => ({
  resetAdminDatabase: mocks.resetAdminDatabase,
}));
vi.mock('../src/db/admin-database-maintenance-all', () => ({
  runAdminDatabaseMaintenanceAll: mocks.runAdminDatabaseMaintenanceAll,
}));
vi.mock('../src/db/admin-database-player-cache-cleanup', () => ({
  clearAdminDatabasePlayerCache: mocks.clearAdminDatabasePlayerCache,
}));
vi.mock('../src/db/admin-database-match-details-prune', () => ({
  pruneAdminDatabaseMatchDetails: mocks.pruneAdminDatabaseMatchDetails,
}));
vi.mock('../src/db/admin-database-delete-ended-event', () => ({
  deleteAdminDatabaseEndedEvent: mocks.deleteAdminDatabaseEndedEvent,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/services/live-update.service', () => ({
  broadcastLiveUpdate: mocks.broadcastLiveUpdate,
}));

import { createApp } from '../src/app';
import { adminDatabaseRoutes } from '../src/routes/admin-database.routes';

const overview: AdminDatabaseOverviewResponse = {
  database: {
    name: 'lp_tracker',
    serverVersion: '18.6',
    sizeBytes: 104857600,
  },
  totals: {
    tables: 2,
    indexes: 7,
    invalidIndexes: 0,
    estimatedRows: 1220,
    deadRows: 27,
    tableSizeBytes: 5308416,
    indexSizeBytes: 2195456,
    totalSizeBytes: 7503872,
  },
  tables: [
    {
      name: 'event_matches',
      estimatedRows: 1200,
      deadRows: 25,
      tableSizeBytes: 5242880,
      indexSizeBytes: 2097152,
      totalSizeBytes: 7340032,
      indexCount: 4,
      invalidIndexCount: 0,
      lastVacuumAt: null,
      lastAutovacuumAt: '2026-09-22T06:00:00.000Z',
      lastAnalyzeAt: null,
      lastAutoanalyzeAt: '2026-09-22T06:05:00.000Z',
    },
    {
      name: 'players',
      estimatedRows: 20,
      deadRows: 2,
      tableSizeBytes: 65536,
      indexSizeBytes: 98304,
      totalSizeBytes: 163840,
      indexCount: 3,
      invalidIndexCount: 0,
      lastVacuumAt: '2026-09-21T20:00:00.000Z',
      lastAutovacuumAt: null,
      lastAnalyzeAt: '2026-09-21T20:05:00.000Z',
      lastAutoanalyzeAt: null,
    },
  ],
  relationships: [],
};
const tableDetails: AdminDatabaseTableDetailsResponse = {
  table: {
    name: 'event_matches',
    schema: 'public',
    label: 'Event Matches',
    group: 'matches',
    sensitive: false,
    maintenance: true,
  },
  statistics: {
    name: 'event_matches',
    estimatedRows: 1200,
    deadRows: 25,
    tableSizeBytes: 5242880,
    indexSizeBytes: 2097152,
    totalSizeBytes: 7340032,
    indexCount: 4,
    invalidIndexCount: 0,
    lastVacuumAt: null,
    lastAutovacuumAt: '2026-09-22T06:00:00.000Z',
    lastAnalyzeAt: null,
    lastAutoanalyzeAt: '2026-09-22T06:05:00.000Z',
  },
  columns: [
    {
      name: 'id',
      ordinalPosition: 1,
      dataType: 'bigint',
      nullable: false,
      defaultValue: "nextval('event_matches_id_seq'::regclass)",
    },
    {
      name: 'event_participant_id',
      ordinalPosition: 2,
      dataType: 'bigint',
      nullable: false,
      defaultValue: null,
    },
  ],
  constraints: [
    {
      name: 'event_matches_pkey',
      type: 'PRIMARY KEY',
      columns: ['id'],
      definition: 'PRIMARY KEY (id)',
    },
    {
      name: 'event_matches_event_participant_id_fkey',
      type: 'FOREIGN KEY',
      columns: ['event_participant_id'],
      definition:
        'FOREIGN KEY (event_participant_id) REFERENCES event_participants(id) ON DELETE CASCADE',
    },
  ],
  indexes: [
    {
      name: 'event_matches_pkey',
      columns: ['id'],
      unique: true,
      primary: true,
      valid: true,
      ready: true,
      sizeBytes: 16384,
      definition: 'CREATE UNIQUE INDEX event_matches_pkey ON public.event_matches USING btree (id)',
    },
  ],
  relationships: {
    outgoing: [
      {
        constraintName: 'event_matches_event_participant_id_fkey',
        sourceTable: 'event_matches',
        sourceColumns: ['event_participant_id'],
        targetTable: 'event_participants',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
    ],
    incoming: [
      {
        constraintName: 'event_match_details_event_match_id_fkey',
        sourceTable: 'event_match_details',
        sourceColumns: ['event_match_id'],
        targetTable: 'event_matches',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
    ],
  },
};
const maintenanceResult: AdminDatabaseMaintenanceResponse = {
  tableName: 'event_matches',
  operation: 'vacuum_analyze',
  completedAt: '2026-09-22T12:00:00.000Z',
};
const resetResult: AdminDatabaseResetResponse = {
  resetAt: '2026-09-22T13:30:00.000Z',
  restartRequired: true,
};
const maintenanceAllResult: AdminDatabaseMaintenanceAllResponse = {
  operation: 'analyze',
  completedAt: '2026-09-22T14:45:00.000Z',
  results: [
    {
      tableName: 'players',
      completed: true,
      error: null,
    },
    {
      tableName: 'event_matches',
      completed: true,
      error: null,
    },
  ],
};
const playerCacheCleanupResult: AdminDatabasePlayerCacheCleanupResponse = {
  clearedEntries: 42,
  completedAt: '2026-09-23T11:30:00.000Z',
};
const matchDetailsPruneResult: AdminDatabaseMatchDetailsPruneResponse = {
  olderThanDays: 90,
  cutoffAt: '2026-06-25T12:00:00.000Z',
  deletedMatchDetails: 12,
  deletedMatchParticipants: 120,
  completedAt: '2026-09-23T12:00:00.000Z',
};
const deleteEndedEventResult: AdminDatabaseDeleteEndedEventResponse = {
  eventId: 42,
  eventName: 'August LP Event',
  deletedAt: '2026-09-23T13:00:00.000Z',
};

async function createTestApp() {
  const app = createApp();
  await app.register(adminDatabaseRoutes);
  await app.ready();
  return app;
}

describe('admin database routes', () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.getAdminDatabaseOverview.mockReset();
    mocks.getAdminDatabaseTableDetails.mockReset();
    mocks.requireAdmin.mockResolvedValue({
      id: 1,
      username: 'admin',
    });
    mocks.getAdminDatabaseOverview.mockResolvedValue(overview);
    mocks.getAdminDatabaseTableDetails.mockResolvedValue(tableDetails);
    mocks.runAdminDatabaseMaintenance.mockReset();
    mocks.runAdminDatabaseMaintenance.mockResolvedValue(maintenanceResult);
    mocks.resetAdminDatabase.mockReset();
    mocks.resetAdminDatabase.mockResolvedValue(resetResult);
    mocks.runAdminDatabaseMaintenanceAll.mockReset();
    mocks.runAdminDatabaseMaintenanceAll.mockResolvedValue(maintenanceAllResult);
    mocks.clearAdminDatabasePlayerCache.mockReset();
    mocks.clearAdminDatabasePlayerCache.mockResolvedValue(playerCacheCleanupResult);
    mocks.pruneAdminDatabaseMatchDetails.mockReset();
    mocks.pruneAdminDatabaseMatchDetails.mockResolvedValue(matchDetailsPruneResult);
    mocks.deleteAdminDatabaseEndedEvent.mockReset();
    mocks.deleteAdminDatabaseEndedEvent.mockResolvedValue(deleteEndedEventResult);
    mocks.loadLeaderboardFromDatabase.mockReset();
    mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
    mocks.broadcastLiveUpdate.mockReset();
  });
  it('returns database overview for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/database/overview',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(overview);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminDatabaseOverview).toHaveBeenCalledTimes(1);
    await app.close();
  });
  it('rejects unauthenticated database overview requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/database/overview',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Authentication required',
    });
    expect(mocks.getAdminDatabaseOverview).not.toHaveBeenCalled();
    await app.close();
  });
  it('returns table details for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/database/tables/event_matches',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(tableDetails);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminDatabaseTableDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminDatabaseTableDetails).toHaveBeenCalledWith('event_matches');
    await app.close();
  });
  it('returns 404 for a database table outside the registry', async () => {
    mocks.getAdminDatabaseTableDetails.mockResolvedValueOnce(null);
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/database/tables/pg_authid',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Database table not found',
    });
    expect(mocks.getAdminDatabaseTableDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminDatabaseTableDetails).toHaveBeenCalledWith('pg_authid');
    await app.close();
  });
  it('rejects unauthenticated table detail requests before loading metadata', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/database/tables/event_matches',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Authentication required',
    });
    expect(mocks.getAdminDatabaseTableDetails).not.toHaveBeenCalled();
    await app.close();
  });
  it('runs database maintenance for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/tables/event_matches/maintenance',
      payload: {
        operation: 'vacuum_analyze',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(maintenanceResult);
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledTimes(1);
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledWith(
      'event_matches',
      'vacuum_analyze',
    );
    await app.close();
  });
  it('rejects unauthenticated database maintenance requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/tables/event_matches/maintenance',
      payload: {
        operation: 'analyze',
      },
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.runAdminDatabaseMaintenance).not.toHaveBeenCalled();
    await app.close();
  });
  it('returns 404 when database maintenance is not allowed', async () => {
    mocks.runAdminDatabaseMaintenance.mockResolvedValueOnce(null);
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/tables/schema_migrations/maintenance',
      payload: {
        operation: 'analyze',
      },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Database table not found or maintenance not allowed',
    });
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledWith('schema_migrations', 'analyze');
    await app.close();
  });
  it('rejects unsupported maintenance operations before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/tables/event_matches/maintenance',
      payload: {
        operation: 'vacuum_full',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.runAdminDatabaseMaintenance).not.toHaveBeenCalled();
    await app.close();
  });
  it('resets the application for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/reset',
      payload: {
        confirmation: 'RESET_APPLICATION',
        acknowledgement: 'I understand',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(resetResult);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.resetAdminDatabase).toHaveBeenCalledTimes(1);
    await app.close();
  });
  it('rejects unauthenticated application reset requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/reset',
      payload: {
        confirmation: 'RESET_APPLICATION',
        acknowledgement: 'I understand',
      },
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.resetAdminDatabase).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects an invalid reset acknowledgement before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/reset',
      payload: {
        confirmation: 'RESET_APPLICATION',
        acknowledgement: 'I Understand',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.resetAdminDatabase).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects an invalid reset confirmation before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/reset',
      payload: {
        confirmation: 'RESET',
        acknowledgement: 'I understand',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.resetAdminDatabase).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects an incomplete reset request before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/reset',
      payload: {
        confirmation: 'RESET_APPLICATION',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.resetAdminDatabase).not.toHaveBeenCalled();
    await app.close();
  });
  it('runs database maintenance across all managed tables', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/maintenance',
      payload: {
        operation: 'analyze',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(maintenanceAllResult);
    expect(mocks.runAdminDatabaseMaintenanceAll).toHaveBeenCalledTimes(1);
    expect(mocks.runAdminDatabaseMaintenanceAll).toHaveBeenCalledWith('analyze');
    await app.close();
  });
  it('rejects unauthenticated all-table maintenance requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });

      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/maintenance',
      payload: {
        operation: 'vacuum_analyze',
      },
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.runAdminDatabaseMaintenanceAll).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects unsupported all-table maintenance operations before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/maintenance',
      payload: {
        operation: 'vacuum_full',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.runAdminDatabaseMaintenanceAll).not.toHaveBeenCalled();
    await app.close();
  });
  it('clears the player cache for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/player-cache',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(playerCacheCleanupResult);
    expect(mocks.clearAdminDatabasePlayerCache).toHaveBeenCalledTimes(1);
    await app.close();
  });
  it('rejects unauthenticated player cache cleanup requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/player-cache',
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.clearAdminDatabasePlayerCache).not.toHaveBeenCalled();
    await app.close();
  });
  it('prunes historical match details for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/match-details',
      payload: {
        olderThanDays: 90,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(matchDetailsPruneResult);
    expect(mocks.pruneAdminDatabaseMatchDetails).toHaveBeenCalledTimes(1);
    expect(mocks.pruneAdminDatabaseMatchDetails).toHaveBeenCalledWith(90);
    await app.close();
  });
  it('rejects unauthenticated match details prune requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/match-details',
      payload: {
        olderThanDays: 90,
      },
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.pruneAdminDatabaseMatchDetails).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects invalid match details retention before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/match-details',
      payload: {
        olderThanDays: 6,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.pruneAdminDatabaseMatchDetails).not.toHaveBeenCalled();
    await app.close();
  });
  it('permanently deletes an ended event for an authenticated admin', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/42/delete',
      payload: {
        confirmation: 'DELETE_ENDED_EVENT',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(deleteEndedEventResult);
    expect(mocks.deleteAdminDatabaseEndedEvent).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAdminDatabaseEndedEvent).toHaveBeenCalledWith(42);
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('events-changed');
    await app.close();
  });
  it('rejects unauthenticated ended event deletion requests', async () => {
    mocks.requireAdmin.mockImplementationOnce(async (_request, reply) => {
      await reply.code(401).send({
        error: 'Authentication required',
      });
      return null;
    });
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/42/delete',
      payload: {
        confirmation: 'DELETE_ENDED_EVENT',
      },
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.deleteAdminDatabaseEndedEvent).not.toHaveBeenCalled();
    expect(mocks.loadLeaderboardFromDatabase).not.toHaveBeenCalled();
    expect(mocks.broadcastLiveUpdate).not.toHaveBeenCalled();
    await app.close();
  });
  it('returns 404 when the event does not exist', async () => {
    mocks.deleteAdminDatabaseEndedEvent.mockRejectedValueOnce(new Error('EVENT_NOT_FOUND'));
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/42/delete',
      payload: {
        confirmation: 'DELETE_ENDED_EVENT',
      },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Event not found',
    });
    expect(mocks.deleteAdminDatabaseEndedEvent).toHaveBeenCalledWith(42);
    await app.close();
  });
  it('returns 409 when the event has not ended', async () => {
    mocks.deleteAdminDatabaseEndedEvent.mockRejectedValueOnce(new Error('EVENT_NOT_ENDED'));
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/42/delete',
      payload: {
        confirmation: 'DELETE_ENDED_EVENT',
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'Only ended events can be permanently deleted',
    });
    expect(mocks.deleteAdminDatabaseEndedEvent).toHaveBeenCalledWith(42);
    await app.close();
  });
  it('rejects an invalid event deletion confirmation before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/42/delete',
      payload: {
        confirmation: 'DELETE_EVENT',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.deleteAdminDatabaseEndedEvent).not.toHaveBeenCalled();
    await app.close();
  });
  it('rejects an invalid event id before execution', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/database/cleanup/events/0/delete',
      payload: {
        confirmation: 'DELETE_ENDED_EVENT',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.deleteAdminDatabaseEndedEvent).not.toHaveBeenCalled();
    await app.close();
  });
});
