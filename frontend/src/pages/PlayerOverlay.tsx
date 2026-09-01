import { useEffect, useState } from 'react';
import { loadChampionIcons } from '../championIcons';

interface EventMatch {
  id: string;

  championId: number;
  champion: string;
  position: string;

  kills: number;
  deaths: number;
  assists: number;

  result: 'WIN' | 'LOSE';

  lpDelta: number | null;
}

interface LeaderboardPlayer {
  player: {
    gameName: string;
    tagLine: string;
    region: string;
    profileImageUrl: string;
  };

  current: {
    tier: string;
    division: number | null;
    lp: number;
  };

  lpGain: number;

  record: {
    wins: number;
    losses: number;
    games: number;
  };

  recentMatches: EventMatch[];

  lastUpdated: string;
}

interface LeaderboardResponse {
  players: LeaderboardPlayer[];
}

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
function PlayerOverlay() {
  const [player, setPlayer] = useState<LeaderboardPlayer | null>(null);
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
    const query = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    const region = params.get('region');
    const name = params.get('name');
    const tag = params.get('tag');
    async function load() {
      const response = await fetch('/api/leaderboard');
      const data = (await response.json()) as LeaderboardResponse;
      const found = data.players.find(
        (item) =>
          item.player.region === region &&
          item.player.gameName === name &&
          item.player.tagLine === tag,
      );
      setPlayer(found ?? null);
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
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
