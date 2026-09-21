import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type {
  EventPlayerReadyResponse,
  LeaderboardPlayer,
  LeaderboardResponse,
  PlayerRefreshedLiveUpdate,
} from '@lp-tracker/contracts';
import { loadChampionIcons } from '../championIcons';
import { shouldReloadOverlayForLeaderboard } from '../overlay-live';
import { createPlayerOverlayPath } from '../routing';

const divisions: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

function formatRank(tier: string, division: number | null): string {
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  if (division === null) {
    return name;
  }
  return `${name} ` + `${divisions[division] ?? division}`;
}
function formatPosition(position: string) {
  switch (position.toUpperCase()) {
    case 'JUNGLE':
      return 'JGL';
    case 'BOTTOM':
      return 'ADC';
    case 'SUPPORT':
    case 'UTILITY':
      return 'SUP';
    case 'MIDDLE':
      return 'MID';
    default:
      return position.toUpperCase();
  }
}
function toOverlayPlayer(player: LeaderboardPlayer): EventPlayerReadyResponse {
  return {
    ready: true,
    player: player.player,
    startedAt: player.startedAt,
    start: player.start,
    current: player.current,
    lpGain: player.lpGain,
    record: player.record,
    recentMatches: player.recentMatches,
    lastUpdated: player.lastUpdated,
    error: player.error,
  };
}
function PlayerOverlay() {
  const navigate = useNavigate();
  const { eventId: eventIdParam, playerId: playerIdParam } = useParams();
  const [player, setPlayer] = useState<EventPlayerReadyResponse | null>(null);
  const [now, setNow] = useState(0);
  const [championIcons, setChampionIcons] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    document.body.classList.add('obs-mode');
    document.documentElement.classList.add('obs-mode');
    return () => {
      document.body.classList.remove('obs-mode');
      document.documentElement.classList.remove('obs-mode');
    };
  }, []);
  useEffect(() => {
    const updateNow = () => {
      setNow(Date.now());
    };
    const initialTimer = window.setTimeout(updateNow, 0);
    const timer = window.setInterval(updateNow, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);
  function formatUpdatedAgo(lastUpdated: string, now: number): string {
    const updated = new Date(lastUpdated).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - updated) / 1000));
    if (diffSeconds < 60) {
      return `Updated ${diffSeconds}s ago`;
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `Updated ${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    return `Updated ${diffHours}h ago`;
  }
  useEffect(() => {
    void loadChampionIcons().then(setChampionIcons);
  }, []);
  useEffect(() => {
    async function load() {
      if (eventIdParam !== undefined || playerIdParam !== undefined) {
        const eventId = Number(eventIdParam);
        const playerId = Number(playerIdParam);
        if (
          !Number.isSafeInteger(eventId) ||
          eventId <= 0 ||
          !Number.isSafeInteger(playerId) ||
          playerId <= 0
        ) {
          setPlayer(null);
          return;
        }
        const response = await fetch(`/api/events/${eventId}/players/${playerId}`, {
          cache: 'no-store',
        });
        if (response.status === 404) {
          setPlayer(null);
          return;
        }
        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }
        const data = (await response.json()) as EventPlayerReadyResponse;
        setPlayer(data);
        return;
      }
      const legacyQuery = window.location.hash.split('?')[1] ?? '';
      const params = new URLSearchParams(window.location.search || legacyQuery);
      const region = params.get('region');
      const name = params.get('name');
      const tag = params.get('tag');
      const response = await fetch('/api/leaderboard', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as LeaderboardResponse;
      const found = data.players.find(
        (item) =>
          item.player.region === region &&
          item.player.gameName === name &&
          item.player.tagLine === tag,
      );
      if (found && data.event.id !== null) {
        navigate(
          createPlayerOverlayPath({
            eventId: data.event.id,
            playerId: found.player.id,
          }),
          {
            replace: true,
          },
        );
        return;
      }
      setPlayer(found ? toOverlayPlayer(found) : null);
    }
    const handlePlayerRefreshed = (event: MessageEvent<string>) => {
      let update: PlayerRefreshedLiveUpdate;

      try {
        update = JSON.parse(event.data) as PlayerRefreshedLiveUpdate;
      } catch {
        return;
      }

      if (
        !Number.isInteger(update.playerId) ||
        !update.lastUpdated ||
        !Number.isFinite(new Date(update.lastUpdated).getTime())
      ) {
        return;
      }

      if (eventIdParam !== undefined || playerIdParam !== undefined) {
        const routeEventId = Number(eventIdParam);
        const routePlayerId = Number(playerIdParam);

        if (
          !Number.isSafeInteger(routeEventId) ||
          !Number.isSafeInteger(routePlayerId) ||
          update.eventId !== routeEventId ||
          update.playerId !== routePlayerId
        ) {
          return;
        }
      }

      setPlayer((current) => {
        if (!current || current.player.id !== update.playerId) {
          return current;
        }

        return {
          ...current,
          lastUpdated: update.lastUpdated,
        };
      });
    };
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
        void reloadPlayerOnce();
      }, 150);
    }
    async function reloadPlayerOnce() {
      if (disposed) {
        return;
      }
      if (reloadInProgress) {
        reloadPending = true;
        return;
      }
      reloadInProgress = true;
      try {
        await load();
      } catch (error) {
        console.error('Failed to load player overlay:', error);
      } finally {
        reloadInProgress = false;
        if (reloadPending && !disposed) {
          reloadPending = false;
          scheduleReload();
        }
      }
    }
    const handleLeaderboardUpdate = (event: MessageEvent<string>) => {
      if (shouldReloadOverlayForLeaderboard(eventIdParam, playerIdParam, event.data)) {
        scheduleReload();
      }
    };
    void reloadPlayerOnce();
    const eventSource = new EventSource('/api/live');
    eventSource.addEventListener('leaderboard', handleLeaderboardUpdate);
    eventSource.addEventListener('player-refreshed', handlePlayerRefreshed);
    eventSource.onopen = () => {
      scheduleReload();
    };
    eventSource.onerror = () => {
      console.warn('Player overlay live update connection lost; reconnecting...');
    };
    return () => {
      disposed = true;
      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
      eventSource.removeEventListener('leaderboard', handleLeaderboardUpdate);
      eventSource.removeEventListener('player-refreshed', handlePlayerRefreshed);
      eventSource.close();
    };
  }, [eventIdParam, navigate, playerIdParam]);
  if (!player) {
    return null;
  }
  const games = player.record.wins + player.record.losses;
  const winRate = games === 0 ? 0 : Math.round((player.record.wins / games) * 100);
  return (
    <main className="player-overlay">
      <div className="overlay-card">
        <div className="overlay-main">
          <img className="overlay-profile" src={player.player.profileImageUrl} alt="" />

          <div className="overlay-player">
            <strong>{player.player.gameName}</strong>

            <span>#{player.player.tagLine}</span>
          </div>

          <div className="overlay-rank">
            <strong>{formatRank(player.current.tier, player.current.division)}</strong>

            <span>{player.current.lp} LP</span>
          </div>

          <div className={`overlay-gain ${player.lpGain >= 0 ? 'positive' : 'negative'}`}>
            {player.lpGain >= 0 ? '+' : ''}
            {player.lpGain} LP
          </div>

          <div className="overlay-record">
            <strong>{player.record.wins}W</strong>

            <span>/</span>

            <strong>{player.record.losses}L</strong>

            <small>{winRate}%</small>
          </div>
        </div>

        <div className="overlay-matches">
          {player.recentMatches.map((match) => {
            const icon = championIcons.get(match.championId);

            return (
              <div className="overlay-match" key={match.id}>
                {icon && <img src={icon} alt="" />}

                <b className={match.result === 'WIN' ? 'match-win' : 'match-loss'}>
                  {match.result === 'WIN' ? 'W' : 'L'}
                </b>

                <span>{formatPosition(match.position)}</span>

                <span>
                  {match.kills}/{match.deaths}/{match.assists}
                </span>

                <strong
                  className={match.lpDelta !== null && match.lpDelta >= 0 ? 'positive' : 'negative'}
                >
                  {match.lpDelta === null
                    ? '—'
                    : `${match.lpDelta >= 0 ? '+' : ''}${match.lpDelta}`}
                </strong>
              </div>
            );
          })}
        </div>
        <div
          className={`overlay-updated ${
            now - new Date(player.lastUpdated).getTime() > 180_000 ? 'stale' : ''
          }`}
        >
          <span className="overlay-update-dot" />

          {formatUpdatedAgo(player.lastUpdated, now)}
        </div>
      </div>
    </main>
  );
}

export default PlayerOverlay;
