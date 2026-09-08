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
  status: 'draft' | 'scheduled' | 'active' | 'ended';
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}
interface EventScheduleForm {
  name: string;
  startsAt: string;
  endsAt: string;
}
interface EventParticipantPenalty {
  eventId: number;
  playerId: number;
  gameName: string;
  tagLine: string;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  lpPenalty: number;
  penaltyReason: string | null;
  penaltyUpdatedAt: string | null;
}
interface PenaltyForm {
  lpPenalty: string;
  reason: string;
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
function formatRank(tier: string, division: number | null, lp: number): string {
  const divisionLabels: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
  };
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const divisionLabel = division === null ? '' : ` ${divisionLabels[division] ?? division}`;
  return `${formattedTier}${divisionLabel} · ${lp} LP`;
}
function AdminEventPanel({ onUnauthorized, onNotify }: AdminEventPanelProps) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [selectedScheduledId, setSelectedScheduledId] = useState<number | null>(null);
  const [eventName, setEventName] = useState('');
  const [schedule, setSchedule] = useState<EventScheduleForm>(createDefaultSchedule);
  const [scheduledSchedule, setScheduledSchedule] =
    useState<EventScheduleForm>(createDefaultSchedule);
  const [penaltyParticipants, setPenaltyParticipants] = useState<EventParticipantPenalty[]>([]);
  const [penaltiesLoading, setPenaltiesLoading] = useState(false);
  const [editingPenaltyPlayerId, setEditingPenaltyPlayerId] = useState<number | null>(null);
  const [penaltyForm, setPenaltyForm] = useState<PenaltyForm>({
    lpPenalty: '0',
    reason: '',
  });
  const scheduledEvents = events
    .filter((item) => item.status === 'scheduled')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const selectedScheduled = scheduledEvents.find((item) => item.id === selectedScheduledId) ?? null;
  const hasOpenEvents = events.some(
    (item) => item.status === 'scheduled' || item.status === 'active',
  );
  const activeEventId = event?.status === 'active' ? event.id : null;
  const selectedPenaltyParticipant =
    penaltyParticipants.find((participant) => participant.playerId === editingPenaltyPlayerId) ??
    null;
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
  const loadPenalties = useCallback(
    async (eventId: number) => {
      setPenaltiesLoading(true);
      try {
        const response = await fetch(`/api/admin/events/${eventId}/penalties`, {
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
          participants: EventParticipantPenalty[];
        };
        setPenaltyParticipants(data.participants);
      } catch (err) {
        onNotify('error', err instanceof Error ? err.message : 'Could not load LP penalties.');
      } finally {
        setPenaltiesLoading(false);
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
    if (activeEventId === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadPenalties(activeEventId);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeEventId, loadPenalties]);
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
    if (!selectedScheduled) {
      return;
    }
    const startsAt = new Date(scheduledSchedule.startsAt);
    const endsAt = new Date(scheduledSchedule.endsAt);
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
      const response = await fetch(`/api/admin/events/${selectedScheduled.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: scheduledSchedule.name,
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
      setScheduledSchedule(createScheduleFromEvent(data.event));
      onNotify('success', 'Schedule updated.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update schedule.');
    } finally {
      setSaving(false);
    }
  }
  function handleCancelEdit() {
    setSelectedScheduledId(null);
    setScheduledSchedule(createDefaultSchedule());
  }
  async function handleCancelScheduledEvent() {
    if (!selectedScheduled) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${selectedScheduled.id}`, {
        method: 'DELETE',
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setSelectedScheduledId(null);
      await loadEvents();
      onNotify('success', 'Scheduled event canceled.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not cancel scheduled event.');
    } finally {
      setSaving(false);
    }
  }
  function handleEditPenalty(participant: EventParticipantPenalty) {
    setEditingPenaltyPlayerId(participant.playerId);
    setPenaltyForm({
      lpPenalty: String(participant.lpPenalty),
      reason: participant.penaltyReason ?? '',
    });
  }
  function handleCancelPenaltyEdit() {
    setEditingPenaltyPlayerId(null);
    setPenaltyForm({
      lpPenalty: '0',
      reason: '',
    });
  }
  async function handleSavePenalty(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event || event.status !== 'active' || !selectedPenaltyParticipant) {
      return;
    }
    const penaltyValue = penaltyForm.lpPenalty.trim();
    if (!penaltyValue) {
      onNotify('error', 'Please enter an LP penalty.');
      return;
    }
    const lpPenalty = Number(penaltyValue);
    if (!Number.isSafeInteger(lpPenalty) || lpPenalty < 0) {
      onNotify('error', 'LP penalty must be a non-negative integer.');
      return;
    }
    const reason = penaltyForm.reason.trim();
    if (lpPenalty > 0 && !reason) {
      onNotify('error', 'Please enter a reason for the penalty.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/events/${event.id}/participants/${selectedPenaltyParticipant.playerId}/penalty`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lpPenalty,
            reason: lpPenalty === 0 ? null : reason,
          }),
        },
      );
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const data = (await response.json()) as {
        participant: EventParticipantPenalty;
      };
      setPenaltyParticipants((current) =>
        current.map((participant) =>
          participant.playerId === data.participant.playerId ? data.participant : participant,
        ),
      );
      handleCancelPenaltyEdit();
      onNotify(
        'success',
        lpPenalty === 0 ? 'LP penalty removed.' : `LP penalty set to ${lpPenalty}.`,
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update LP penalty.');
    } finally {
      setSaving(false);
    }
  }
  const minimumStartAt = getMinimumScheduleStart();
  const activeEventCount = events.filter((item) => item.status === 'active').length;
  const scheduledEventCount = events.filter((item) => item.status === 'scheduled').length;
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
        <div className="admin-scheduled-events">
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">LP PENALTIES</span>
            <h3>Participant penalties</h3>
            <p>
              Adjust a participant&apos;s effective event gain without modifying the original start
              snapshot.
            </p>
          </div>
          {penaltiesLoading ? (
            <div className="admin-player-empty">Loading participants...</div>
          ) : penaltyParticipants.length === 0 ? (
            <div className="admin-player-empty">No event participants available.</div>
          ) : (
            <div className="admin-scheduled-event-list admin-scroll-list">
              {penaltyParticipants.map((participant) => (
                <div
                  className={`admin-scheduled-event-card ${
                    editingPenaltyPlayerId === participant.playerId ? 'selected' : ''
                  }`}
                  key={participant.playerId}
                >
                  <div className="admin-scheduled-event-cell">
                    <span>Player</span>
                    <strong>
                      {participant.gameName}#{participant.tagLine}
                    </strong>
                  </div>
                  <div className="admin-scheduled-event-cell">
                    <span>Start</span>
                    <strong>
                      {formatRank(
                        participant.startTier,
                        participant.startDivision,
                        participant.startLp,
                      )}
                    </strong>
                  </div>
                  <div className="admin-scheduled-event-cell">
                    <span>{participant.penaltyReason ?? 'Penalty'}</span>
                    <strong>
                      {participant.lpPenalty > 0 ? `${participant.lpPenalty} LP` : 'None'}
                    </strong>
                  </div>
                  <button
                    className="admin-secondary-button"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      handleEditPenalty(participant);
                    }}
                  >
                    {editingPenaltyPlayerId === participant.playerId ? 'Editing' : 'Edit'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {event?.status === 'active' && selectedPenaltyParticipant && (
        <form
          className="admin-schedule-event admin-schedule-event-edit"
          onSubmit={handleSavePenalty}
        >
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">EDIT PENALTY</span>
            <h3>
              {selectedPenaltyParticipant.gameName}#{selectedPenaltyParticipant.tagLine}
            </h3>
            <p>
              Original start:{' '}
              {formatRank(
                selectedPenaltyParticipant.startTier,
                selectedPenaltyParticipant.startDivision,
                selectedPenaltyParticipant.startLp,
              )}
              . Set the penalty to 0 to remove it.
            </p>
          </div>
          <div className="admin-schedule-grid">
            <label>
              LP Penalty
              <input
                type="number"
                min="0"
                step="1"
                value={penaltyForm.lpPenalty}
                disabled={saving}
                required
                onChange={(eventInput) => {
                  setPenaltyForm((current) => ({
                    ...current,
                    lpPenalty: eventInput.target.value,
                  }));
                }}
              />
            </label>
            <label>
              Reason
              <input
                type="text"
                value={penaltyForm.reason}
                disabled={saving}
                placeholder="Boosting / rule violation"
                onChange={(eventInput) => {
                  setPenaltyForm((current) => ({
                    ...current,
                    reason: eventInput.target.value,
                  }));
                }}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Penalty'}
            </button>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={saving}
              onClick={handleCancelPenaltyEdit}
            >
              Cancel
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
              setConfirmation('end-event');
            }}
          >
            {saving ? 'Working...' : 'End Event Now'}
          </button>
        </div>
      )}
      {scheduledEvents.length > 0 && (
        <div className="admin-scheduled-events">
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">UPCOMING EVENTS</span>
            <h3>Upcoming events</h3>
            <p>
              {scheduledEvents.length} event{scheduledEvents.length === 1 ? '' : 's'} scheduled.
            </p>
          </div>

          <div className="admin-scheduled-event-list">
            {scheduledEvents.map((scheduledEvent) => (
              <div
                className={`admin-scheduled-event-card ${
                  selectedScheduled?.id === scheduledEvent.id ? 'selected' : ''
                }`}
                key={scheduledEvent.id}
              >
                <div className="admin-scheduled-event-cell">
                  <span>Event</span>
                  <strong>{scheduledEvent.name}</strong>
                </div>

                <div className="admin-scheduled-event-cell">
                  <span>Start</span>
                  <strong>{formatEventDate(scheduledEvent.startsAt)}</strong>
                </div>

                <div className="admin-scheduled-event-cell">
                  <span>End</span>
                  <strong>{formatEventDate(scheduledEvent.endsAt)}</strong>
                </div>

                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setSelectedScheduledId(scheduledEvent.id);
                    setScheduledSchedule(createScheduleFromEvent(scheduledEvent));
                  }}
                >
                  {selectedScheduled?.id === scheduledEvent.id ? 'Editing' : 'Edit'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedScheduled && (
        <form
          className="admin-schedule-event admin-schedule-event-edit"
          onSubmit={handleUpdateSchedule}
        >
          <div className="admin-schedule-heading">
            <span className="admin-section-eyebrow">EDIT EVENT</span>
            <h3>{selectedScheduled.name}</h3>
            <p>Changes are allowed until the event has actually started.</p>
          </div>
          <div className="admin-schedule-grid">
            <label>
              Event Name
              <input
                type="text"
                value={scheduledSchedule.name}
                disabled={saving}
                required
                onChange={(eventInput) => {
                  setScheduledSchedule((current) => ({
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
                value={scheduledSchedule.startsAt}
                disabled={saving}
                min={minimumStartAt}
                required
                onChange={(eventInput) => {
                  setScheduledSchedule((current) => ({
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
                value={scheduledSchedule.endsAt}
                disabled={saving}
                min={scheduledSchedule.startsAt || minimumStartAt}
                required
                onChange={(eventInput) => {
                  setScheduledSchedule((current) => ({
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
            : `Cancel "${selectedScheduled?.name ?? 'this event'}"? The event will not be started.`
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
