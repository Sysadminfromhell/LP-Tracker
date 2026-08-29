import { useCallback, useEffect, useState, type FormEvent } from 'react';

interface AdminEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  status: 'draft' | 'active' | 'ended';
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}
interface AdminEventResponse {
  event: AdminEvent | null;
}
interface AdminEventPanelProps {
  onUnauthorized: () => void;
}
interface EventScheduleForm {
  name: string;
  startsAt: string;
  endsAt: string;
}
function pad(value: number): string {
  return String(value).padStart(2, '0');
}
function toLocalDateTimeValue(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}
function getMinimumScheduleStart(): string {
  const minimum = new Date();
  minimum.setSeconds(0, 0);
  minimum.setMinutes(minimum.getMinutes() + 1);
  return toLocalDateTimeValue(minimum);
}
function createDefaultSchedule(): EventScheduleForm {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 10);
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return {
    name: 'LP Gain Event',
    startsAt: toLocalDateTimeValue(start),
    endsAt: toLocalDateTimeValue(end),
  };
}
function createScheduleFromEvent(event: AdminEvent): EventScheduleForm {
  return {
    name: event.name,
    startsAt: toLocalDateTimeValue(new Date(event.startsAt)),
    endsAt: event.endsAt ? toLocalDateTimeValue(new Date(event.endsAt)) : '',
  };
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
function formatEventDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
function AdminEventPanel({ onUnauthorized }: AdminEventPanelProps) {
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [eventName, setEventName] = useState('');
  const [schedule, setSchedule] = useState<EventScheduleForm>(createDefaultSchedule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadEvent = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/event');
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as AdminEventResponse;
      setEvent(data.event);
      setEventName(data.event?.name ?? '');
      if (data.event?.status === 'draft') {
        setSchedule(createScheduleFromEvent(data.event));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load event.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);
  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);
  useEffect(() => {
    if (event?.status !== 'active') {
      return;
    }
    const interval = window.setInterval(() => {
      void loadEvent();
    }, 5_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [event?.status, loadEvent]);
  async function handleRename(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/event', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: eventName,
        }),
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as {
        event: AdminEvent;
      };
      setEvent(data.event);
      setEventName(data.event.name);
      setMessage('Event name updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update event.');
    } finally {
      setSaving(false);
    }
  }
  async function handleSchedule(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const startsAt = new Date(schedule.startsAt);
    const endsAt = new Date(schedule.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Please enter a valid start and end time.');
      return;
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Please enter a valid start and end time.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      setError('Event start cannot be in the past.');
      return;
    }
    if (endsAt <= startsAt) {
      setError('Event end must be after event start.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/event/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: schedule.name,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as {
        event: AdminEvent;
      };
      setEvent(data.event);
      setEventName(data.event.name);
      setMessage('Event scheduled successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule event.');
    } finally {
      setSaving(false);
    }
  }
  async function handleEnd() {
    if (!event || event.status !== 'active') {
      return;
    }
    const confirmed = window.confirm(
      `End "${event.name}" now?\n\nThe current leaderboard will be frozen as the final result.`,
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/event/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (response.status === 404) {
        await loadEvent();
        setMessage('Event has already ended.');
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      await loadEvent();
      setSchedule(createDefaultSchedule());
      setMessage('Event ended. Final standings are now frozen.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end event.');
    } finally {
      setSaving(false);
    }
  }
  if (loading) {
    return (
      <div className="admin-section">
        <div className="admin-player-empty">Loading event...</div>
      </div>
    );
  }
  async function handleUpdateSchedule(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event || event.status !== 'draft') {
      return;
    }
    const startsAt = new Date(schedule.startsAt);
    const endsAt = new Date(schedule.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Please enter a valid start and end time.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      setError('Event start cannot be in the past.');
      return;
    }
    if (endsAt <= startsAt) {
      setError('Event end must be after event start.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/event/schedule', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: schedule.name,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as {
        event: AdminEvent;
      };
      setEvent(data.event);
      setEventName(data.event.name);
      setSchedule(createScheduleFromEvent(data.event));
      setMessage('Schedule updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update schedule.');
    } finally {
      setSaving(false);
    }
  }
  async function handleCancelScheduledEvent() {
    if (!event || event.status !== 'draft') {
      return;
    }
    const confirmed = window.confirm(`Cancel "${event.name}"?\n\nThe event will not be started.`);
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/event/schedule', {
        method: 'DELETE',
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setSchedule(createDefaultSchedule());
      await loadEvent();
      setMessage('Scheduled event canceled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel scheduled event.');
    } finally {
      setSaving(false);
    }
  }
  const canSchedule = !event || event.status === 'ended';
  const minimumStartAt = getMinimumScheduleStart();
  return (
    <div className="admin-section admin-event-section">
      <div className="admin-section-header">
        <div>
          <span className="admin-section-eyebrow">EVENT CONTROL</span>
          <h2>Event</h2>
          <p>Schedule, monitor and control the LP Gain Event.</p>
        </div>
        {event && (
          <span className={`admin-event-status admin-event-status-${event.status}`}>
            <span className="admin-event-status-dot" />
            {event.status === 'draft'
              ? 'Scheduled'
              : event.status === 'active'
                ? 'Active'
                : 'Ended'}
          </span>
        )}
      </div>
      {error && <div className="admin-message admin-message-error">{error}</div>}
      {message && <div className="admin-message admin-message-success">{message}</div>}
      {event && (
        <>
          <div className="admin-event-overview">
            <div className="admin-event-name-block">
              <span className="admin-event-label">EVENT</span>
              <strong>{event.name}</strong>
            </div>
            <div className="admin-event-stat">
              <span>Start</span>
              <strong>{formatEventDate(event.startsAt)}</strong>
            </div>
            <div className="admin-event-stat">
              <span>End</span>
              <strong>{formatEventDate(event.endsAt)}</strong>
            </div>
            <div className="admin-event-stat">
              <span>Participants</span>
              <strong>{event.status === 'draft' ? 'Pending' : event.participantCount}</strong>
            </div>
          </div>
          {event.status !== 'draft' && (
            <form className="admin-event-rename" onSubmit={handleRename}>
              <label>
                Event Name
                <input
                  type="text"
                  value={eventName}
                  disabled={saving}
                  required
                  onChange={(eventInput) => {
                    setEventName(eventInput.target.value);
                  }}
                />
              </label>
              <button
                className="admin-secondary-button"
                type="submit"
                disabled={saving || eventName.trim() === event.name}
              >
                Save Name
              </button>
            </form>
          )}
        </>
      )}
      {event?.status === 'draft' && (
        <form className="admin-schedule-event" onSubmit={handleUpdateSchedule}>
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">SCHEDULED EVENT</span>
            <h3>Edit schedule</h3>
            <p>Changes are allowed until the event has actually started.</p>
          </div>
          <div className="admin-schedule-grid">
            <label>
              Event Name
              <input
                type="text"
                value={schedule.name}
                disabled={saving}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    name: eventInput.target.value,
                  }));
                }}
              />
            </label>
            <label>
              Start
              <input
                type="datetime-local"
                value={schedule.startsAt}
                disabled={saving}
                min={minimumStartAt}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    startsAt: eventInput.target.value,
                  }));
                }}
              />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                value={schedule.endsAt}
                disabled={saving}
                min={schedule.startsAt || minimumStartAt}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    endsAt: eventInput.target.value,
                  }));
                }}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
            <button
              className="admin-danger-button"
              type="button"
              disabled={saving}
              onClick={() => {
                void handleCancelScheduledEvent();
              }}
            >
              Cancel Event
            </button>
          </div>
        </form>
      )}
      {event?.status === 'active' && (
        <div className="admin-event-danger-zone">
          <div>
            <strong>End Event Now</strong>
            <span>The event normally ends automatically at {formatEventDate(event.endsAt)}.</span>
          </div>
          <button
            className="admin-danger-button"
            type="button"
            disabled={saving}
            onClick={() => {
              void handleEnd();
            }}
          >
            {saving ? 'Working...' : 'End Event Now'}
          </button>
        </div>
      )}
      {canSchedule && (
        <form className="admin-schedule-event" onSubmit={handleSchedule}>
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">NEXT EVENT</span>
            <h3>Schedule event</h3>
            <p>
              Start must remain in the future. Changes are allowed until the event has actually
              started.
            </p>
          </div>
          <div className="admin-schedule-grid">
            <label>
              Event Name
              <input
                type="text"
                value={schedule.name}
                disabled={saving}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    name: eventInput.target.value,
                  }));
                }}
              />
            </label>
            <label>
              Start
              <input
                type="datetime-local"
                value={schedule.startsAt}
                disabled={saving}
                min={minimumStartAt}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    startsAt: eventInput.target.value,
                  }));
                }}
              />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                value={schedule.endsAt}
                disabled={saving}
                min={schedule.startsAt || minimumStartAt}
                required
                onChange={(eventInput) => {
                  setSchedule((current) => ({
                    ...current,
                    endsAt: eventInput.target.value,
                  }));
                }}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving}>
              {saving ? 'Scheduling...' : 'Schedule Event'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
export default AdminEventPanel;
