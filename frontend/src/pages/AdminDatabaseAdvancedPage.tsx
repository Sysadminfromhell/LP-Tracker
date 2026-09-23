import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import AdminToastHost, {
  type AdminToastMessage,
  type AdminToastVariant,
} from '../components/AdminToastHost';
import AdminDatabasePanel from './AdminDatabasePanel';
import type {
  AdminDatabaseDeleteEndedEventResponse,
  AdminEvent,
  AdminEventsResponse,
  AdminDatabaseMaintenanceAllResponse,
  AdminDatabaseMaintenanceOperation,
  AdminDatabaseMatchDetailsPruneResponse,
  AdminDatabasePlayerCacheCleanupResponse,
  AdminDatabaseResetResponse,
  AdminDatabaseDeletePlayerResponse,
  AdminDatabasePlayerDeleteDependencies,
  AdminPlayer,
  AdminPlayersResponse,
} from '@lp-tracker/contracts';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import AdminResetConfirmDialog from '../components/AdminResetConfirmDialog';

const maintenanceAllLabels: Record<AdminDatabaseMaintenanceOperation, string> = {
  analyze: 'ANALYZE ALL',
  vacuum_analyze: 'VACUUM ANALYZE ALL',
  reindex_concurrently: 'REINDEX ALL',
};
const maintenanceAllMessages: Record<AdminDatabaseMaintenanceOperation, string> = {
  analyze: 'Run ANALYZE across all managed application tables?',
  vacuum_analyze: 'Run VACUUM ANALYZE across all managed application tables?',
  reindex_concurrently:
    'Rebuild indexes concurrently across all managed application tables? This operation may take some time.',
};

interface AdminDatabaseAdvancedPageProps {
  username: string;
  onLogout: () => void;
}

