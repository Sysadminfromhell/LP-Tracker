ALTER TABLE event_matches
ADD COLUMN is_sync_anchor BOOLEAN NOT NULL DEFAULT FALSE;

WITH latest_matches AS (
    SELECT DISTINCT ON (event_participant_id)
        id
    FROM event_matches
    ORDER BY
        event_participant_id,
        game_created_at DESC,
        id DESC
)
UPDATE event_matches
SET is_sync_anchor = TRUE
WHERE id IN (
    SELECT id
    FROM latest_matches
);

CREATE UNIQUE INDEX event_matches_sync_anchor_idx
ON event_matches (event_participant_id)
WHERE is_sync_anchor = TRUE;