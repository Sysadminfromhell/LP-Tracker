import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { EventHistoryDetailsResponse, EventHistoryStanding } from '@lp-tracker/contracts';
import { getRankIconUrl } from '../rankIcons';
import PublicLegalLinks from '../components/PublicLegalLinks';

const divisions: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

function formatEventDate(date: string): string {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function formatRank(tier: string, division: number | null): string {
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  return division === null ? formattedTier : `${formattedTier} ${divisions[division] ?? division}`;
}
function StandingRank({ standing }: { standing: EventHistoryStanding }) {
  const iconUrl = getRankIconUrl(standing.final.tier);
  return (
    <div className="event-history-final-rank">
      {iconUrl && (
        <img src={iconUrl} alt="" aria-hidden="true" className="rank-emblem rank-emblem-current" />
      )}
      <div>
        <strong>{formatRank(standing.final.tier, standing.final.division)}</strong>
        <span>{standing.final.lp} LP</span>
      </div>
    </div>
  );
}
function EventHistoryDetailsPage() {
  const { eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const validEventId = Number.isSafeInteger(eventId) && eventId > 0;
  const [details, setDetails] = useState<EventHistoryDetailsResponse | null>(null);
  const [error, setError] = useState<{ eventId: number; message: string } | null>(null);
  const currentDetails = details?.event.id === eventId ? details : null;
  const currentError = error?.eventId === eventId ? error.message : null;
  useEffect(() => {
    if (!validEventId) {
      return;
    }
    let disposed = false;
    let reloadInProgress = false;
    let reloadPending = false;
    let initialConnection = true;
    let loadedSuccessfully = false;
    async function load() {
      const response = await fetch(`/api/events/history/${eventId}`, {
        cache: 'no-store',
      });
      if (response.status === 404) {
        throw new Error('Event history not found');
      }
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as EventHistoryDetailsResponse;
      if (disposed) {
        return;
      }
      setDetails(data);
      setError(null);
      loadedSuccessfully = true;
    }
    async function reload() {
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
          if (loadedSuccessfully) {
            console.warn('Failed to refresh event history:', loadError);
          } else {
            setError({
              eventId,
              message:
                loadError instanceof Error ? loadError.message : 'Failed to load event history',
            });
          }
        }
      } finally {
        reloadInProgress = false;
        if (reloadPending && !disposed) {
          reloadPending = false;
          void reload();
        }
      }
    }
    void reload();
    const eventSource = new EventSource('/api/live');
    eventSource.addEventListener('events-changed', reload);
    eventSource.onopen = () => {
      if (initialConnection) {
        initialConnection = false;
        return;
      }
      void reload();
    };
    eventSource.onerror = () => {
      console.warn('Event history live update connection lost; reconnecting...');
    };
    return () => {
      disposed = true;
      eventSource.removeEventListener('events-changed', reload);
      eventSource.close();
    };
  }, [eventId, validEventId]);
  if (!validEventId) {
    return (
      <main className="page">
        <div className="status-screen error">Invalid event id</div>
      </main>
    );
  }
  if (currentError && !currentDetails) {
    return (
      <main className="page">
        <div className="status-screen error">{currentError}</div>
      </main>
    );
  }
  if (!currentDetails) {
    return (
      <main className="page">
        <div className="status-screen">Loading event standings...</div>
      </main>
    );
  }
  return (
    <main className="page">
      <div className="player-details event-history-details">
        <header className="player-details-header">
          <div className="player-details-section-heading">
            <span>EVENT ARCHIVE</span>
            <h1>{currentDetails.event.name}</h1>
            <span>
              {formatEventDate(currentDetails.event.startsAt)} –{' '}
              {formatEventDate(currentDetails.event.endsAt)}
            </span>
          </div>
          <Link className="player-profile-link" to="/history">
            ← Event History
          </Link>
        </header>
        <div className="player-details-summary">
          <div>
            <span>Participants</span>
            <strong>{currentDetails.event.participantCount}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Ended</strong>
          </div>
          <div>
            <span>Started</span>
            <strong>{formatEventDate(currentDetails.event.startsAt)}</strong>
          </div>
          <div>
            <span>Ended</span>
            <strong>{formatEventDate(currentDetails.event.endsAt)}</strong>
          </div>
        </div>
        <section className="event-history-standings">
          <div className="player-details-section-heading">
            <span>FINAL RESULTS</span>
            <h2>Final Standings</h2>
          </div>
          {currentDetails.standings.length === 0 ? (
            <div className="player-details-empty">No standings available.</div>
          ) : (
            <div className="event-history-standing-list">
              {currentDetails.standings.map((standing, index) => (
                <article className="event-history-standing" key={standing.player.id}>
                  <strong className="event-history-place">#{index + 1}</strong>
                  <Link
                    className="event-history-player player-profile-link"
                    to={`/players/${standing.player.id}`}
                  >
                    {standing.player.profileImageUrl && (
                      <img src={standing.player.profileImageUrl} alt="" />
                    )}
                    <div>
                      <strong>{standing.player.gameName}</strong>
                      <span>#{standing.player.tagLine}</span>
                    </div>
                  </Link>
                  <div className="event-history-start-rank">
                    <span>Start</span>
                    <strong>{formatRank(standing.start.tier, standing.start.division)}</strong>
                    <small>{standing.start.lp} LP</small>
                  </div>
                  <StandingRank standing={standing} />
                  <div
                    className={`event-history-gain ${
                      standing.lpGain >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {standing.lpGain >= 0 ? '+' : ''}
                    {standing.lpGain} LP
                  </div>
                  <div className="event-history-record">
                    <strong>
                      {standing.record.wins}W – {standing.record.losses}L
                    </strong>
                    <span>{standing.record.games} Games</span>
                  </div>
                  <div className="event-history-penalty">
                    {standing.penalty.lp > 0 ? (
                      <>
                        <strong>-{standing.penalty.lp} LP</strong>
                        <span>{standing.penalty.reason ?? 'Penalty'}</span>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <footer className="public-page-footer">
        <PublicLegalLinks />
      </footer>
    </main>
  );
}
export default EventHistoryDetailsPage;
