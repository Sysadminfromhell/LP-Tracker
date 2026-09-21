import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPlayerOverlayPath } from '../routing';
import type { LeaderboardPlayer, LeaderboardResponse } from '@lp-tracker/contracts';

function OverlayGenerator() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const loadPlayers = useCallback(async (): Promise<LeaderboardResponse | null> => {
    try {
      const response = await fetch('/api/leaderboard', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      return (await response.json()) as LeaderboardResponse;
    } catch (error) {
      console.error('Failed to load players:', error);
      return null;
    }
  }, []);
  useEffect(() => {
    let reloadTimer: number | null = null;
    let reloadInProgress = false;
    let reloadPending = false;
    let disposed = false;
    function scheduleReload() {
      if (disposed || reloadTimer !== null) {
        return;
      }
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        void reloadPlayersOnce();
      }, 150);
    }
    async function reloadPlayersOnce() {
      if (disposed) {
        return;
      }
      if (reloadInProgress) {
        reloadPending = true;
        return;
      }
      reloadInProgress = true;
      try {
        const data = await loadPlayers();
        if (!data || disposed) {
          return;
        }
        setPlayers(data.players);
        setEventId(data.event.id);
        setSelectedPlayerId((current) => {
          if (current !== null && data.players.some((player) => player.player.id === current)) {
            return current;
          }
          return data.players[0]?.player.id ?? null;
        });
      } finally {
        reloadInProgress = false;

        if (reloadPending && !disposed) {
          reloadPending = false;
          scheduleReload();
        }
      }
    }
    const eventSource = new EventSource('/api/live');
    eventSource.addEventListener('leaderboard', scheduleReload);
    eventSource.addEventListener('events-changed', scheduleReload);
    eventSource.onopen = scheduleReload;
    eventSource.onerror = () => {
      console.warn('Overlay generator live update connection lost; reconnecting...');
    };
    scheduleReload();
    return () => {
      disposed = true;
      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
      eventSource.removeEventListener('leaderboard', scheduleReload);
      eventSource.removeEventListener('events-changed', scheduleReload);
      eventSource.close();
    };
  }, [loadPlayers]);
  const selectedPlayer = useMemo(
    () => players.find((player) => player.player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );
  const overlayUrl = useMemo(() => {
    if (!selectedPlayer || eventId === null) {
      return '';
    }
    return (
      window.location.origin +
      createPlayerOverlayPath({
        eventId,
        playerId: selectedPlayer.player.id,
      })
    );
  }, [eventId, selectedPlayer]);
  async function copyUrl() {
    if (!overlayUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error('Could not copy overlay URL:', error);
    }
  }
  return (
    <main className="generator-page">
      <section className="generator-card">
        <div className="generator-heading">
          <div>
            <span className="eyebrow">LP GAIN EVENT</span>
            <h1>OBS Overlay</h1>
            <p>Select a player and add the generated URL as an OBS Browser Source.</p>
          </div>
          <a href="#" className="back-link">
            Back to leaderboard
          </a>
        </div>
        <div className="generator-controls">
          <label>
            Player
            <select
              value={selectedPlayerId ?? ''}
              onChange={(event) => {
                setSelectedPlayerId(Number(event.target.value));
                setCopied(false);
              }}
            >
              {players.map((player) => (
                <option key={player.player.id} value={player.player.id}>
                  {player.player.gameName}#{player.player.tagLine}
                </option>
              ))}
            </select>
          </label>
          <label>
            Browser Source URL
            <div className="url-row">
              <input readOnly value={overlayUrl} />
              <button type="button" onClick={copyUrl}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </label>
        </div>
        <div className="obs-settings">
          <span>Recommended OBS size</span>
          <strong>760 × 150</strong>
          <span>Transparent background</span>
        </div>
        {overlayUrl && (
          <div className="overlay-preview">
            <div className="preview-label">PREVIEW</div>
            <iframe key={overlayUrl} title="OBS Overlay Preview" src={overlayUrl} />
          </div>
        )}
      </section>
    </main>
  );
}

export default OverlayGenerator;
