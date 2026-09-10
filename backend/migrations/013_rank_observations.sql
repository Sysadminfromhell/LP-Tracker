ALTER TABLE event_matches
ADD COLUMN duration_seconds INTEGER NULL;

ALTER TABLE event_matches
ADD CONSTRAINT event_matches_duration_seconds_check
CHECK (
    duration_seconds IS NULL
    OR duration_seconds >= 0
);

UPDATE event_matches em
SET duration_seconds = details.duration_seconds
FROM event_match_details details
WHERE
    details.event_match_id = em.id
    AND em.duration_seconds IS NULL;

CREATE TABLE lp_rank_observations (
    id BIGSERIAL PRIMARY KEY,

    event_participant_id BIGINT NOT NULL
        REFERENCES event_participants(id)
        ON DELETE CASCADE,

    rank_score INTEGER NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'profile_refresh',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lp_rank_observations_rank_score_check
        CHECK (rank_score >= 0),

    CONSTRAINT lp_rank_observations_source_check
        CHECK (
            source IN (
                'profile_refresh',
                'provider_history'
            )
        )
);

CREATE INDEX lp_rank_observations_participant_observed_idx
ON lp_rank_observations (
    event_participant_id,
    observed_at,
    id
);

CREATE INDEX lp_rank_observations_participant_created_idx
ON lp_rank_observations (
    event_participant_id,
    created_at
);

CREATE UNIQUE INDEX lp_rank_observations_unique_idx
ON lp_rank_observations (
    event_participant_id,
    observed_at,
    rank_score,
    source
);