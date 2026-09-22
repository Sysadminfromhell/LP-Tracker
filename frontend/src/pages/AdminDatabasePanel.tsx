import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { AdminDatabaseOverviewResponse } from '@lp-tracker/contracts';
import type { AdminToastVariant } from '../components/AdminToastHost';
import AdminDatabaseMap from './AdminDatabaseMap';

interface AdminDatabasePanelProps {
  onUnauthorized: () => void;
  onNotify: (variant: AdminToastVariant, message: string) => void;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string;
    };
    return data.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
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
function getLatestMaintenanceDate(first: string | null, second: string | null): string | null {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return new Date(first).getTime() >= new Date(second).getTime() ? first : second;
}
function AdminDatabasePanel({ onUnauthorized, onNotify }: AdminDatabasePanelProps) {
  const [overview, setOverview] = useState<AdminDatabaseOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/database/overview', {
        cache: 'no-store',
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as AdminDatabaseOverviewResponse;
      setOverview(data);
    } catch (error) {
      onNotify(
        'error',
        error instanceof Error ? error.message : 'Could not load database overview.',
      );
    } finally {
      setLoading(false);
    }
  }, [onNotify, onUnauthorized]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOverview]);
  if (loading) {
    return (
      <div className="admin-section">
        <div className="admin-player-empty">Loading database overview...</div>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="admin-section">
        <div className="admin-player-empty">Database overview unavailable.</div>
      </div>
    );
  }
  return (
    <>
      <div className="admin-section admin-database-panel">
        <div className="admin-section-header">
          <div>
            <span className="admin-section-eyebrow">DATABASE</span>
            <h2>Informations</h2>
            <p>PostgreSQL storage, table health and maintenance statistics.</p>
          </div>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() => {
              void loadOverview();
            }}
          >
            Refresh
          </button>
        </div>
        <div className="admin-database-summary">
          <div>
            <span>Database Size</span>
            <strong>{formatBytes(overview.database.sizeBytes)}</strong>
            <small>{overview.database.name}</small>
          </div>

          <div>
            <span>Tables</span>
            <strong>{formatNumber(overview.totals.tables)}</strong>
            <small>{formatNumber(overview.totals.indexes)} indexes</small>
          </div>

          <div>
            <span>Estimated Rows</span>
            <strong>{formatNumber(overview.totals.estimatedRows)}</strong>
            <small>{formatNumber(overview.totals.deadRows)} dead tuples</small>
          </div>

          <div>
            <span>Invalid Indexes</span>
            <strong>{formatNumber(overview.totals.invalidIndexes)}</strong>
            <small>PostgreSQL {overview.database.serverVersion}</small>
          </div>
        </div>

        <div className="admin-database-storage">
          <div>
            <span>Table Data</span>
            <strong>{formatBytes(overview.totals.tableSizeBytes)}</strong>
          </div>

          <div>
            <span>Indexes</span>
            <strong>{formatBytes(overview.totals.indexSizeBytes)}</strong>
          </div>

          <div>
            <span>Total Relations</span>
            <strong>{formatBytes(overview.totals.totalSizeBytes)}</strong>
          </div>
        </div>

        <div className="admin-database-table-wrap">
          <div className="admin-database-table-header">
            <span>Table</span>
            <span>Rows</span>
            <span>Dead</span>
            <span>Table</span>
            <span>Indexes</span>
            <span>Index Count</span>
            <span>Vacuum</span>
            <span>Analyze</span>
          </div>
          {overview.tables.map((table) => {
            const lastVacuum = getLatestMaintenanceDate(table.lastVacuumAt, table.lastAutovacuumAt);

            const lastAnalyze = getLatestMaintenanceDate(
              table.lastAnalyzeAt,
              table.lastAutoanalyzeAt,
            );
            return (
              <Link
                className="admin-database-table-row"
                key={table.name}
                to={`/admin/database/tables/${encodeURIComponent(table.name)}`}
              >
                <strong>{table.name}</strong>
                <span>{formatNumber(table.estimatedRows)}</span>
                <span className={table.deadRows > 0 ? 'warning' : undefined}>
                  {formatNumber(table.deadRows)}
                </span>
                <span>{formatBytes(table.tableSizeBytes)}</span>
                <span>{formatBytes(table.indexSizeBytes)}</span>
                <span>
                  {table.indexCount}
                  {table.invalidIndexCount > 0 && (
                    <small className="admin-database-index-warning">
                      {table.invalidIndexCount} invalid
                    </small>
                  )}
                </span>
                <span>{formatDate(lastVacuum)}</span>
                <span>{formatDate(lastAnalyze)}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <AdminDatabaseMap tables={overview.tables} relationships={overview.relationships} />
    </>
  );
}
export default AdminDatabasePanel;