function AdminDatabaseAdvancedPage({ username, onLogout }: AdminDatabaseAdvancedPageProps) {
  const [toasts, setToasts] = useState<AdminToastMessage[]>([]);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [showResetFinalWarning, setShowResetFinalWarning] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [maintenanceOperation, setMaintenanceOperation] =
    useState<AdminDatabaseMaintenanceOperation | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [databaseRefreshKey, setDatabaseRefreshKey] = useState(0);
  const [showPlayerCacheCleanupWarning, setShowPlayerCacheCleanupWarning] = useState(false);
  const [playerCacheCleanupBusy, setPlayerCacheCleanupBusy] = useState(false);
  const [matchDetailsRetentionDays, setMatchDetailsRetentionDays] = useState(90);
  const [showMatchDetailsPruneWarning, setShowMatchDetailsPruneWarning] = useState(false);
  const [matchDetailsPruneBusy, setMatchDetailsPruneBusy] = useState(false);
  const [endedEvents, setEndedEvents] = useState<AdminEvent[]>([]);
  const [endedEventsLoading, setEndedEventsLoading] = useState(true);
  const [selectedEndedEventId, setSelectedEndedEventId] = useState<number | null>(null);
  const [showDeleteEndedEventWarning, setShowDeleteEndedEventWarning] = useState(false);
  const [deleteEndedEventBusy, setDeleteEndedEventBusy] = useState(false);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerDeleteDependencies, setPlayerDeleteDependencies] =
    useState<AdminDatabasePlayerDeleteDependencies | null>(null);
  const [playerDeleteDependenciesLoading, setPlayerDeleteDependenciesLoading] = useState(false);
  const [showDeletePlayerWarning, setShowDeletePlayerWarning] = useState(false);
  const [deletePlayerBusy, setDeletePlayerBusy] = useState(false);

  async function runMaintenanceAll() {
    if (!maintenanceOperation) {
      return;
    }
    setMaintenanceBusy(true);
    try {
      const response = await fetch('/api/admin/database/maintenance', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: maintenanceOperation,
        }),
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ?? `Database maintenance failed with status ${response.status}`,
        );
      }
      const result = (await response.json()) as AdminDatabaseMaintenanceAllResponse;
      const succeeded = result.results.filter((entry) => entry.completed).length;
      const failed = result.results.length - succeeded;
      setMaintenanceOperation(null);
      setDatabaseRefreshKey((value) => value + 1);
      if (failed > 0) {
        notify(
          'error',
          `${maintenanceAllLabels[result.operation]} completed: ${succeeded} succeeded, ${failed} failed.`,
        );
        return;
      }
      notify(
        'success',
        `${maintenanceAllLabels[result.operation]} completed successfully for ${succeeded} tables.`,
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Database maintenance failed.');
    } finally {
      setMaintenanceBusy(false);
    }
  }
  async function clearPlayerCache() {
    setPlayerCacheCleanupBusy(true);
    try {
      const response = await fetch('/api/admin/database/cleanup/player-cache', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ?? `Player cache cleanup failed with status ${response.status}`,
        );
      }
      const result = (await response.json()) as AdminDatabasePlayerCacheCleanupResponse;
      setShowPlayerCacheCleanupWarning(false);
      setDatabaseRefreshKey((value) => value + 1);
      notify('success', `Player cache cleared. ${result.clearedEntries} entries removed.`);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Player cache cleanup failed.');
    } finally {
      setPlayerCacheCleanupBusy(false);
    }
  }

  const matchDetailsRetentionValid =
    Number.isSafeInteger(matchDetailsRetentionDays) &&
    matchDetailsRetentionDays >= 7 &&
    matchDetailsRetentionDays <= 3650;

  async function pruneMatchDetails() {
    if (!matchDetailsRetentionValid) {
      return;
    }
    setMatchDetailsPruneBusy(true);
    try {
      const response = await fetch('/api/admin/database/cleanup/match-details', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          olderThanDays: matchDetailsRetentionDays,
        }),
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Match details prune failed with status ${response.status}`);
      }
      const result = (await response.json()) as AdminDatabaseMatchDetailsPruneResponse;
      setShowMatchDetailsPruneWarning(false);
      setDatabaseRefreshKey((value) => value + 1);
      notify(
        'success',
        `Historical match details pruned. ${result.deletedMatchDetails} match details and ${result.deletedMatchParticipants} participant records removed.`,
      );
    } catch (error) {
      notify(
        'error',
        error instanceof Error ? error.message : 'Historical match details prune failed.',
      );
    } finally {
      setMatchDetailsPruneBusy(false);
    }
  }

  const notify = useCallback((variant: AdminToastVariant, message: string) => {
    const toast: AdminToastMessage = {
      id: crypto.randomUUID(),
      variant,
      message,
    };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const loadEndedEvents = useCallback(async () => {
    setEndedEventsLoading(true);
    try {
      const response = await fetch('/api/admin/events', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(body?.error ?? `Could not load events with status ${response.status}`);
      }
      const data = (await response.json()) as AdminEventsResponse;
      const ended = data.events
        .filter((event) => event.status === 'ended')
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      setEndedEvents(ended);
      setSelectedEndedEventId((current) =>
        current !== null && ended.some((event) => event.id === current) ? current : null,
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not load ended events.');
    } finally {
      setEndedEventsLoading(false);
    }
  }, [notify, onLogout]);
  const loadPlayers = useCallback(async () => {
    setPlayersLoading(true);
    try {
      const response = await fetch('/api/admin/players', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Could not load players with status ${response.status}`);
      }
      const data = (await response.json()) as AdminPlayersResponse;
      setPlayers(data.players);
      setSelectedPlayerId((current) =>
        current !== null && data.players.some((player) => player.id === current) ? current : null,
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not load players.');
    } finally {
      setPlayersLoading(false);
    }
  }, [notify, onLogout]);
  const loadPlayerDeleteDependencies = useCallback(
    async (playerId: number) => {
      setPlayerDeleteDependenciesLoading(true);
      setPlayerDeleteDependencies(null);
      try {
        const response = await fetch(
          `/api/admin/database/cleanup/players/${playerId}/dependencies`,
          {
            credentials: 'include',
            cache: 'no-store',
          },
        );
        if (response.status === 401) {
          onLogout();
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ?? `Could not load player dependencies with status ${response.status}`,
          );
        }
        const result = (await response.json()) as AdminDatabasePlayerDeleteDependencies;
        setPlayerDeleteDependencies(result);
      } catch (error) {
        notify(
          'error',
          error instanceof Error ? error.message : 'Could not load player dependencies.',
        );
      } finally {
        setPlayerDeleteDependenciesLoading(false);
      }
    },
    [notify, onLogout],
  );

  useEffect(() => {
    void loadEndedEvents();
    void loadPlayers();
  }, [loadEndedEvents, loadPlayers]);
  useEffect(() => {
    if (selectedPlayerId === null) {
      setPlayerDeleteDependencies(null);
      return;
    }
    void loadPlayerDeleteDependencies(selectedPlayerId);
  }, [selectedPlayerId, loadPlayerDeleteDependencies]);

  async function resetApplication() {
    setResetBusy(true);
    try {
      const response = await fetch('/api/admin/database/reset', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation: 'RESET_APPLICATION',
          acknowledgement: 'I understand',
        }),
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Application reset failed with status ${response.status}`);
      }
      const result = (await response.json()) as AdminDatabaseResetResponse;
      setShowResetFinalWarning(false);
      setResetComplete(true);
      notify(
        'success',
        result.restartRequired
          ? 'Application reset complete. Restart the backend to bootstrap the initial admin.'
          : 'Application reset complete.',
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Application reset failed.');
    } finally {
      setResetBusy(false);
    }
  }
  async function deleteEndedEvent() {
    if (selectedEndedEventId === null) {
      return;
    }
    setDeleteEndedEventBusy(true);
    try {
      const response = await fetch(
        `/api/admin/database/cleanup/events/${selectedEndedEventId}/delete`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confirmation: 'DELETE_ENDED_EVENT',
          }),
        },
      );
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Event deletion failed with status ${response.status}`);
      }
      const result = (await response.json()) as AdminDatabaseDeleteEndedEventResponse;
      setShowDeleteEndedEventWarning(false);
      setSelectedEndedEventId(null);
      setDatabaseRefreshKey((value) => value + 1);
      await loadEndedEvents();
      notify('success', `Event "${result.eventName}" permanently deleted.`);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Event deletion failed.');
    } finally {
      setDeleteEndedEventBusy(false);
    }
  }
  async function deletePlayer() {
    if (selectedPlayerId === null || !playerDeleteDependencies?.canDelete) {
      return;
    }
    setDeletePlayerBusy(true);
    try {
      const response = await fetch(
        `/api/admin/database/cleanup/players/${selectedPlayerId}/delete`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confirmation: 'DELETE_PLAYER',
          }),
        },
      );
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Player deletion failed with status ${response.status}`);
      }
      const result = (await response.json()) as AdminDatabaseDeletePlayerResponse;
      setShowDeletePlayerWarning(false);
      setSelectedPlayerId(null);
      setPlayerDeleteDependencies(null);
      setDatabaseRefreshKey((value) => value + 1);
      await loadPlayers();
      notify('success', `Player "${result.playerName}" permanently deleted.`);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Player deletion failed.');
    } finally {
      setDeletePlayerBusy(false);
    }
  }
  function formatEventDateOnly(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  const selectedEndedEvent = endedEvents.find((event) => event.id === selectedEndedEventId) ?? null;
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const playerDeleteAllowed =
    selectedPlayer !== null &&
    playerDeleteDependencies !== null &&
    playerDeleteDependencies.playerId === selectedPlayer.id &&
    playerDeleteDependencies.canDelete;

  return (
    <main className="admin-page">
      <AdminToastHost toasts={toasts} onDismiss={dismissToast} />
      <section className="admin-shell">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">LP GAIN EVENT</span>
            <h1>Database Advanced</h1>
          </div>
          <div className="admin-topbar-actions">
            <Link className="admin-back-link admin-back-link-top" to="/admin">
              ← Back to Admin
            </Link>
            <div className="admin-user">
              <span>
                Logged in as <strong>{username}</strong>
              </span>
              <button className="admin-secondary-button" type="button" onClick={onLogout}>
                Logout
              </button>
            </div>
          </div>
        </header>
        <div className="admin-provider-warning" role="status">
          <div className="admin-provider-warning-icon">!</div>
          <div className="admin-provider-warning-content">
            <strong>Advanced database administration</strong>
            <p>
              This area exposes PostgreSQL internals and database maintenance operations.
              Destructive actions will require additional confirmation before execution.
            </p>
          </div>
        </div>
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">DATABASE MAINTENANCE</span>

              <h2>All Tables</h2>

              <p>Run PostgreSQL maintenance across all managed application tables.</p>
            </div>
          </div>

          <div className="admin-database-maintenance-actions">
            <button
              className="admin-secondary-button"
              type="button"
              disabled={maintenanceBusy}
              onClick={() => {
                setMaintenanceOperation('analyze');
              }}
            >
              ANALYZE ALL
            </button>

            <button
              className="admin-secondary-button"
              type="button"
              disabled={maintenanceBusy}
              onClick={() => {
                setMaintenanceOperation('vacuum_analyze');
              }}
            >
              VACUUM ANALYZE ALL
            </button>

            <button
              className="admin-secondary-button"
              type="button"
              disabled={maintenanceBusy}
              onClick={() => {
                setMaintenanceOperation('reindex_concurrently');
              }}
            >
              REINDEX ALL
            </button>
          </div>
        </section>
        <AdminDatabasePanel key={databaseRefreshKey} onUnauthorized={onLogout} onNotify={notify} />
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">DATABASE CLEANUP</span>
              <h2>Cleanup Tools</h2>
              <p>
                Remove rebuildable or historical database data without deleting core application
                records.
              </p>
            </div>
          </div>
          <div className="admin-database-cleanup-grid">
            <div className="admin-database-cleanup-card">
              <div>
                <strong>Clear player cache</strong>
                <p>
                  Removes all entries from the player cache without deleting players, events,
                  matches or other application data.
                </p>
                <p>Cache entries are rebuilt automatically when players are refreshed.</p>
              </div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={playerCacheCleanupBusy}
                onClick={() => {
                  setShowPlayerCacheCleanupWarning(true);
                }}
              >
                CLEAR PLAYER CACHE
              </button>
            </div>
            <div className="admin-database-cleanup-card">
              <div>
                <strong>Prune historical match details</strong>
                <p>
                  Removes detailed match and participant data from ended events older than the
                  selected retention period.
                </p>
                <p>Event history, matches, results and LP data are preserved.</p>
                <div className="admin-database-retention-control">
                  <label htmlFor="admin-match-details-retention">Retention</label>
                  <div className="admin-database-retention-input">
                    <input
                      id="admin-match-details-retention"
                      type="number"
                      min={7}
                      max={3650}
                      step={1}
                      value={matchDetailsRetentionDays}
                      disabled={matchDetailsPruneBusy}
                      onChange={(event) => {
                        setMatchDetailsRetentionDays(Number(event.target.value));
                      }}
                    />
                    <span>days</span>
                  </div>
                  <small>Allowed range: 7–3650 days</small>
                </div>
              </div>
              <button
                className="admin-danger-button"
                type="button"
                disabled={matchDetailsPruneBusy || !matchDetailsRetentionValid}
                onClick={() => {
                  setShowMatchDetailsPruneWarning(true);
                }}
              >
                PRUNE MATCH DETAILS
              </button>
            </div>
            <div className="admin-database-cleanup-card admin-database-cleanup-card-wide">
              <div>
                <strong>Delete ended event</strong>
                <p>Permanently deletes an ended event and all database records belonging to it.</p>
                <p>
                  Players are preserved. Draft, scheduled and active events cannot be deleted by
                  this operation.
                </p>
                <div className="admin-database-event-delete-control">
                  <label htmlFor="admin-ended-event-delete">Ended Event</label>
                  <select
                    id="admin-ended-event-delete"
                    value={selectedEndedEventId ?? ''}
                    disabled={endedEventsLoading || deleteEndedEventBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedEndedEventId(value ? Number(value) : null);
                    }}
                  >
                    <option value="">
                      {endedEventsLoading
                        ? 'Loading ended events...'
                        : endedEvents.length === 0
                          ? 'No ended events available'
                          : 'Select ended event'}
                    </option>
                    {endedEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {`${event.name} - Timespan: ${formatEventDateOnly(event.startsAt)} - ${formatEventDateOnly(event.endsAt)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="admin-danger-button"
                type="button"
                disabled={deleteEndedEventBusy || endedEventsLoading || selectedEndedEvent === null}
                onClick={() => {
                  setShowDeleteEndedEventWarning(true);
                }}
              >
                DELETE ENDED EVENT
              </button>
            </div>
            <div className="admin-database-cleanup-card admin-database-cleanup-card-wide">
              <div>
                <strong>Delete player</strong>
                <p>
                  Permanently removes a player from the application. Player cache and scheduled
                  event selections are removed automatically.
                </p>
                <p>
                  Active or historical event participation protects the player from permanent
                  deletion.
                </p>
                <div className="admin-database-event-delete-control">
                  <label htmlFor="admin-player-delete">Player</label>
                  <select
                    id="admin-player-delete"
                    value={selectedPlayerId ?? ''}
                    disabled={playersLoading || deletePlayerBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedPlayerId(value ? Number(value) : null);
                    }}
                  >
                    <option value="">
                      {playersLoading
                        ? 'Loading players...'
                        : players.length === 0
                          ? 'No players available'
                          : 'Select player'}
                    </option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {`${player.gameName}#${player.tagLine} (${player.region})`}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedPlayer && (
                  <div className="admin-database-player-delete-status">
                    {playerDeleteDependenciesLoading ? (
                      <span className="admin-database-player-delete-checking">
                        Checking dependencies...
                      </span>
                    ) : playerDeleteDependencies ? (
                      <>
                        <div className="admin-database-player-delete-stats">
                          <div>
                            <span>Scheduled selections</span>
                            <strong>{playerDeleteDependencies.eventSelections}</strong>
                          </div>
                          <div>
                            <span>Event participations</span>
                            <strong>{playerDeleteDependencies.eventParticipations}</strong>
                          </div>
                          <div>
                            <span>Active</span>
                            <strong>{playerDeleteDependencies.activeEventParticipations}</strong>
                          </div>
                          <div>
                            <span>Ended</span>
                            <strong>{playerDeleteDependencies.endedEventParticipations}</strong>
                          </div>
                        </div>
                        {playerDeleteDependencies.canDelete ? (
                          <div className="admin-database-player-delete-result is-allowed">
                            <strong>Deletion allowed</strong>
                            <span>
                              {playerDeleteDependencies.eventSelections > 0
                                ? `${playerDeleteDependencies.eventSelections} scheduled event selection${
                                    playerDeleteDependencies.eventSelections === 1 ? '' : 's'
                                  } will also be removed.`
                                : 'No protected event history exists for this player.'}
                            </span>
                          </div>
                        ) : (
                          <div className="admin-database-player-delete-result is-blocked">
                            <strong>Deletion blocked</strong>
                            <span>
                              Event participation history exists. Remove the related event history
                              before permanently deleting this player.
                            </span>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                className="admin-danger-button"
                type="button"
                disabled={
                  deletePlayerBusy ||
                  playersLoading ||
                  playerDeleteDependenciesLoading ||
                  !playerDeleteAllowed
                }
                onClick={() => {
                  setShowDeletePlayerWarning(true);
                }}
              >
                {deletePlayerBusy ? 'DELETING PLAYER...' : 'DELETE PLAYER'}
              </button>
            </div>
          </div>
        </section>
        <section className="admin-section admin-database-reset-zone">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">DANGER ZONE</span>
              <h2>Reset Application</h2>
              <p>
                Permanently remove all application data, players, events, matches, caches and
                administrator accounts.
              </p>
            </div>
          </div>
          <div className="admin-database-reset-box">
            <div>
              <strong>Reset the complete application</strong>
              <p>
                Database tables, indexes, constraints and migration history are preserved. All
                application data is permanently deleted and identity sequences are reset.
              </p>
              <p>
                Administrator accounts and sessions are also removed. Restart the backend afterwards
                to bootstrap the initial administrator again.
              </p>
            </div>
            <button
              className="admin-danger-button"
              type="button"
              disabled={resetBusy || resetComplete}
              onClick={() => {
                setShowResetWarning(true);
              }}
            >
              {resetComplete ? 'APPLICATION RESET' : 'RESET APPLICATION'}
            </button>
          </div>
          <AdminConfirmDialog
            open={maintenanceOperation !== null}
            title="Database Maintenance"
            message={maintenanceOperation ? maintenanceAllMessages[maintenanceOperation] : ''}
            confirmLabel={
              maintenanceOperation ? maintenanceAllLabels[maintenanceOperation] : 'Confirm'
            }
            danger={maintenanceOperation === 'reindex_concurrently'}
            busy={maintenanceBusy}
            onConfirm={() => {
              void runMaintenanceAll();
            }}
            onCancel={() => {
              if (!maintenanceBusy) {
                setMaintenanceOperation(null);
              }
            }}
          />
          <AdminConfirmDialog
            open={showResetWarning}
            title="Reset Application"
            message="Are you sure you want to reset the application?"
            confirmLabel="Yes, Reset Application"
            danger
            busy={resetBusy}
            onConfirm={() => {
              setShowResetWarning(false);
              setShowResetFinalWarning(true);
            }}
            onCancel={() => {
              setShowResetWarning(false);
            }}
          />
          <AdminConfirmDialog
            open={showPlayerCacheCleanupWarning}
            title="Clear Player Cache"
            message="Are you sure you want to remove all cached player data? The cache will be rebuilt automatically as players are refreshed."
            confirmLabel="Yes, Clear Player Cache"
            danger
            busy={playerCacheCleanupBusy}
            onConfirm={() => {
              void clearPlayerCache();
            }}
            onCancel={() => {
              if (!playerCacheCleanupBusy) {
                setShowPlayerCacheCleanupWarning(false);
              }
            }}
          />
          <AdminConfirmDialog
            open={showMatchDetailsPruneWarning}
            title="Prune Historical Match Details"
            message={`Delete detailed match data from ended events older than ${matchDetailsRetentionDays} days? Event history, match results and LP data will be preserved.`}
            confirmLabel="Yes, Prune Match Details"
            danger
            busy={matchDetailsPruneBusy}
            onConfirm={() => {
              void pruneMatchDetails();
            }}
            onCancel={() => {
              if (!matchDetailsPruneBusy) {
                setShowMatchDetailsPruneWarning(false);
              }
            }}
          />
          <AdminConfirmDialog
            open={showDeleteEndedEventWarning}
            title="Permanently Delete Event"
            message={
              selectedEndedEvent
                ? `Permanently delete "${selectedEndedEvent.name}" and all data belonging to this event? This cannot be undone.`
                : ''
            }
            confirmLabel="Yes, Delete Event"
            danger
            busy={deleteEndedEventBusy}
            onConfirm={() => {
              void deleteEndedEvent();
            }}
            onCancel={() => {
              if (!deleteEndedEventBusy) {
                setShowDeleteEndedEventWarning(false);
              }
            }}
          />
          <AdminConfirmDialog
            open={showDeletePlayerWarning}
            title="Permanently Delete Player"
            message={
              selectedPlayer && playerDeleteDependencies
                ? `Permanently delete "${selectedPlayer.gameName}#${selectedPlayer.tagLine}"? ${
                    playerDeleteDependencies.eventSelections > 0
                      ? `${playerDeleteDependencies.eventSelections} scheduled event selection${
                          playerDeleteDependencies.eventSelections === 1 ? '' : 's'
                        } will also be removed. `
                      : ''
                  }This cannot be undone.`
                : ''
            }
            confirmLabel="Yes, Delete Player"
            danger
            busy={deletePlayerBusy}
            onConfirm={() => {
              void deletePlayer();
            }}
            onCancel={() => {
              if (!deletePlayerBusy) {
                setShowDeletePlayerWarning(false);
              }
            }}
          />
          <AdminResetConfirmDialog
            open={showResetFinalWarning}
            busy={resetBusy}
            onConfirm={() => {
              void resetApplication();
            }}
            onCancel={() => {
              if (!resetBusy) {
                setShowResetFinalWarning(false);
              }
            }}
          />
        </section>
      </section>
    </main>
  );
}
export default AdminDatabaseAdvancedPage;
