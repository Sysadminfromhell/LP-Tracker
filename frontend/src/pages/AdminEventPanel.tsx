import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import type { AdminToastVariant } from '../components/AdminToastHost';

interface AdminEventPanelProps {
  onUnauthorized: () => void;
  onNotify: (variant: AdminToastVariant, message: string) => void;
}
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
function AdminEventPanel({ onUnauthorized, onNotify }: AdminEventPanelProps) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [eventName, setEventName] = useState('');
  const [schedule, setSchedule] = useState<EventScheduleForm>(createDefaultSchedule);
  const [draftSchedule, setDraftSchedule] = useState<EventScheduleForm>(createDefaultSchedule);
  const draftEvents = events
    .filter((item) => item.status === 'draft')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const selectedDraft = draftEvents.find((item) => item.id === selectedDraftId) ?? null;
  const hasOpenEvents = events.some((item) => item.status === 'draft' || item.status === 'active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<'end-event' | 'cancel-scheduled-event' | null>(
    null,
  );
  const loadEvents = useCallback(
    async (notifyOnError = true) => {
      try {
        const response = await fetch('/api/admin/events', {
          cache: 'no-store',
        });
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const data = (await response.json()) as {
          events: AdminEvent[];
        };
        const activeEvent = data.events.find((item) => item.status === 'active') ?? null;
        const latestEndedEvent =
          data.events
            .filter((item) => item.status === 'ended')
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0] ??
          null;
        const primaryEvent = activeEvent ?? latestEndedEvent ?? null;
        console.log(
          `[ADMIN EVENT] Poll: ${data.events.length} event(s) | ` +
            `primary=${primaryEvent?.id ?? 'none'} | ` +
            `${primaryEvent?.status ?? 'none'}`,
        );
        setEvents(data.events);
        setEvent(primaryEvent);
        setEventName(primaryEvent?.name ?? '');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Could not load event.';
        if (notifyOnError) {
          onNotify('error', errorMessage);
        } else {
          console.warn('Could not refresh admin events:', errorMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [onNotify, onUnauthorized],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvents();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadEvents]);
  useEffect(() => {
    if (!hasOpenEvents) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadEvents(false);
    }, 5_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [hasOpenEvents, loadEvents]);
  async function handleRename(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${event.id}/name`, {
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
      setEvents((current) =>
        current.map((item) => (item.id === data.event.id ? data.event : item)),
      );
      setEventName(data.event.name);
      onNotify('success', 'Event name updated.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update event.');
    } finally {
      setSaving(false);
    }
  }
  async function handleSchedule(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const startsAt = new Date(schedule.startsAt);
    const endsAt = new Date(schedule.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      onNotify('error', 'Please enter a valid start and end time.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      onNotify('error', 'Event start cannot be in the past.');
      return;
    }
    if (endsAt <= startsAt) {
      onNotify('error', 'Event end must be after event start.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/events', {
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
      setEvents((current) => [...current.filter((item) => item.id !== data.event.id), data.event]);
      setSchedule(createDefaultSchedule());
      onNotify('success', 'Event scheduled successfully.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not schedule event.');
    } finally {
      setSaving(false);
    }
  }
  async function handleEnd() {
    if (!event || event.status !== 'active') {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${event.id}/end`, {
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
        await loadEvents();
        onNotify('error', 'Event has already ended.');
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      await loadEvents();
      setSchedule(createDefaultSchedule());
      onNotify('success', 'Event ended. Final standings are now frozen.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not end event.');
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
    if (!selectedDraft) {
      return;
    }
    const startsAt = new Date(draftSchedule.startsAt);
    const endsAt = new Date(draftSchedule.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      onNotify('error', 'Please enter a valid start and end time.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      onNotify('error', 'Event start cannot be in the past.');
      return;
    }
    if (endsAt <= startsAt) {
      onNotify('error', 'Event end must be after event start.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${selectedDraft.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: draftSchedule.name,
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
      setEvents((current) =>
        current.map((item) => (item.id === data.event.id ? data.event : item)),
      );
      setDraftSchedule(createScheduleFromEvent(data.event));
      onNotify('success', 'Schedule updated.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update schedule.');
    } finally {
      setSaving(false);
    }
  }
  function handleCancelEdit() {
    setSelectedDraftId(null);
    setDraftSchedule(createDefaultSchedule());
  }
  async function handleCancelScheduledEvent() {
    if (!selectedDraft) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${selectedDraft.id}`, {
        method: 'DELETE',
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setSelectedDraftId(null);
      await loadEvents();
      onNotify('success', 'Scheduled event canceled.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not cancel scheduled event.');
    } finally {
      setSaving(false);
    }
  }
  const minimumStartAt = getMinimumScheduleStart();
  const activeEventCount = events.filter((item) => item.status === 'active').length;
  const scheduledEventCount = events.filter((item) => item.status === 'draft').length;
  return (
    <div className="admin-section admin-event-section">
      <div className="admin-section-header">
        <div>
          <span className="admin-section-eyebrow">EVENT CONTROL</span>
          <h2>Event</h2>
          <p>
            Schedule, monitor and control LP Gain Events.
            {activeEventCount > 0 || scheduledEventCount > 0
              ? ` ${activeEventCount} active, ${scheduledEventCount} scheduled.`
              : ' No active or scheduled events.'}
          </p>
        </div>
        {event && (
          <span className={`admin-event-status admin-event-status-${event.status}`}>
            <span className="admin-event-status-dot" />
            {event.status === 'active' ? 'Active' : 'Ended'}
          </span>
        )}
      </div>
      {event && (
        <>
          <div className="admin-schedule-heading admin-current-event-heading">
            <span className="admin-section-eyebrow">
              {event?.status === 'active' ? 'CURRENT EVENT' : 'LAST EVENT'}
            </span>
            <h3>{event?.status === 'active' ? 'Active event' : 'Last completed event'}</h3>
            <p>
              {event?.status === 'active'
                ? 'This event is currently running.'
                : 'Most recently completed event overview.'}
            </p>
          </div>
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
              <strong>{event.participantCount}</strong>
            </div>
          </div>
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
        </>
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
              setConfirmation('end-event');
            }}
          >
            {saving ? 'Working...' : 'End Event Now'}
          </button>
        </div>
      )}
      {draftEvents.length > 0 && (
        <div className="admin-scheduled-events">
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">UPCOMING EVENTS</span>
            <h3>Upcoming events</h3>
            <p>
              {draftEvents.length} event{draftEvents.length === 1 ? '' : 's'} scheduled.
            </p>
          </div>

          <div className="admin-scheduled-event-list">
            {draftEvents.map((draft) => (
              <div
                className={`admin-scheduled-event-card ${
                  selectedDraft?.id === draft.id ? 'selected' : ''
                }`}
                key={draft.id}
              >
                <div className="admin-scheduled-event-cell">
                  <span>Event</span>
                  <strong>{draft.name}</strong>
                </div>

                <div className="admin-scheduled-event-cell">
                  <span>Start</span>
                  <strong>{formatEventDate(draft.startsAt)}</strong>
                </div>

                <div className="admin-scheduled-event-cell">
                  <span>End</span>
                  <strong>{formatEventDate(draft.endsAt)}</strong>
                </div>

                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setSelectedDraftId(draft.id);
                    setDraftSchedule(createScheduleFromEvent(draft));
                  }}
                >
                  {selectedDraft?.id === draft.id ? 'Editing' : 'Edit'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedDraft && (
        <form
          className="admin-schedule-event admin-schedule-event-edit"
          onSubmit={handleUpdateSchedule}
        >
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">EDIT EVENT</span>
            <h3>{selectedDraft.name}</h3>
            <p>Changes are allowed until the event has actually started.</p>
          </div>
          <div className="admin-schedule-grid">
            <label>
              Event Name
              <input
                type="text"
                value={draftSchedule.name}
                disabled={saving}
                required
                onChange={(eventInput) => {
                  setDraftSchedule((current) => ({
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
                value={draftSchedule.startsAt}
                disabled={saving}
                min={minimumStartAt}
                required
                onChange={(eventInput) => {
                  setDraftSchedule((current) => ({
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
                value={draftSchedule.endsAt}
                disabled={saving}
                min={draftSchedule.startsAt || minimumStartAt}
                required
                onChange={(eventInput) => {
                  setDraftSchedule((current) => ({
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
              className="admin-secondary-button"
              type="button"
              disabled={saving}
              onClick={handleCancelEdit}
            >
              Cancel Editing
            </button>

            <button
              className="admin-danger-button"
              type="button"
              disabled={saving}
              onClick={() => {
                setConfirmation('cancel-scheduled-event');
              }}
            >
              Cancel Scheduled Event
            </button>
          </div>
        </form>
      )}
      <form className="admin-schedule-event admin-schedule-event-create" onSubmit={handleSchedule}>
        <div className="admin-schedule-heading">
          <span className="admin-section-eyebrow">CREATE EVENT</span>
          <h3>Schedule new event</h3>
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
      <AdminConfirmDialog
        open={confirmation !== null}
        title={confirmation === 'end-event' ? 'End event now?' : 'Cancel scheduled event?'}
        message={
          confirmation === 'end-event'
            ? `End "${event?.name ?? 'this event'}" now? The current leaderboard will be frozen as the final result.`
            : `Cancel "${selectedDraft?.name ?? 'this event'}"? The event will not be started.`
        }
        confirmLabel={confirmation === 'end-event' ? 'End Event' : 'Cancel Event'}
        danger
        busy={saving}
        onCancel={() => {
          setConfirmation(null);
        }}
        onConfirm={() => {
          const action = confirmation;
          setConfirmation(null);
          if (action === 'end-event') {
            void handleEnd();
            return;
          }
          if (action === 'cancel-scheduled-event') {
            void handleCancelScheduledEvent();
          }
        }}
      />
    </div>
  );
}
export default AdminEventPanel;
