ALTER TABLE event_matches
ADD COLUMN rank_score_after INTEGER NULL;

WITH match_scores AS (
    SELECT
        em.id,
        em.event_participant_id,
        em.lp_delta_status,

        ep.start_rank_score
            + SUM(
                CASE
                    WHEN em.lp_delta_status = 'resolved'
                    THEN COALESCE(em.lp_delta, 0)
                    ELSE 0
                END
            ) OVER (
                PARTITION BY em.event_participant_id
                ORDER BY em.game_created_at ASC, em.id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS calculated_rank_score_after,

        COUNT(*) FILTER (
            WHERE em.lp_delta_status <> 'resolved'
        ) OVER (
            PARTITION BY em.event_participant_id
            ORDER BY em.game_created_at ASC, em.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS unresolved_before

    FROM event_matches em

    JOIN event_participants ep
        ON ep.id = em.event_participant_id
)

UPDATE event_matches em
SET
    rank_score_after = match_scores.calculated_rank_score_after,
    updated_at = NOW()
FROM match_scores
WHERE
    em.id = match_scores.id
    AND match_scores.lp_delta_status = 'resolved'
    AND match_scores.unresolved_before = 0;

WITH reverse_match_scores AS (
    SELECT
        em.id,
        em.event_participant_id,
        em.lp_delta_status,

        ep.last_resolved_rank_score
            - COALESCE(
                SUM(
                    CASE
                        WHEN em.lp_delta_status = 'resolved'
                        THEN COALESCE(em.lp_delta, 0)
                        ELSE 0
                    END
                ) OVER (
                    PARTITION BY em.event_participant_id
                    ORDER BY
                        em.game_created_at DESC,
                        em.id DESC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
                0
            ) AS calculated_rank_score_after,

        COUNT(*) FILTER (
            WHERE em.lp_delta_status <> 'resolved'
        ) OVER (
            PARTITION BY em.event_participant_id
            ORDER BY
                em.game_created_at ASC,
                em.id ASC
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
        ) AS unresolved_after
    FROM event_matches em
    JOIN event_participants ep
        ON ep.id = em.event_participant_id
)

UPDATE event_matches em
SET
    rank_score_after = reverse_match_scores.calculated_rank_score_after,
    updated_at = NOW()
FROM reverse_match_scores
WHERE
    em.id = reverse_match_scores.id
    AND reverse_match_scores.lp_delta_status = 'resolved'
    AND reverse_match_scores.unresolved_after = 0
    AND em.rank_score_after IS NULL;

CREATE TABLE lp_reconciliation_queue (
    event_participant_id BIGINT PRIMARY KEY
        REFERENCES event_participants(id)
        ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT lp_reconciliation_queue_attempt_count_check
        CHECK (attempt_count >= 0)
);

CREATE INDEX lp_reconciliation_queue_due_idx
ON lp_reconciliation_queue (
    next_attempt_at
);

INSERT INTO lp_reconciliation_queue (
    event_participant_id
)
SELECT DISTINCT
    em.event_participant_id
FROM event_matches em

JOIN event_participants ep
    ON ep.id = em.event_participant_id

JOIN events e
    ON e.id = ep.event_id

WHERE
    e.status IN (
        'active',
        'ended'
    )
    AND em.lp_delta_status IN (
        'pending',
        'unknown'
    )

ON CONFLICT (event_participant_id)
DO NOTHING;