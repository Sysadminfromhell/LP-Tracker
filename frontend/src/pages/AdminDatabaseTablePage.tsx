import { useCallback, useEffect, useState } from 'react';
import AdminToastHost, {
  type AdminToastMessage,
  type AdminToastVariant,
} from '../components/AdminToastHost';
import { Link, useParams } from 'react-router';
import type {
  AdminDatabaseMaintenanceOperation,
  AdminDatabaseMaintenanceResponse,
  AdminDatabaseTableDetailsResponse,
} from '@lp-tracker/contracts';
import AdminConfirmDialog from '../components/AdminConfirmDialog';

const maintenanceLabels: Record<AdminDatabaseMaintenanceOperation, string> = {
  analyze: 'ANALYZE',
  vacuum_analyze: 'VACUUM ANALYZE',
  reindex_concurrently: 'REINDEX TABLE CONCURRENTLY',
};
const maintenanceMessages: Record<AdminDatabaseMaintenanceOperation, string> = {
  analyze: 'Update PostgreSQL planner statistics for this table?',
  vacuum_analyze: 'Vacuum this table and refresh PostgreSQL planner statistics?',
  reindex_concurrently:
    'Rebuild all indexes for this table concurrently? This can take some time on large tables.',
};

interface AdminDatabaseTablePageProps {
  username: string;
  onLogout: () => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}
