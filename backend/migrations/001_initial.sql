-- ============================================================
-- LP Tracker - Initial database schema
-- ============================================================


-- ------------------------------------------------------------
-- Players
--
-- Permanente Teilnehmerdaten.
-- Nicht an ein einzelnes Event gebunden.
-- ------------------------------------------------------------

CREATE TABLE players (
    id BIGSERIAL PRIMARY KEY,

    game_name TEXT NOT NULL,
    tag_line TEXT NOT NULL,
    region TEXT NOT NULL,

    twitch_username TEXT NULL,
    twitter_username TEXT NULL,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX players_riot_id_unique
    ON players (
        LOWER(region),
        LOWER(game_name),
        LOWER(tag_line)
    );

CREATE INDEX players_enabled_idx
    ON players (enabled);


-- ------------------------------------------------------------
-- Player Cache
--
-- Letzter erfolgreich von OP.GG abgeholter Zustand.
--
-- Dieser Cache sorgt dafür, dass das Leaderboard nach einem
-- Server-Neustart SOFORT wieder Daten anzeigen kann.
-- ------------------------------------------------------------

CREATE TABLE player_cache (
    player_id BIGINT PRIMARY KEY
        REFERENCES players(id)
        ON DELETE CASCADE,

    profile_image_url TEXT NULL,

    tier TEXT NULL,
    division SMALLINT NULL,
    lp INTEGER NULL,
    rank_score INTEGER NULL,

    season_wins INTEGER NULL,
    season_losses INTEGER NULL,

    last_successful_fetch_at TIMESTAMPTZ NULL,
    last_fetch_attempt_at TIMESTAMPTZ NULL,

    last_error TEXT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT player_cache_division_check
        CHECK (
            division IS NULL
            OR division BETWEEN 1 AND 4
        ),

    CONSTRAINT player_cache_lp_check
        CHECK (
            lp IS NULL
            OR lp >= 0
        ),

    CONSTRAINT player_cache_wins_check
        CHECK (
            season_wins IS NULL
            OR season_wins >= 0
        ),

    CONSTRAINT player_cache_losses_check
        CHECK (
            season_losses IS NULL
            OR season_losses >= 0
        )
);


-- ------------------------------------------------------------
-- Events
--
-- Globales Event.
--
-- Im Gegensatz zu unserem bisherigen JSON-Modell hat jetzt
-- NICHT mehr jeder Spieler seinen eigenen Event-Start.
-- ------------------------------------------------------------

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,

    status TEXT NOT NULL DEFAULT 'draft',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT events_status_check
        CHECK (
            status IN (
                'draft',
                'active',
                'ended'
            )
        ),

    CONSTRAINT events_time_check
        CHECK (
            ends_at IS NULL
            OR starts_at IS NULL
            OR ends_at > starts_at
        )
);

-- Vorerst darf nur ein Event gleichzeitig aktiv sein.
CREATE UNIQUE INDEX events_single_active_idx
    ON events ((status))
    WHERE status = 'active';


-- ------------------------------------------------------------
-- Event Participants
--
-- Snapshot eines Spielers zu Beginn eines Events.
--
-- Dadurch können Spieler permanent in "players" existieren,
-- während ihre Eventwerte pro Event separat gespeichert werden.
-- ------------------------------------------------------------

CREATE TABLE event_participants (
    id BIGSERIAL PRIMARY KEY,

    event_id BIGINT NOT NULL
        REFERENCES events(id)
        ON DELETE CASCADE,

    player_id BIGINT NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,

    start_tier TEXT NOT NULL,
    start_division SMALLINT NULL,
    start_lp INTEGER NOT NULL,
    start_rank_score INTEGER NOT NULL,

    start_wins INTEGER NOT NULL,
    start_losses INTEGER NOT NULL,

    last_resolved_rank_score INTEGER NOT NULL,

    -- Werden beim Beenden eines Events gesetzt.
    -- Damit bleibt der Endstand eingefroren, selbst wenn
    -- der Spieler danach weiter Ranked spielt.

    end_tier TEXT NULL,
    end_division SMALLINT NULL,
    end_lp INTEGER NULL,
    end_rank_score INTEGER NULL,

    end_wins INTEGER NULL,
    end_losses INTEGER NULL,

    snapshot_captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_snapshot_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_participants_unique
        UNIQUE (
            event_id,
            player_id
        ),

    CONSTRAINT event_participants_start_division_check
        CHECK (
            start_division IS NULL
            OR start_division BETWEEN 1 AND 4
        ),

    CONSTRAINT event_participants_end_division_check
        CHECK (
            end_division IS NULL
            OR end_division BETWEEN 1 AND 4
        ),

    CONSTRAINT event_participants_start_lp_check
        CHECK (
            start_lp >= 0
        ),

    CONSTRAINT event_participants_end_lp_check
        CHECK (
            end_lp IS NULL
            OR end_lp >= 0
        ),

    CONSTRAINT event_participants_start_wins_check
        CHECK (
            start_wins >= 0
        ),

    CONSTRAINT event_participants_start_losses_check
        CHECK (
            start_losses >= 0
        )
);

CREATE INDEX event_participants_event_idx
    ON event_participants (event_id);

CREATE INDEX event_participants_player_idx
    ON event_participants (player_id);


-- ------------------------------------------------------------
-- Event Matches
--
-- Ranked Games eines Teilnehmers innerhalb des Events.
-- ------------------------------------------------------------

CREATE TABLE event_matches (
    id BIGSERIAL PRIMARY KEY,

    event_participant_id BIGINT NOT NULL
        REFERENCES event_participants(id)
        ON DELETE CASCADE,

    opgg_match_id TEXT NOT NULL,

    game_created_at TIMESTAMPTZ NOT NULL,

    champion_id INTEGER NOT NULL,
    champion TEXT NOT NULL,

    position TEXT NOT NULL,

    kills INTEGER NOT NULL,
    deaths INTEGER NOT NULL,
    assists INTEGER NOT NULL,
    cs INTEGER NOT NULL,

    result TEXT NOT NULL,

    lp_delta INTEGER NULL,

    lp_delta_status TEXT NOT NULL DEFAULT 'pending',

    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_matches_unique
        UNIQUE (
            event_participant_id,
            opgg_match_id
        ),

    CONSTRAINT event_matches_result_check
        CHECK (
            result IN (
                'WIN',
                'LOSE'
            )
        ),

    CONSTRAINT event_matches_lp_status_check
        CHECK (
            lp_delta_status IN (
                'pending',
                'resolved',
                'unknown'
            )
        ),

    CONSTRAINT event_matches_kills_check
        CHECK (kills >= 0),

    CONSTRAINT event_matches_deaths_check
        CHECK (deaths >= 0),

    CONSTRAINT event_matches_assists_check
        CHECK (assists >= 0),

    CONSTRAINT event_matches_cs_check
        CHECK (cs >= 0)
);

CREATE INDEX event_matches_participant_idx
    ON event_matches (
        event_participant_id
    );

CREATE INDEX event_matches_created_idx
    ON event_matches (
        game_created_at DESC
    );