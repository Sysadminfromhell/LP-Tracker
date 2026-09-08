ALTER TABLE event_participants
ADD COLUMN lp_penalty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE event_participants
ADD COLUMN penalty_reason TEXT NULL;

ALTER TABLE event_participants
ADD COLUMN penalty_updated_at TIMESTAMPTZ NULL;

ALTER TABLE event_participants
ADD CONSTRAINT event_participants_lp_penalty_check
CHECK (
    lp_penalty >= 0
);