import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { EventHistoryResponse } from '@lp-tracker/contracts';

function formatEventDate(date: string): string {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventHistoryPage() {
  const [history, setHistory] = useState<EventHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let reloadInProgress = false;
    let reloadPending = false;
    let initialConnection = true;
    async function load() {
      const response = await fetch('/api/events/history', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as EventHistoryResponse;
      if (disposed) {
        return;
      }
      setHistory(data);
      setError(null);
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load event history');
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
  }, []);
  if (error && !history) {
    return (
      <main className="page">
        <div className="status-screen error">{error}</div>
      </main>
    );
  }
  if (!history) {
    return (
      <main className="page">
        <div className="status-screen">Loading event history...</div>
      </main>
    );
  }
  return (
    <main className="page">
      <div className="player-details">
        <header className="player-details-header">
          <div className="player-details-section-heading">
            <span>ARCHIVE</span>
            <h1>Event History</h1>
            <span>Completed LP Tracker events and final standings.</span>
          </div>
        </header>
        {error && <div className="player-details-empty error">{error}</div>}
        {history.events.length === 0 ? (
          <div className="player-details-empty">No completed events yet.</div>
        ) : (
          <section className="player-details-previous">
            {history.events.map((event) => (
              <article className="player-details-history-event" key={event.id}>
                <Link
                  className="player-details-history-toggle player-profile-link"
                  to={`/history/${event.id}`}
                >
                  <div>
                    <strong>{event.name}</strong>
                    <span>
                      {formatEventDate(event.startsAt)} – {formatEventDate(event.endsAt)}
                    </span>
                  </div>
                  <div>
                    <strong>{event.participantCount}</strong>
                    <span>{event.participantCount === 1 ? 'Participant' : 'Participants'}</span>
                  </div>

                  <span>›</span>
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
export default EventHistoryPage;
