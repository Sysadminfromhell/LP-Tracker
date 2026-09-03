import { useEffect, useMemo, useState } from 'react';
import { loadChampionIcons } from '../championIcons';

interface HealthResponse {
  build?: {
    version?: string;
    gitHead?: string;
  };
}
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
  rankMovement: {
    delta: number;
    changedAt: string | null;
  };
  recentMatches: EventMatch[];
  lastUpdated: string;
  error: string | null;
}
interface LeaderboardHighlight {
  player: {
    id: number;
    gameName: string;
    tagLine: string;
    profileImageUrl: string;
  };
  value: number;
}
interface LeaderboardHighlights {
  longestWinStreak: LeaderboardHighlight | null;
  bestKda: LeaderboardHighlight | null;
  mostWins: LeaderboardHighlight | null;
}
interface LeaderboardResponse {
  ready: boolean;
  totalPlayers: number;
  loadedPlayers: number;
  lastUpdated: string | null;
  highlights: LeaderboardHighlights;
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

function formatVersion(version: string): string {
  return version.replace(/^(\d+\.\d+)\.0$/, '$1');
}
function formatGitHead(gitHead: string): string {
  if (gitHead === 'dev') {
    return 'dev';
  }
  return gitHead.slice(0, 7);
}
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
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.02-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.81-4.58 5.07.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.27 10.27 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}
function RankMovementIndicator({
  movement,
  now,
}: {
  movement: LeaderboardPlayer['rankMovement'];
  now: number;
}) {
  const changedAt = movement.changedAt ? new Date(movement.changedAt).getTime() : Number.NaN;
  const isRecent =
    movement.delta !== 0 && Number.isFinite(changedAt) && now > 0 && now - changedAt <= 180_000;
  if (!isRecent) {
    return (
      <span className="rank-movement neutral" title="No recent rank change">
        —
      </span>
    );
  }
  const climbed = movement.delta > 0;
  const positions = Math.abs(movement.delta);
  return (
    <span
      className={`rank-movement ${climbed ? 'up' : 'down'}`}
      title={`${climbed ? 'Climbed' : 'Dropped'} ${positions} position${
        positions === 1 ? '' : 's'
      }`}
    >
      {climbed ? '▲' : '▼'} {positions}
    </span>
  );
}
function PodiumCard({
  player,
  place,
  now,
}: {
  player: LeaderboardPlayer;
  place: 1 | 2 | 3;
  now: number;
}) {
  const winRate = getWinRate(player.record.wins, player.record.losses);
  return (
    <div className={`podium-slot podium-place-${place}`}>
      <article className="podium-card">
        <span className="podium-label">
          {place === 1 ? 'EVENT LEADER' : place === 2 ? 'SECOND PLACE' : 'THIRD PLACE'}
        </span>
        <img className="podium-profile" src={player.player.profileImageUrl} alt="" />
        <div className="podium-player">
          <strong>{player.player.gameName}</strong>
          <span>#{player.player.tagLine}</span>
        </div>
        <div className="podium-movement">
          <RankMovementIndicator movement={player.rankMovement} now={now} />
        </div>
        <div className="podium-rank">
          <strong>{formatRank(player.current.tier, player.current.division)}</strong>
          <span>{player.current.lp} LP</span>
        </div>
        <div className={`podium-gain ${player.lpGain >= 0 ? 'positive' : 'negative'}`}>
          {player.lpGain >= 0 ? '+' : ''}
          {player.lpGain} LP
        </div>
        <div className="podium-record">
          <span className="wins">{player.record.wins}W</span>
          <span>•</span>
          <span className="losses">{player.record.losses}L</span>
          <span>•</span>
          <span>{winRate}% WR</span>
        </div>
      </article>

      <div className="podium-step">
        <strong>{place}</strong>
      </div>
    </div>
  );
}
function EventHighlightCard({
  label,
  highlight,
  formatValue,
}: {
  label: string;
  highlight: LeaderboardHighlight | null;
  formatValue: (value: number) => string;
}) {
  return (
    <article className="event-highlight-card">
      <span className="event-highlight-label">{label}</span>
      {highlight ? (
        <>
          <div className="event-highlight-player">
            {highlight.player.profileImageUrl && (
              <img
                src={highlight.player.profileImageUrl}
                alt=""
                className="event-highlight-profile"
              />
            )}
            <div>
              <strong>{highlight.player.gameName}</strong>
              <span>#{highlight.player.tagLine}</span>
            </div>
          </div>
          <strong className="event-highlight-value">{formatValue(highlight.value)}</strong>
        </>
      ) : (
        <div className="event-highlight-empty">Waiting for matches</div>
      )}
    </article>
  );
}
function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [championIcons, setChampionIcons] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [buildInfo, setBuildInfo] = useState<HealthResponse['build']>();
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
    async function loadBuildInfo() {
      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Health API returned HTTP ${response.status}`);
        }
        const data = (await response.json()) as HealthResponse;
        setBuildInfo(data.build);
      } catch (err) {
        console.warn('Failed to load build information:', err);
      }
    }

    void loadBuildInfo();
  }, []);
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadLeaderboard();
    }, 0);
    const eventSource = new EventSource('/api/live');
    eventSource.addEventListener('leaderboard', () => {
      void loadLeaderboard();
    });
    eventSource.onopen = () => {
      void loadLeaderboard();
    };
    eventSource.onerror = () => {
      console.warn('Leaderboard live update connection lost; reconnecting...');
    };
    return () => {
      window.clearTimeout(initialTimer);
      eventSource.close();
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
  useEffect(() => {
    loadChampionIcons()
      .then(setChampionIcons)
      .catch((err) => {
        console.error('Failed to load champion icons:', err);
      });
  }, []);
  const players = useMemo(() => leaderboard?.players ?? [], [leaderboard]);
  const totalMatches = players.reduce((total, player) => total + player.record.games, 0);
  const averageLpGain =
    players.length > 0
      ? Math.round(players.reduce((total, player) => total + player.lpGain, 0) / players.length)
      : 0;
  const remainingPlayers = players.slice(3);
  const lastUpdateText =
    leaderboard?.lastUpdated && now > 0
      ? formatUpdatedAgo(leaderboard.lastUpdated, now).replace('Updated ', '')
      : '—';
  const eventStatus = leaderboard?.event.status ?? null;
  const eventStart = leaderboard?.event.startsAt
    ? new Date(leaderboard.event.startsAt).getTime()
    : null;
  const eventEnd = leaderboard?.event.endsAt ? new Date(leaderboard.event.endsAt).getTime() : null;
  let countdownLabel = '';
  let countdownValue = '';

  const frontendVersion = formatVersion(import.meta.env.VITE_APP_VERSION);
  const backendVersion = buildInfo?.version ? formatVersion(buildInfo.version) : '—';
  const gitHead = buildInfo?.gitHead ? formatGitHead(buildInfo.gitHead) : '—';

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
        {players.length === 0 && (
          <div className="empty-board">Waiting for the first player update...</div>
        )}
        {players.length > 0 && (
          <>
            <section className="event-summary-bar">
              <div className="event-summary-item">
                <span>Participants</span>
                <strong>{leaderboard?.totalPlayers ?? players.length}</strong>
              </div>
              <div className="event-summary-item">
                <span>Matches Played</span>
                <strong>{totalMatches}</strong>
              </div>
              <div className="event-summary-item">
                <span>Average LP Gain</span>
                <strong className={averageLpGain >= 0 ? 'positive' : 'negative'}>
                  {averageLpGain >= 0 ? '+' : ''}
                  {averageLpGain} LP
                </strong>
              </div>
              <div className="event-summary-item">
                <span>Last Update</span>
                <strong>{lastUpdateText}</strong>
              </div>
            </section>
            <section className="podium-section">
              <div className="podium-heading">
                <span className="eyebrow">TOP PLAYERS</span>
                <h2>Event Leaders</h2>
              </div>
              <div className="podium">
                {players[1] && <PodiumCard player={players[1]} place={2} now={now} />}
                {players[0] && <PodiumCard player={players[0]} place={1} now={now} />}
                {players[2] && <PodiumCard player={players[2]} place={3} now={now} />}
              </div>
            </section>
            <section className="event-highlights-section">
              <div className="event-highlights-heading">
                <span className="eyebrow">EVENT HIGHLIGHTS</span>
                <h2>Top Performers</h2>
              </div>
              <div className="event-highlights">
                <EventHighlightCard
                  label="LONGEST WIN STREAK"
                  highlight={leaderboard?.highlights.longestWinStreak ?? null}
                  formatValue={(value) => `${value} win${value === 1 ? '' : 's'}`}
                />
                <EventHighlightCard
                  label="BEST KDA"
                  highlight={leaderboard?.highlights.bestKda ?? null}
                  formatValue={(value) => `${value.toFixed(2)} KDA`}
                />
                <EventHighlightCard
                  label="MOST WINS"
                  highlight={leaderboard?.highlights.mostWins ?? null}
                  formatValue={(value) => `${value} win${value === 1 ? '' : 's'}`}
                />
              </div>
            </section>
          </>
        )}
        {remainingPlayers.length > 0 && (
          <section className="leaderboard">
            <div className="leaderboard-section-heading">
              <span className="eyebrow">STANDINGS</span>
              <h2>Leaderboard</h2>
            </div>
            <div className="leaderboard-header">
              <div>#</div>
              <div>Player</div>
              <div>Current</div>
              <div>LP Gain</div>
              <div>W / L</div>
              <div>WR</div>
            </div>
            {remainingPlayers.map((player, index) => {
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
                    <div className="place-cell">
                      <div className="place">{index + 4}</div>
                      <RankMovementIndicator movement={player.rankMovement} now={now} />
                    </div>
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
            })}
          </section>
        )}
        <footer>
          <div>Rankings are based on LP gained since the event started.</div>
          <div className="build-info">
            <span>Frontend: {frontendVersion}</span>
            <span className="build-separator">·</span>
            <span>Backend: {backendVersion}</span>
            <span className="build-separator">·</span>
            <a
              className="github-build-link"
              href="https://github.com/Sysadminfromhell/LP-Tracker"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LP-Tracker on GitHub"
              title="Open LP-Tracker on GitHub"
            >
              <GitHubIcon />
            </a>
            {buildInfo?.gitHead && buildInfo.gitHead !== 'dev' ? (
              <a
                className="git-head-link"
                href={`https://github.com/Sysadminfromhell/LP-Tracker/commit/${buildInfo.gitHead}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open commit ${buildInfo.gitHead}`}
              >
                {gitHead}
              </a>
            ) : (
              <span className="git-head">{gitHead}</span>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
export default LeaderboardPage;
