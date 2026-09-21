import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import MatchDetailsPopover from '../components/MatchDetailsPopover';
import {
  getCachedMatchDetails,
  loadMatchDetails,
  type MatchDetailsResponse,
} from '../matchDetails';
import type {
  PlayerHistoryMatch,
  PlayerEventDetailsResponse,
  PlayerEventSummary,
  PlayerProfileResponse,
} from '@lp-tracker/contracts';
import { loadChampionIcons } from '../championIcons';
import { loadItemIconUrls } from '../itemIcons';
import {
  shouldReloadPlayerProfileForLeaderboard,
  shouldReloadPlayerProfileForRefresh,
} from '../player-profile-live';

const divisions: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
function formatLpDelta(match: PlayerHistoryMatch): string {
  if (match.lpDelta !== null) {
    return `${match.lpDelta >= 0 ? '+' : ''}${match.lpDelta} LP`;
  }
  return match.lpDeltaStatus === 'pending' ? 'Pending' : 'Unknown';
}
function formatRank(tier: string, division: number | null): string {
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  if (division === null) {
    return formattedTier;
  }
  return `${formattedTier} ${divisions[division] ?? division}`;
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
function formatPosition(position: string): string {
  switch (position.toUpperCase()) {
    case 'JUNGLE':
      return 'JGL';
    case 'SUPPORT':
      return 'SUP';
    default:
      return position.toUpperCase();
  }
}
function MatchHistory({
  eventId,
  matches,
  championIcons,
  opggMatchHistoryUrl,
  onMatchHover,
  onMatchLeave,
}: {
  eventId: number;
  matches: PlayerHistoryMatch[];
  championIcons: Map<number, string>;
  opggMatchHistoryUrl: string;
  onMatchHover: (eventId: number, matchId: string, target: HTMLElement) => void;
  onMatchLeave: () => void;
}) {
  const [itemIcons, setItemIcons] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const itemIds = Array.from(new Set(matches.flatMap((match) => match.items ?? [])));
    if (itemIds.length === 0) {
      return;
    }
    let disposed = false;
    void loadItemIconUrls(itemIds)
      .then((icons) => {
        if (!disposed) {
          setItemIcons(icons);
        }
      })
      .catch((loadError) => {
        console.warn('Failed to load item icons:', loadError);
      });
    return () => {
      disposed = true;
    };
  }, [matches]);
  if (matches.length === 0) {
    return <div className="player-details-empty">No ranked games in this event.</div>;
  }
  return (
    <div className="player-match-table-wrap">
      <div className="player-match-table">
        <div className="player-match-table-header">
          <span>Champion</span>
          <span>Result</span>
          <span>KDA</span>
          <span>CS</span>
          <span>Items</span>
          <span>LP</span>
          <span>Duration</span>
          <span>Played</span>
          <span />
        </div>
        {matches.map((match) => {
          const championIcon = championIcons.get(match.championId);
          return (
            <article
              className={`player-details-match ${
                match.result === 'WIN' ? 'player-details-match-win' : 'player-details-match-loss'
              }`}
              key={match.id}
              onMouseEnter={(event) => onMatchHover(eventId, match.id, event.currentTarget)}
              onMouseLeave={onMatchLeave}
            >
              <div className="player-details-match-champion">
                {championIcon ? (
                  <img src={championIcon} alt={match.champion} />
                ) : (
                  <div className="player-details-champion-placeholder" />
                )}
                <div>
                  <strong>{match.champion}</strong>
                  <span>{formatPosition(match.position)}</span>
                </div>
              </div>
              <strong className={match.result === 'WIN' ? 'positive' : 'negative'}>
                {match.result === 'WIN' ? 'WIN' : 'LOSS'}
              </strong>
              <span className="player-match-kda">
                {match.kills}/{match.deaths}/{match.assists}
              </span>
              <span>{match.cs} CS</span>
              <div className="player-match-items">
                {Array.from({ length: 6 }).map((_, index) => {
                  const itemId = match.items?.[index];
                  const icon = itemId ? itemIcons.get(itemId) : undefined;
                  return (
                    <span className="player-match-item" key={index}>
                      {icon && <img src={icon} alt="" title={`Item ${itemId}`} />}
                    </span>
                  );
                })}
              </div>
              <span
                className={
                  match.lpDelta === null
                    ? 'player-match-lp unknown'
                    : match.lpDelta >= 0
                      ? 'player-match-lp positive'
                      : 'player-match-lp negative'
                }
              >
                {formatLpDelta(match)}
              </span>
              <span>{formatDuration(match.durationSeconds)}</span>
              <span className="player-match-date">{formatEventDate(match.createdAt)}</span>

              <a
                className="player-match-external"
                href={opggMatchHistoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open match history on OP.GG"
                aria-label="Open match history on OP.GG"
              >
                ↗
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}
function EventSummary({ event }: { event: PlayerEventSummary }) {
  const endLabel = event.status === 'active' ? 'Current LP' : 'Event End LP';
  return (
    <div className="player-details-summary">
      <div>
        <span>Event Start LP</span>
        <strong>
          {formatRank(event.start.tier, event.start.division)} {event.start.lp} LP
        </strong>
      </div>

      <div>
        <span>{endLabel}</span>
        <strong>
          {formatRank(event.current.tier, event.current.division)} {event.current.lp} LP
        </strong>
      </div>
      <div>
        <span>Trend</span>
        <strong className={event.lpGain >= 0 ? 'positive' : 'negative'}>
          {event.lpGain >= 0 ? '+' : ''}
          {event.lpGain} LP
        </strong>
      </div>
      <div>
        <span>Main Role</span>
        <strong>{event.mainRole ?? 'Unknown'}</strong>
      </div>
    </div>
  );
}
interface MatchHoverState {
  eventId: number;
  playerId: number;
  matchId: string;
  x: number;
  y: number;
  placement: 'above' | 'below';
  details: MatchDetailsResponse | null;
  loading: boolean;
  unavailable: boolean;
  error: string | null;
}
function getOpggMatchHistoryUrl(gameName: string, tagLine: string, region: string): string {
  return (
    `https://op.gg/lol/summoners/` +
    `${encodeURIComponent(region.toLowerCase())}/` +
    `${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}/matches`
  );
}
function PlayerDetailsPage() {
  const { playerId: playerIdParam } = useParams();
  const playerId = Number(playerIdParam);
  const validPlayerId = Number.isSafeInteger(playerId) && playerId > 0;
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [latestDetails, setLatestDetails] = useState<PlayerEventDetailsResponse | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<number, PlayerEventDetailsResponse>>(
    {},
  );
  const [loadingEventId, setLoadingEventId] = useState<number | null>(null);
  const [eventErrors, setEventErrors] = useState<Record<number, string>>({});
  const [championIcons, setChampionIcons] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [matchHover, setMatchHover] = useState<MatchHoverState | null>(null);
  const hoverRequestRef = useRef(0);
  function handleMatchHover(eventId: number, matchId: string, target: HTMLElement): void {
    if (!validPlayerId) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const popupWidth = Math.min(680, Math.max(0, window.innerWidth - 24));
    const halfWidth = popupWidth / 2;
    const targetCenter = rect.left + rect.width / 2;
    const x =
      popupWidth >= window.innerWidth - 24
        ? window.innerWidth / 2
        : Math.min(window.innerWidth - halfWidth - 12, Math.max(halfWidth + 12, targetCenter));
    const estimatedHeight = 430;
    const placement: 'above' | 'below' =
      rect.bottom + estimatedHeight + 12 <= window.innerHeight ? 'below' : 'above';
    const y = placement === 'below' ? rect.bottom + 8 : rect.top - 8;
    const cached = getCachedMatchDetails(eventId, playerId, matchId);
    const requestId = ++hoverRequestRef.current;
    setMatchHover({
      eventId,
      playerId,
      matchId,
      x,
      y,
      placement,
      details: cached,
      loading: cached === null,
      unavailable: false,
      error: null,
    });
    if (cached) {
      return;
    }
    void loadMatchDetails(eventId, playerId, matchId)
      .then((details) => {
        if (hoverRequestRef.current !== requestId) {
          return;
        }
        setMatchHover((current) => {
          if (
            !current ||
            current.eventId !== eventId ||
            current.playerId !== playerId ||
            current.matchId !== matchId
          ) {
            return current;
          }
          return {
            ...current,
            details,
            loading: false,
            unavailable: details === null,
            error: null,
          };
        });
      })
      .catch((loadError) => {
        if (hoverRequestRef.current !== requestId) {
          return;
        }
        setMatchHover((current) => {
          if (
            !current ||
            current.eventId !== eventId ||
            current.playerId !== playerId ||
            current.matchId !== matchId
          ) {
            return current;
          }
          return {
            ...current,
            loading: false,
            error: loadError instanceof Error ? loadError.message : String(loadError),
          };
        });
      });
  }
  function handleMatchLeave(): void {
    hoverRequestRef.current++;
    setMatchHover(null);
  }
  useEffect(() => {
    void loadChampionIcons().then(setChampionIcons);
  }, []);
  useEffect(() => {
    if (!validPlayerId) {
      return;
    }
    setProfile(null);
    setLatestDetails(null);
    setExpandedEvents({});
    setEventErrors({});
    setLoadingEventId(null);
    setMatchHover(null);
    hoverRequestRef.current++;
    let disposed = false;
    let reloadTimer: number | null = null;
    let reloadInProgress = false;
    let reloadPending = false;
    let initialConnection = true;
    let loadedSuccessfully = false;
    async function load() {
      const profileResponse = await fetch(`/api/players/${playerId}`, {
        cache: 'no-store',
      });
      if (profileResponse.status === 404) {
        throw new Error('Player not found');
      }
      if (!profileResponse.ok) {
        throw new Error(`API returned HTTP ${profileResponse.status}`);
      }
      const nextProfile = (await profileResponse.json()) as PlayerProfileResponse;
      if (disposed) {
        return;
      }
      setProfile(nextProfile);
      if (!nextProfile.latestEvent) {
        setLatestDetails(null);
        loadedSuccessfully = true;
        setError(null);
        return;
      }
      const eventResponse = await fetch(
        `/api/players/${playerId}/events/${nextProfile.latestEvent.id}`,
        {
          cache: 'no-store',
        },
      );
      if (!eventResponse.ok) {
        throw new Error(`API returned HTTP ${eventResponse.status}`);
      }
      const details = (await eventResponse.json()) as PlayerEventDetailsResponse;
      if (disposed) {
        return;
      }
      setLatestDetails(details);
      loadedSuccessfully = true;
      setError(null);
    }
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
      } catch (loadError) {
        if (!disposed) {
          const message = loadError instanceof Error ? loadError.message : 'Failed to load player';
          if (loadedSuccessfully) {
            console.warn('Failed to refresh player profile:', loadError);
          } else {
            setError(message);
          }
        }
      } finally {
        reloadInProgress = false;
        if (reloadPending && !disposed) {
          reloadPending = false;
          scheduleReload();
        }
      }
    }
    const handleLeaderboardUpdate = (event: MessageEvent<string>) => {
      if (shouldReloadPlayerProfileForLeaderboard(playerIdParam, event.data)) {
        scheduleReload();
      }
    };
    const handlePlayerRefreshed = (event: MessageEvent<string>) => {
      if (shouldReloadPlayerProfileForRefresh(playerIdParam, event.data)) {
        scheduleReload();
      }
    };
    const handleEventsChanged = () => {
      scheduleReload();
    };
    void reloadPlayerOnce();
    const eventSource = new EventSource('/api/live');
    eventSource.addEventListener('leaderboard', handleLeaderboardUpdate);
    eventSource.addEventListener('player-refreshed', handlePlayerRefreshed);
    eventSource.addEventListener('events-changed', handleEventsChanged);
    eventSource.onopen = () => {
      if (initialConnection) {
        initialConnection = false;
        return;
      }
      scheduleReload();
    };
    eventSource.onerror = () => {
      console.warn('Player profile live update connection lost; reconnecting...');
    };
    return () => {
      disposed = true;
      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
      eventSource.removeEventListener('leaderboard', handleLeaderboardUpdate);
      eventSource.removeEventListener('player-refreshed', handlePlayerRefreshed);
      eventSource.removeEventListener('events-changed', handleEventsChanged);
      eventSource.close();
    };
  }, [playerId, playerIdParam, validPlayerId]);
  async function togglePreviousEvent(eventId: number) {
    if (expandedEvents[eventId]) {
      setExpandedEvents((current) => {
        const next = { ...current };
        delete next[eventId];
        return next;
      });
      return;
    }
    if (!validPlayerId) {
      return;
    }
    setLoadingEventId(eventId);
    setEventErrors((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    try {
      const response = await fetch(`/api/players/${playerId}/events/${eventId}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const details = (await response.json()) as PlayerEventDetailsResponse;
      setExpandedEvents((current) => ({
        ...current,
        [eventId]: details,
      }));
    } catch (loadError) {
      setEventErrors((current) => ({
        ...current,
        [eventId]: loadError instanceof Error ? loadError.message : 'Failed to load event',
      }));
    } finally {
      setLoadingEventId(null);
    }
  }
  if (!validPlayerId) {
    return (
      <main className="page">
        <div className="status-screen error">Invalid player id</div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="page">
        <div className="status-screen error">{error}</div>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="page">
        <div className="status-screen">Loading player...</div>
      </main>
    );
  }
  const opggMatchHistoryUrl = getOpggMatchHistoryUrl(
    profile.player.gameName,
    profile.player.tagLine,
    profile.player.region,
  );
  return (
    <main className="page">
      {matchHover && (
        <MatchDetailsPopover
          details={matchHover.details}
          loading={matchHover.loading}
          unavailable={matchHover.unavailable}
          error={matchHover.error}
          x={matchHover.x}
          y={matchHover.y}
          placement={matchHover.placement}
          championIcons={championIcons}
        />
      )}
      <section className="tracker player-details">
        <header className="player-details-header">
          <div className="player-details-identity">
            <img src={profile.player.profileImageUrl} alt="" />
            <div>
              <span className="eyebrow">PLAYER PROFILE</span>
              <h1>
                {profile.player.gameName}
                <span>#{profile.player.tagLine}</span>
              </h1>
              <div>{profile.player.region}</div>
            </div>
          </div>
          <Link to="/" className="overlay-link">
            ← Back to leaderboard
          </Link>
        </header>
        {!profile.latestEvent ? (
          <div className="player-details-empty">This player has not attended an event yet.</div>
        ) : (
          <>
            <EventSummary event={profile.latestEvent} />
            <section className="player-details-event">
              <div className="player-details-section-heading">
                <span className="eyebrow">LAST ATTENDED EVENT</span>
                <h2>{profile.latestEvent.name}</h2>
                <span>
                  {formatEventDate(profile.latestEvent.startsAt)} –{' '}
                  {formatEventDate(profile.latestEvent.endsAt)}
                </span>
              </div>
              <h3>Match History</h3>
              {latestDetails ? (
                <MatchHistory
                  eventId={latestDetails.event.id}
                  matches={latestDetails.matches}
                  championIcons={championIcons}
                  opggMatchHistoryUrl={opggMatchHistoryUrl}
                  onMatchHover={handleMatchHover}
                  onMatchLeave={handleMatchLeave}
                />
              ) : (
                <div className="player-details-empty">Loading match history...</div>
              )}
            </section>
            {profile.previousEvents.length > 0 && (
              <section className="player-details-previous">
                <div className="player-details-section-heading">
                  <span className="eyebrow">HISTORY</span>
                  <h2>Previous attended events</h2>
                </div>
                {profile.previousEvents.map((event) => {
                  const details = expandedEvents[event.id];
                  const expanded = details !== undefined;
                  return (
                    <article className="player-details-history-event" key={event.id}>
                      <button
                        type="button"
                        className="player-details-history-toggle"
                        onClick={() => void togglePreviousEvent(event.id)}
                      >
                        <div>
                          <strong>{event.name}</strong>
                          <span>
                            {formatEventDate(event.startsAt)} – {formatEventDate(event.endsAt)}
                          </span>
                        </div>
                        <span className={event.lpGain >= 0 ? 'positive' : 'negative'}>
                          {event.lpGain >= 0 ? '+' : ''}
                          {event.lpGain} LP
                        </span>
                        <span>{expanded ? '▲' : '▼'}</span>
                      </button>
                      {loadingEventId === event.id && (
                        <div className="player-details-empty">Loading event...</div>
                      )}
                      {eventErrors[event.id] && (
                        <div className="player-details-empty error">{eventErrors[event.id]}</div>
                      )}
                      {details && (
                        <div className="player-details-history-content">
                          <EventSummary event={details.event} />
                          <MatchHistory
                            eventId={details.event.id}
                            matches={details.matches}
                            championIcons={championIcons}
                            opggMatchHistoryUrl={opggMatchHistoryUrl}
                            onMatchHover={handleMatchHover}
                            onMatchLeave={handleMatchLeave}
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
export default PlayerDetailsPage;
