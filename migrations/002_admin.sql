-- ============================================================
-- LP Tracker - Admin authentication
-- ============================================================


-- ------------------------------------------------------------
-- Admin Users
-- ------------------------------------------------------------

CREATE TABLE admins (
    id BIGSERIAL PRIMARY KEY,

    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_login_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX admins_username_unique
    ON admins (
        LOWER(username)
    );

CREATE TABLE admin_sessions (
    id BIGSERIAL PRIMARY KEY,

    admin_id BIGINT NOT NULL
        REFERENCES admins(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT admin_sessions_token_hash_unique
        UNIQUE (token_hash)
);

CREATE INDEX admin_sessions_admin_idx
    ON admin_sessions (
        admin_id
    );

CREATE INDEX admin_sessions_expires_idx
    ON admin_sessions (
        expires_at
    );