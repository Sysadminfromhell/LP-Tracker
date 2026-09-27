ALTER TABLE event_matches
ADD COLUMN rank_score_before INTEGER NULL;

ALTER TABLE event_matches
ADD COLUMN lp_resolution_method TEXT NULL;

ALTER TABLE event_matches
ADD COLUMN lp_resolution_observation_id BIGINT NULL;

ALTER TABLE event_matches
ADD COLUMN lp_resolved_at TIMESTAMPTZ NULL;

ALTER TABLE lp_rank_observations
ADD CONSTRAINT lp_rank_observations_resolution_reference_key
UNIQUE (
    id,
    event_participant_id,
    rank_score
);

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_resolution_observation_fk
FOREIGN KEY (
    lp_resolution_observation_id,
    event_participant_id,
    rank_score_after
)
REFERENCES lp_rank_observations (
    id,
    event_participant_id,
    rank_score
)
ON DELETE NO ACTION;

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_lp_resolution_method_check
CHECK (
    lp_resolution_method IS NULL
    OR lp_resolution_method IN (
        'observation',
        'right_boundary',
        'legacy'
    )
);

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_lp_resolution_evidence_check
CHECK (
    (
        lp_resolution_method IS NULL
        AND lp_resolution_observation_id IS NULL
        AND lp_resolved_at IS NULL
        AND rank_score_before IS NULL
    )
    OR (
        lp_resolution_method = 'observation'
        AND lp_resolution_observation_id IS NOT NULL
        AND rank_score_before IS NOT NULL
        AND rank_score_after IS NOT NULL
        AND lp_delta IS NOT NULL
        AND lp_resolved_at IS NOT NULL
        AND lp_delta_status = 'resolved'
    )
    OR (
        lp_resolution_method IN (
            'right_boundary',
            'legacy'
        )
        AND lp_resolution_observation_id IS NULL
        AND rank_score_before IS NOT NULL
        AND rank_score_after IS NOT NULL
        AND lp_delta IS NOT NULL
        AND lp_resolved_at IS NOT NULL
        AND lp_delta_status = 'resolved'
    )
);

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_lp_resolution_chain_check
CHECK (
    rank_score_before IS NULL
    OR lp_delta IS NULL
    OR rank_score_after IS NULL
    OR rank_score_before + lp_delta = rank_score_after
);

UPDATE event_matches
SET
    rank_score_before = rank_score_after - lp_delta,
    lp_resolution_method = 'legacy',
    lp_resolved_at = updated_at
WHERE
    lp_delta_status = 'resolved'
    AND lp_delta IS NOT NULL
    AND rank_score_after IS NOT NULL;

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_resolved_requires_evidence_check
CHECK (
    lp_delta_status <> 'resolved'
    OR lp_resolution_method IS NOT NULL
)
NOT VALID;

CREATE INDEX event_matches_resolution_observation_idx
ON event_matches (
    lp_resolution_observation_id
)
WHERE lp_resolution_observation_id IS NOT NULL;