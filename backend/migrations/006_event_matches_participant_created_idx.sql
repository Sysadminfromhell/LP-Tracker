CREATE INDEX IF NOT EXISTS event_matches_participant_created_idx
    ON event_matches (
        event_participant_id,
        game_created_at DESC
    );