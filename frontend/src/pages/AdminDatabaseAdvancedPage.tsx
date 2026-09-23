import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import AdminToastHost, {
  type AdminToastMessage,
  type AdminToastVariant,
} from '../components/AdminToastHost';
import AdminDatabasePanel from './AdminDatabasePanel';
import type {
  AdminDatabaseMaintenanceAllResponse,
  AdminDatabaseMaintenanceOperation,
  AdminDatabaseMatchDetailsPruneResponse,
  AdminDatabasePlayerCacheCleanupResponse,
  AdminDatabaseResetResponse,
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
