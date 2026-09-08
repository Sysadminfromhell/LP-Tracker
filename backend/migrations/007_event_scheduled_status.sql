DROP INDEX IF EXISTS events_single_open_event_idx;

ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_open_time_no_overlap;

ALTER TABLE events
DROP CONSTRAINT events_status_check;

ALTER TABLE events
ADD CONSTRAINT events_status_check
CHECK (
    status IN (
        'draft',
        'scheduled',
        'active',
        'ended'
    )
);

UPDATE events
SET
    status = 'scheduled',
    updated_at = NOW()
WHERE
    status = 'draft'
    AND starts_at IS NOT NULL;

ALTER TABLE events
ADD CONSTRAINT events_open_time_no_overlap
EXCLUDE USING gist (
    tstzrange(starts_at, ends_at, '[)') WITH &&
)
WHERE (
    status IN (
        'scheduled',
        'active'
    )
);