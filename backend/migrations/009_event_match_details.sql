CREATE TABLE event_match_details (
    event_match_id BIGINT PRIMARY KEY
        REFERENCES event_matches(id)
        ON DELETE CASCADE,

    duration_seconds INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_match_details_duration_seconds_check
        CHECK (
            duration_seconds >= 0
        )
);

CREATE TABLE event_match_participants (
    id BIGSERIAL PRIMARY KEY,

    event_match_id BIGINT NOT NULL
        REFERENCES event_match_details(event_match_id)
        ON DELETE CASCADE,

    side TEXT NOT NULL,

    position TEXT NOT NULL,

    champion_id INTEGER NOT NULL,
    champion TEXT NOT NULL,

    kills INTEGER NOT NULL,
    deaths INTEGER NOT NULL,
    assists INTEGER NOT NULL,

    lane_cs INTEGER NOT NULL,
    jungle_cs INTEGER NOT NULL,
    cs INTEGER NOT NULL,

    damage_to_champions INTEGER NOT NULL,

    items TEXT[] NOT NULL DEFAULT '{}'::TEXT[],

    is_tracked_player BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_match_participants_side_check
        CHECK (
            side IN (
                'ALLY',
                'ENEMY'
            )
        ),

    CONSTRAINT event_match_participants_champion_id_check
        CHECK (
            champion_id > 0
        ),

    CONSTRAINT event_match_participants_kills_check
        CHECK (
            kills >= 0
        ),

    CONSTRAINT event_match_participants_deaths_check
        CHECK (
            deaths >= 0
        ),

    CONSTRAINT event_match_participants_assists_check
        CHECK (
            assists >= 0
        ),

    CONSTRAINT event_match_participants_lane_cs_check
        CHECK (
            lane_cs >= 0
        ),

    CONSTRAINT event_match_participants_jungle_cs_check
        CHECK (
            jungle_cs >= 0
        ),

    CONSTRAINT event_match_participants_cs_check
        CHECK (
            cs >= 0
        ),

    CONSTRAINT event_match_participants_damage_check
        CHECK (
            damage_to_champions >= 0
        )
);


CREATE INDEX event_match_participants_match_idx
    ON event_match_participants (
        event_match_id
    );

CREATE UNIQUE INDEX event_match_participants_one_tracked_idx
    ON event_match_participants (
        event_match_id
    )
    WHERE is_tracked_player = TRUE;