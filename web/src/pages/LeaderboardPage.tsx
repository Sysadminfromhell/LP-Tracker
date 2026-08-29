import { useEffect, useMemo, useState } from 'react';
import { loadChampionIcons } from '../championIcons';
interface EventMatch {
  id: string;
  createdAt: string;
  championId: number;
  champion: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: 'WIN' | 'LOSE';
  lpDelta: number | null;
  lpDeltaStatus: 'pending' | 'resolved' | 'unknown';
}
interface LeaderboardPlayer {
  player: {
    id: number;
    gameName: string;
    tagLine: string;
    region: string;
    profileImageUrl: string;
    twitchUsername: string | null;
    twitterUsername: string | null;
  };
  startedAt: string;
  start: {
    tier: string;
    division: number | null;
    lp: number;
    score: number;
  };
  current: {
    tier: string;
    division: number | null;
    lp: number;
    score: number;
  };
  lpGain: number;
  record: {
    wins: number;
    losses: number;
    games: number;
  };
  recentMatches: EventMatch[];
  lastUpdated: string;
  error: string | null;
}
interface LeaderboardResponse {
  ready: boolean;
  totalPlayers: number;
  loadedPlayers: number;
  lastUpdated: string | null;
  players: LeaderboardPlayer[];
  event: {
    id: number | null;
    name: string | null;
    startsAt: string | null;
    endsAt: string | null;
    status: 'draft' | 'active' | 'ended' | null;
  };
}
const divisions: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};
function formatEventDate(date: string | null): string {
  if (!date) {
    return 'Open';
  }
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function pad(value: number): string {
  return String(value).padStart(2, '0');
}
function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
function formatTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}
function formatRank(tier: string, division: number | null): string {
  const formattedTier = formatTier(tier);
  if (division === null) {
    return formattedTier;
  }
  return `${formattedTier} ${divisions[division] ?? division}`;
}
function formatPosition(position: string): string {
  switch (position.toUpperCase()) {
    case 'TOP':
      return 'TOP';
    case 'JUNGLE':
    case 'JGL':
      return 'JGL';
    case 'MID':
    case 'MIDDLE':
      return 'MID';
    case 'ADC':
    case 'BOTTOM':
      return 'ADC';
    case 'SUPPORT':
    case 'UTILITY':
      return 'SUP';
    default:
      return position.toUpperCase();
  }
}
function getWinRate(wins: number, losses: number): number {
  const games = wins + losses;
  if (games === 0) {
    return 0;
  }
  return Math.round((wins / games) * 100);
}
function formatUpdatedAgo(lastUpdated: string, now: number): string {
  const updated = new Date(lastUpdated).getTime();
  if (!Number.isFinite(updated)) {
    return 'Update unknown';
  }
  const seconds = Math.max(0, Math.floor((now - updated) / 1000));
  if (seconds < 60) {
    return `Updated ${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}
function getOpggUrl(gameName: string, tagLine: string, region: string): string {
  return (
    `https://op.gg/lol/summoners/` +
    `${encodeURIComponent(region.toLowerCase())}/` +
    `${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`
  );
}
function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 2h18v13l-5 5h-4l-3 3H7v-3H2V6l2-4zm2 2L4 7v11h5v3l3-3h5l3-3V4H6zm3 3h2v6H9V7zm6 0h2v6h-2V7z"
      />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.24 2H21l-6.03 6.89L22 22h-5.5l-4.31-5.64L7.26 22H4.5l6.4-7.31L4.16 2h5.64l3.89 5.14L18.24 2zm-.97 17.7h1.53L8.97 4.18H7.33L17.27 19.7z"
      />
    </svg>
  );
}
function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [championIcons, setChampionIcons] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  async function loadLeaderboard() {
    try {
      const response = await fetch('/api/leaderboard', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`API returned unexpected Content-Type: ${contentType ?? 'unknown'}`);
      }
      const data = (await response.json()) as LeaderboardResponse;
      setLeaderboard(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadLeaderboard();
    const timer = window.setInterval(() => {
      void loadLeaderboard();
    }, 10_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    loadChampionIcons()
      .then(setChampionIcons)
      .catch((err) => {
        console.error('Failed to load champion icons:', err);
      });
  }, []);
  const players = useMemo(() => leaderboard?.players ?? [], [leaderboard]);
  const eventStatus = leaderboard?.event.status ?? null;
  const eventStart = leaderboard?.event.startsAt
    ? new Date(leaderboard.event.startsAt).getTime()
    : null;
  const eventEnd = leaderboard?.event.endsAt ? new Date(leaderboard.event.endsAt).getTime() : null;
  let countdownLabel = '';
  let countdownValue = '';
  if (eventStatus === 'draft' && eventStart !== null) {
    countdownLabel = 'STARTS IN';
    countdownValue = eventStart > now ? formatCountdown(eventStart - now) : 'STARTING...';
  }
  if (eventStatus === 'active' && eventEnd !== null) {
    countdownLabel = 'TIME REMAINING';
    countdownValue = eventEnd > now ? formatCountdown(eventEnd - now) : 'FINALIZING...';
  }
  if (eventStatus === 'ended') {
    countdownLabel = 'EVENT ENDED';
    countdownValue = formatEventDate(leaderboard?.event.endsAt ?? null);
  }
  if (loading) {
    return (
      <main className="page">
        <div className="status-screen">Loading leaderboard...</div>
      </main>
    );
  }
  if (error && !leaderboard) {
    return (
      <main className="page">
        <div className="status-screen error">{error}</div>
      </main>
    );
  }
  return (
    <main className="page">
      <section className="tracker">
        <header className="topbar">
          <div>
            <span className="eyebrow">LP GAIN EVENT</span>
            <h1>{leaderboard?.event.name ?? 'Leaderboard'}</h1>
            <div className="event-window">
              <div className="event-window-item">
                <span className="event-window-label">Eventstart</span>
                <strong className="event-window-value">
                  {formatEventDate(leaderboard?.event.startsAt ?? null)}
                </strong>
              </div>
              <span className="event-separator">•</span>
              <div className="event-window-item">
                <span className="event-window-label">Eventende</span>
                <strong className="event-window-value">
                  {formatEventDate(leaderboard?.event.endsAt ?? null)}
                </strong>
              </div>
            </div>
          </div>
          <div
            className={`live ${
              eventStatus === 'ended'
                ? 'event-ended'
                : eventStatus === 'draft'
                  ? 'event-scheduled'
                  : ''
            }`}
          >
            <span className="live-dot" />
            {eventStatus === 'draft' ? 'SCHEDULED' : eventStatus === 'ended' ? 'ENDED' : 'LIVE'}
            <a className="overlay-link" href="#overlay_generator">
              OBS Overlay
            </a>
          </div>
        </header>
        {eventStatus && (
          <div className={`event-countdown event-countdown-${eventStatus}`}>
            <span>{countdownLabel}</span>
            <strong>{countdownValue}</strong>
          </div>
        )}
        <section className="leaderboard">
          <div className="leaderboard-header">
            <div>#</div>
            <div>Player</div>
            <div>Current</div>
            <div>LP Gain</div>
            <div>W / L</div>
            <div>WR</div>
          </div>
          {players.length === 0 ? (
            <div className="empty-board">Waiting for the first player update...</div>
          ) : (
            players.map((player, index) => {
              const winRate = getWinRate(player.record.wins, player.record.losses);
              const playerUpdatedMs = new Date(player.lastUpdated).getTime();
              const isStale = Number.isFinite(playerUpdatedMs) && now - playerUpdatedMs > 180_000;
              return (
                <article
                  className="leaderboard-entry"
                  key={
                    `${player.player.region}:` +
                    `${player.player.gameName}#` +
                    `${player.player.tagLine}`
                  }
                >
                  <div className="leaderboard-main">
                    <div className="place">{index + 1}</div>
                    <div className="player-cell">
                      <img className="profile-icon" src={player.player.profileImageUrl} alt="" />
                      <div className="player-info">
                        <div className="player-name-row">
                          <a
                            className="player-opgg-link"
                            href={getOpggUrl(
                              player.player.gameName,
                              player.player.tagLine,
                              player.player.region,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open on OP.GG"
                          >
                            <strong>{player.player.gameName}</strong>
                            <span>#{player.player.tagLine}</span>
                          </a>
                          <div className="player-socials">
                            {player.player.twitchUsername ? (
                              <a
                                className="social-link twitch"
                                href={`https://twitch.tv/${encodeURIComponent(
                                  player.player.twitchUsername,
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Twitch: ${player.player.twitchUsername}`}
                              >
                                <TwitchIcon />
                              </a>
                            ) : (
                              <span className="social-link disabled" title="No Twitch account">
                                <TwitchIcon />
                              </span>
                            )}
                            {player.player.twitterUsername ? (
                              <a
                                className="social-link x"
                                href={`https://x.com/${encodeURIComponent(
                                  player.player.twitterUsername,
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`X: @${player.player.twitterUsername}`}
                              >
                                <XIcon />
                              </a>
                            ) : (
                              <span className="social-link disabled" title="No X account">
                                <XIcon />
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`player-updated ${isStale ? 'stale' : ''}`}>
                          <span className="player-update-dot" />
                          {formatUpdatedAgo(player.lastUpdated, now)}
                        </div>
                      </div>
                    </div>
                    <div className="rank-cell">
                      <strong>{formatRank(player.current.tier, player.current.division)}</strong>
                      <span>{player.current.lp} LP</span>
                    </div>
                    <div className={`gain-cell ${player.lpGain >= 0 ? 'positive' : 'negative'}`}>
                      {player.lpGain >= 0 ? '+' : ''}
                      {player.lpGain} LP
                    </div>
                    <div className="record-cell">
                      <span className="wins">{player.record.wins}W</span>
                      <span className="separator">/</span>
                      <span className="losses">{player.record.losses}L</span>
                    </div>
                    <div className="winrate-cell">{winRate}%</div>
                  </div>
                  <div className="matches-row">
                    <span className="matches-label">LAST 3 GAMES</span>
                    <div className="matches">
                      {player.recentMatches.length === 0 ? (
                        <div className="no-games">No ranked games since event start</div>
                      ) : (
                        player.recentMatches.map((match) => {
                          const icon = championIcons.get(match.championId);
                          return (
                            <div className="compact-match" key={match.id}>
                              <div className="champion-wrap">
                                {icon ? (
                                  <img
                                    className="champion-icon"
                                    src={icon}
                                    alt={match.champion}
                                    title={match.champion}
                                  />
                                ) : (
                                  <div className="champion-placeholder" />
                                )}
                              </div>
                              <span
                                className={
                                  match.result === 'WIN'
                                    ? 'match-result match-win'
                                    : 'match-result match-loss'
                                }
                              >
                                {match.result === 'WIN' ? 'W' : 'L'}
                              </span>
                              <span className="match-position">
                                {formatPosition(match.position)}
                              </span>
                              <span className="match-kda">
                                {match.kills}/{match.deaths}/{match.assists}
                              </span>
                              <span
                                className={`match-lp ${
                                  match.lpDelta === null
                                    ? 'unknown'
                                    : match.lpDelta >= 0
                                      ? 'positive'
                                      : 'negative'
                                }`}
                              >
                                {match.lpDelta === null
                                  ? '— LP'
                                  : `${match.lpDelta >= 0 ? '+' : ''}${match.lpDelta} LP`}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {player.error && (
                    <div className="player-error">Last refresh failed: {player.error}</div>
                  )}
                </article>
              );
            })
          )}
        </section>
        <footer>Rankings are based on LP gained since the event started.</footer>
      </section>
    </main>
  );
}
export default LeaderboardPage;
