DROP INDEX IF EXISTS events_single_open_event_idx;

ALTER TABLE events
ADD CONSTRAINT events_open_time_no_overlap
EXCLUDE USING gist (
    tstzrange(starts_at, ends_at, '[)') WITH &&
)
WHERE (status IN ('draft', 'active'));