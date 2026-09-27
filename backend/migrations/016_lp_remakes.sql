ALTER TABLE event_matches
ADD COLUMN is_remake BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_remake_resolution_check
CHECK (
    is_remake = FALSE
    OR (
        lp_delta_status = 'resolved'
        AND lp_delta = 0
        AND rank_score_before IS NOT NULL
        AND rank_score_after IS NOT NULL
        AND rank_score_before = rank_score_after
        AND lp_resolution_method = 'observation'
        AND lp_resolution_observation_id IS NOT NULL
        AND lp_resolved_at IS NOT NULL
    )
);