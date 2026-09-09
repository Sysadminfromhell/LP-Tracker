CREATE TABLE event_player_selections (
    event_id BIGINT NOT NULL
        REFERENCES events(id)
        ON DELETE CASCADE,
    player_id BIGINT NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_player_selections_pkey
        PRIMARY KEY (
            event_id,
            player_id
        )
);

CREATE INDEX event_player_selections_player_idx
    ON event_player_selections (player_id);
INSERT INTO event_player_selections (
    event_id,
    player_id
)
SELECT
    e.id,
    p.id
FROM events e
CROSS JOIN players p
WHERE
    e.status = 'scheduled'
    AND p.enabled = TRUE;