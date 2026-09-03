import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminEventPanel from './AdminEventPanel';

interface AdminPlayer {
  id: number;
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string | null;
  twitterUsername: string | null;
  enabled: boolean;
  profileImageUrl: string | null;
  tier: string | null;
  division: number | null;
  lp: number | null;
  rankScore: number | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
}
interface PlayersResponse {
  players: AdminPlayer[];
}
interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}
interface PlayerForm {
  gameName: string;
  tagLine: string;
  region: string;
  twitchUsername: string;
  twitterUsername: string;
  enabled: boolean;
}
interface ProviderRateLimitBucket {
  limit: number;
  count: number | null;
  windowSeconds: number;
}
interface ProviderHealth {
  name: string | null;
  connected: boolean;
  rateLimit: {
    buckets: ProviderRateLimitBucket[];
    restricted: boolean;
  } | null;
  warning: string | null;
}
interface HealthResponse {
  provider: ProviderHealth;
}
const EMPTY_PLAYER_FORM: PlayerForm = {
  gameName: '',
  tagLine: '',
  region: 'EUW',
  twitchUsername: '',
  twitterUsername: '',
  enabled: true,
};
function formatRank(player: AdminPlayer): string {
  if (!player.tier || player.lp === null) {
    return 'No rank data';
  }
  const division = player.division !== null ? ` ${player.division}` : '';
  return `${player.tier}${division} · ${player.lp} LP`;
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
function AdminDashboard({ username, onLogout }: AdminDashboardProps) {
  const [providerHealth, setProviderHealth] = useState<ProviderHealth | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<PlayerForm>(EMPTY_PLAYER_FORM);
  const [editForm, setEditForm] = useState<PlayerForm>(EMPTY_PLAYER_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshingPlayerId, setRefreshingPlayerId] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const loadProviderHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as HealthResponse;
      setProviderHealth(data.provider);
    } catch (err) {
      console.warn('Could not load provider health:', err);
    }
  }, []);
  const loadPlayers = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/players');
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as PlayersResponse;
      setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadProviderHealth();
    }, 0);
    const interval = window.setInterval(() => {
      void loadProviderHealth();
    }, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [loadProviderHealth]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlayers();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPlayers]);
  function startEditing(player: AdminPlayer) {
    setEditingPlayerId(player.id);
    setEditForm({
      gameName: player.gameName,
      tagLine: player.tagLine,
      region: player.region,
      twitchUsername: player.twitchUsername ?? '',
      twitterUsername: player.twitterUsername ?? '',
      enabled: player.enabled,
    });
    setError(null);
    setMessage(null);
  }
  function cancelEditing() {
    setEditingPlayerId(null);
    setError(null);
  }
  async function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameName: addForm.gameName,
          tagLine: addForm.tagLine,
          region: addForm.region,
          twitchUsername: addForm.twitchUsername || null,
          twitterUsername: addForm.twitterUsername || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setAddForm(EMPTY_PLAYER_FORM);
      setShowAddPlayer(false);
      setMessage('Player added successfully.');
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player.');
    } finally {
      setSaving(false);
    }
  }
  async function handleEditPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingPlayerId === null) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/players/${editingPlayerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twitchUsername: editForm.twitchUsername || null,
          twitterUsername: editForm.twitterUsername || null,
          enabled: editForm.enabled,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setEditingPlayerId(null);
      setMessage('Player updated successfully.');
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update player.');
    } finally {
      setSaving(false);
    }
  }
  async function handleRefreshPlayer(player: AdminPlayer) {
    if (refreshingAll || refreshingPlayerId !== null) {
      return;
    }

    setRefreshingPlayerId(player.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/players/${player.id}/refresh`, {
        method: 'POST',
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await loadPlayers();

      setMessage(`${player.gameName}#${player.tagLine} refreshed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh player.');
    } finally {
      setRefreshingPlayerId(null);
    }
  }

  async function handleRefreshAllPlayers() {
    if (refreshingAll || refreshingPlayerId !== null) {
      return;
    }

    setRefreshingAll(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/players/refresh-all', {
        method: 'POST',
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as {
        refreshed: number;
        players: AdminPlayer[];
      };

      setPlayers(data.players);

      setMessage(
        `${data.refreshed} player${data.refreshed === 1 ? '' : 's'} refreshed successfully.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh players.');

      await loadPlayers();
    } finally {
      setRefreshingAll(false);
    }
  }
  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">LP GAIN EVENT</span>
            <h1>Admin</h1>
          </div>
          <div className="admin-user">
            <span>
              Logged in as <strong>{username}</strong>
            </span>
            <button className="admin-secondary-button" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>
        <AdminEventPanel onUnauthorized={onLogout} />
        {providerHealth?.warning && (
          <div className="admin-provider-warning" role="status">
            <div className="admin-provider-warning-icon">!</div>
            <div className="admin-provider-warning-content">
              <strong>Riot API rate limit warning</strong>
              <p>{providerHealth.warning}</p>
              {providerHealth.rateLimit && (
                <div className="admin-provider-rate-limits">
                  {providerHealth.rateLimit.buckets.map((bucket) => (
                    <span key={bucket.windowSeconds}>
                      {bucket.count !== null ? `${bucket.count} / ` : ''}
                      {bucket.limit} requests
                      {' / '}
                      {bucket.windowSeconds}s
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="admin-section">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">PARTICIPANTS</span>
              <h2>Players</h2>
              <p>Manage Riot accounts and social links.</p>
              <p className="admin-form-note">
                Riot ID and region cannot be changed after a player has been added.
              </p>
            </div>
            <div className="admin-section-actions">
              <button
                className="admin-secondary-button"
                type="button"
                disabled={refreshingAll || refreshingPlayerId !== null || players.length === 0}
                onClick={() => {
                  void handleRefreshAllPlayers();
                }}
              >
                {refreshingAll ? 'Refreshing All...' : 'Refresh All'}
              </button>
              <button
                className="admin-primary-button admin-add-player-button"
                type="button"
                disabled={refreshingAll}
                onClick={() => {
                  setShowAddPlayer((current) => !current);
                  setEditingPlayerId(null);
                  setError(null);
                  setMessage(null);
                }}
              >
                {showAddPlayer ? 'Cancel' : '+ Add Player'}
              </button>
            </div>
          </div>
          {showAddPlayer && (
            <form className="admin-player-form" onSubmit={handleAddPlayer}>
              <div className="admin-form-grid">
                <label>
                  Player Name
                  <input
                    type="text"
                    value={addForm.gameName}
                    disabled={saving}
                    required
                    onChange={(event) => {
                      setAddForm({
                        ...addForm,
                        gameName: event.target.value,
                      });
                    }}
                  />
                </label>
                <label>
                  Tag
                  <input
                    type="text"
                    value={addForm.tagLine}
                    disabled={saving}
                    required
                    placeholder="EUW"
                    onChange={(event) => {
                      setAddForm({
                        ...addForm,
                        tagLine: event.target.value,
                      });
                    }}
                  />
                </label>
                <label>
                  Region
                  <input
                    type="text"
                    value={addForm.region}
                    disabled={saving}
                    required
                    onChange={(event) => {
                      setAddForm({
                        ...addForm,
                        region: event.target.value.toUpperCase(),
                      });
                    }}
                  />
                </label>
                <label>
                  Twitch
                  <input
                    type="text"
                    value={addForm.twitchUsername}
                    disabled={saving}
                    placeholder="Optional"
                    onChange={(event) => {
                      setAddForm({
                        ...addForm,
                        twitchUsername: event.target.value,
                      });
                    }}
                  />
                </label>
                <label>
                  X / Twitter
                  <input
                    type="text"
                    value={addForm.twitterUsername}
                    disabled={saving}
                    placeholder="Optional"
                    onChange={(event) => {
                      setAddForm({
                        ...addForm,
                        twitterUsername: event.target.value,
                      });
                    }}
                  />
                </label>
              </div>
              <div className="admin-form-actions">
                <button className="admin-primary-button" type="submit" disabled={saving}>
                  {saving ? 'Validating...' : 'Add Player'}
                </button>
              </div>
              <p className="admin-form-note">
                The Riot account is validated through the active league data provider before it is
                added.
              </p>
            </form>
          )}
          {error && <div className="admin-message admin-message-error">{error}</div>}
          {message && <div className="admin-message admin-message-success">{message}</div>}
          {loading ? (
            <div className="admin-player-empty">Loading players...</div>
          ) : players.length === 0 ? (
            <div className="admin-player-empty">No players configured.</div>
          ) : (
            <div className="admin-player-list">
              {players.map((player) => (
                <div className="admin-player-card" key={player.id}>
                  <div className="admin-player-summary">
                    <div className="admin-player-identity">
                      {player.profileImageUrl ? (
                        <img className="admin-player-icon" src={player.profileImageUrl} alt="" />
                      ) : (
                        <div className="admin-player-icon admin-player-icon-empty" />
                      )}
                      <div>
                        <div className="admin-player-name">
                          {player.gameName}
                          <span>#{player.tagLine}</span>
                        </div>
                        <div className="admin-player-meta">
                          {player.region} · {formatRank(player)}
                        </div>
                      </div>
                    </div>
                    <div className="admin-player-socials">
                      <span>
                        Twitch
                        <strong>{player.twitchUsername ?? '—'}</strong>
                      </span>
                      <span>
                        X<strong>{player.twitterUsername ?? '—'}</strong>
                      </span>
                    </div>
                    <div className="admin-player-actions">
                      <span
                        className={
                          player.enabled
                            ? 'admin-status admin-status-enabled'
                            : 'admin-status admin-status-disabled'
                        }
                      >
                        {player.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={refreshingAll || refreshingPlayerId !== null || saving}
                        onClick={() => {
                          void handleRefreshPlayer(player);
                        }}
                      >
                        {refreshingPlayerId === player.id ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={refreshingAll || refreshingPlayerId !== null}
                        onClick={() => {
                          if (editingPlayerId === player.id) {
                            cancelEditing();
                          } else {
                            startEditing(player);
                          }
                        }}
                      >
                        {editingPlayerId === player.id ? 'Close' : 'Edit'}
                      </button>
                    </div>
                  </div>
                  {player.lastError && (
                    <div className="admin-player-error">Provider: {player.lastError}</div>
                  )}
                  {editingPlayerId === player.id && (
                    <form
                      className="admin-player-form admin-player-edit-form"
                      onSubmit={handleEditPlayer}
                    >
                      <div className="admin-form-grid">
                        <label>
                          Twitch
                          <input
                            type="text"
                            value={editForm.twitchUsername}
                            disabled={saving}
                            onChange={(event) => {
                              setEditForm({
                                ...editForm,
                                twitchUsername: event.target.value,
                              });
                            }}
                          />
                        </label>
                        <label>
                          X / Twitter
                          <input
                            type="text"
                            value={editForm.twitterUsername}
                            disabled={saving}
                            onChange={(event) => {
                              setEditForm({
                                ...editForm,
                                twitterUsername: event.target.value,
                              });
                            }}
                          />
                        </label>
                        <label className="admin-enabled-field">
                          Player Status
                          <span className="admin-checkbox-row">
                            <input
                              type="checkbox"
                              checked={editForm.enabled}
                              disabled={saving}
                              onChange={(event) => {
                                setEditForm({
                                  ...editForm,
                                  enabled: event.target.checked,
                                });
                              }}
                            />
                            Enabled
                          </span>
                        </label>
                      </div>
                      <div className="admin-form-actions">
                        <button className="admin-primary-button" type="submit" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          className="admin-secondary-button"
                          type="button"
                          disabled={saving}
                          onClick={cancelEditing}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <a className="admin-back-link" href="#">
          ← Back to leaderboard
        </a>
      </section>
    </main>
  );
}
export default AdminDashboard;