function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function AdminDatabaseTablePage({ username, onLogout }: AdminDatabaseTablePageProps) {
  const { tableName } = useParams<{ tableName: string }>();
  const [details, setDetails] = useState<AdminDatabaseTableDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceOperation, setMaintenanceOperation] =
    useState<AdminDatabaseMaintenanceOperation | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [toasts, setToasts] = useState<AdminToastMessage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const notify = useCallback((variant: AdminToastVariant, notificationMessage: string) => {
    const toast: AdminToastMessage = {
      id: crypto.randomUUID(),
      variant,
      message: notificationMessage,
    };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  async function runMaintenance() {
    if (!tableName || !maintenanceOperation) {
      return;
    }
    setMaintenanceBusy(true);
    try {
      const response = await fetch(
        `/api/admin/database/tables/${encodeURIComponent(tableName)}/maintenance`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: maintenanceOperation,
          }),
        },
      );
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Maintenance failed with status ${response.status}`);
      }
      const result = (await response.json()) as AdminDatabaseMaintenanceResponse;
      notify('success', `${maintenanceLabels[result.operation]} completed successfully.`);
      setMaintenanceOperation(null);
      setRefreshKey((value) => value + 1);
    } catch (maintenanceError) {
      notify(
        'error',
        maintenanceError instanceof Error
          ? maintenanceError.message
          : 'Database maintenance failed.',
      );
    } finally {
      setMaintenanceBusy(false);
    }
  }

  useEffect(() => {
    if (!tableName) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    const resolvedTableName = tableName;
    const controller = new AbortController();
    async function loadDetails() {
      setLoading(true);
      setDetails(null);
      setNotFound(false);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/database/tables/${encodeURIComponent(resolvedTableName)}`,
          {
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (response.status === 401) {
          onLogout();
          return;
        }
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as AdminDatabaseTableDetailsResponse;
        setDetails(data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load database table details.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void loadDetails();
    return () => {
      controller.abort();
    };
  }, [tableName, onLogout, refreshKey]);
  if (!tableName) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <div className="admin-player-empty">Database table not specified.</div>
        </section>
      </main>
    );
  }
  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">DATABASE TABLE</span>
            <h1>{details?.table.label ?? tableName}</h1>

            {details && (
              <span className="admin-database-table-name">
                {details.table.schema}.{details.table.name}
              </span>
            )}
          </div>
          <div className="admin-topbar-actions">
            <Link className="admin-back-link admin-back-link-top" to="/admin/database">
              ← Back to Database
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
        {loading && (
          <section className="admin-section">
            <div className="admin-player-empty">Loading table metadata...</div>
          </section>
        )}
        {!loading && notFound && (
          <section className="admin-section">
            <div className="admin-player-empty">Database table not found.</div>
          </section>
        )}
        {!loading && error && (
          <section className="admin-section">
            <div className="admin-player-empty">Failed to load table metadata: {error}</div>
          </section>
        )}
        {!loading && details && (
          <>
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <span className="admin-section-eyebrow">OVERVIEW</span>
                  <h2>Table Details</h2>
                  <p>PostgreSQL statistics and configuration for this table.</p>
                </div>
              </div>
              <div className="admin-database-table-summary">
                <div className="admin-database-table-stat">
                  <span>Estimated Rows</span>
                  <strong>{formatNumber(details.statistics.estimatedRows)}</strong>
                </div>
                <div className="admin-database-table-stat">
                  <span>Dead Rows</span>
                  <strong>{formatNumber(details.statistics.deadRows)}</strong>
                </div>
                <div className="admin-database-table-stat">
                  <span>Total Size</span>
                  <strong>{formatBytes(details.statistics.totalSizeBytes)}</strong>
                </div>
                <div className="admin-database-table-stat">
                  <span>Table Size</span>
                  <strong>{formatBytes(details.statistics.tableSizeBytes)}</strong>
                </div>
                <div className="admin-database-table-stat">
                  <span>Index Size</span>
                  <strong>{formatBytes(details.statistics.indexSizeBytes)}</strong>
                </div>
                <div className="admin-database-table-stat">
                  <span>Indexes</span>
                  <strong>{formatNumber(details.statistics.indexCount)}</strong>
                </div>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <span className="admin-section-eyebrow">MAINTENANCE</span>
                  <h2>Maintenance Actions</h2>
                  <p>Run PostgreSQL maintenance operations for this table.</p>
                </div>
              </div>
              {details.table.maintenance ? (
                <>
                  <div className="admin-database-maintenance-actions">
                    <button
                      className="admin-secondary-button"
                      type="button"
                      disabled={maintenanceBusy}
                      onClick={() => {
                        setMaintenanceOperation('analyze');
                      }}
                    >
                      ANALYZE
                    </button>
                    <button
                      className="admin-secondary-button"
                      type="button"
                      disabled={maintenanceBusy}
                      onClick={() => {
                        setMaintenanceOperation('vacuum_analyze');
                      }}
                    >
                      VACUUM ANALYZE
                    </button>
                    <button
                      className="admin-secondary-button"
                      type="button"
                      disabled={maintenanceBusy}
                      onClick={() => {
                        setMaintenanceOperation('reindex_concurrently');
                      }}
                    >
                      REINDEX TABLE CONCURRENTLY
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-player-empty">
                  Maintenance operations are disabled for this table.
                </div>
              )}
            </section>
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <span className="admin-section-eyebrow">SCHEMA</span>
                  <h2>Columns</h2>
                  <p>Column definitions reported by PostgreSQL for this table.</p>
                </div>
                <span className="admin-database-map-count">{details.columns.length} columns</span>
              </div>
              <div className="admin-database-schema-table-wrap">
                <table className="admin-database-schema-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Nullable</th>
                      <th>Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.columns.map((column) => (
                      <tr key={column.name}>
                        <td className="admin-database-schema-position">{column.ordinalPosition}</td>
                        <td>
                          <code className="admin-database-schema-column">{column.name}</code>
                        </td>
                        <td>
                          <code className="admin-database-schema-type">{column.dataType}</code>
                        </td>
                        <td>
                          <span
                            className={
                              column.nullable
                                ? 'admin-database-schema-nullable'
                                : 'admin-database-schema-required'
                            }
                          >
                            {column.nullable ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td>
                          {column.defaultValue ? (
                            <code className="admin-database-schema-default">
                              {column.defaultValue}
                            </code>
                          ) : (
                            <span className="admin-database-schema-empty">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <span className="admin-section-eyebrow">POSTGRESQL STATISTICS</span>
                  <h2>Maintenance State</h2>
                  <p>Last recorded PostgreSQL vacuum and analyze operations.</p>
                </div>
              </div>
              <div className="admin-database-table-maintenance-state">
                <div>
                  <span>Last Vacuum</span>
                  <strong>{formatDate(details.statistics.lastVacuumAt)}</strong>
                </div>
                <div>
                  <span>Last Autovacuum</span>
                  <strong>{formatDate(details.statistics.lastAutovacuumAt)}</strong>
                </div>
                <div>
                  <span>Last Analyze</span>
                  <strong>{formatDate(details.statistics.lastAnalyzeAt)}</strong>
                </div>
                <div>
                  <span>Last Autoanalyze</span>
                  <strong>{formatDate(details.statistics.lastAutoanalyzeAt)}</strong>
                </div>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <span className="admin-section-eyebrow">DATABASE STRUCTURE</span>
                  <h2>Constraints & Indexes</h2>
                  <p>Integrity rules and indexes configured for this table.</p>
                </div>
              </div>
              <div className="admin-database-structure-grid">
                <div className="admin-database-structure-panel">
                  <div className="admin-database-structure-header">
                    <div>
                      <span className="admin-section-eyebrow">CONSTRAINTS</span>
                      <h3>Table Constraints</h3>
                    </div>
                    <span className="admin-database-map-count">
                      {details.constraints.length} constraints
                    </span>
                  </div>
                  <div className="admin-database-structure-list">
                    {details.constraints.map((constraint) => (
                      <div className="admin-database-constraint" key={constraint.name}>
                        <div className="admin-database-structure-item-header">
                          <code>{constraint.name}</code>
                          <span
                            className={`admin-database-constraint-type admin-database-constraint-type-${constraint.type
                              .toLowerCase()
                              .replaceAll(' ', '-')}`}
                          >
                            {constraint.type}
                          </span>
                        </div>
                        {constraint.columns.length > 0 && (
                          <div className="admin-database-structure-columns">
                            {constraint.columns.map((column) => (
                              <code key={column}>{column}</code>
                            ))}
                          </div>
                        )}
                        <code className="admin-database-structure-definition">
                          {constraint.definition}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="admin-database-structure-panel">
                  <div className="admin-database-structure-header">
                    <div>
                      <span className="admin-section-eyebrow">INDEXES</span>
                      <h3>Table Indexes</h3>
                    </div>
                    <span className="admin-database-map-count">
                      {details.indexes.length} indexes
                    </span>
                  </div>
                  <div className="admin-database-structure-list">
                    {details.indexes.map((index) => (
                      <div className="admin-database-index" key={index.name}>
                        <div className="admin-database-structure-item-header">
                          <code>{index.name}</code>
                          <div className="admin-database-index-flags">
                            {index.primary && <span>PRIMARY</span>}
                            {index.unique && <span>UNIQUE</span>}
                            <span className={index.valid ? '' : 'is-invalid'}>
                              {index.valid ? 'VALID' : 'INVALID'}
                            </span>
                            <span className={index.ready ? '' : 'is-invalid'}>
                              {index.ready ? 'READY' : 'NOT READY'}
                            </span>
                          </div>
                        </div>
                        <div className="admin-database-structure-columns">
                          {index.columns.map((column) => (
                            <code key={column}>{column}</code>
                          ))}
                        </div>
                        <div className="admin-database-index-meta">
                          <span>Size</span>
                          <strong>{formatBytes(index.sizeBytes)}</strong>
                        </div>

                        <code className="admin-database-structure-definition">
                          {index.definition}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </section>
      <AdminConfirmDialog
        open={maintenanceOperation !== null}
        title="Database Maintenance"
        message={maintenanceOperation ? maintenanceMessages[maintenanceOperation] : ''}
        confirmLabel={maintenanceOperation ? maintenanceLabels[maintenanceOperation] : 'Confirm'}
        danger={maintenanceOperation === 'reindex_concurrently'}
        busy={maintenanceBusy}
        onConfirm={() => {
          void runMaintenance();
        }}
        onCancel={() => {
          if (!maintenanceBusy) {
            setMaintenanceOperation(null);
          }
        }}
      />
      <AdminToastHost toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

export default AdminDatabaseTablePage;
