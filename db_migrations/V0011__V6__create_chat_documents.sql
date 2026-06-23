CREATE TABLE IF NOT EXISTS t_p3482084_react_native_family_.chat_documents (
    id          SERIAL PRIMARY KEY,
    chat_id     INTEGER NOT NULL,
    message_id  INTEGER,
    user_id     INTEGER NOT NULL,
    file_name   TEXT NOT NULL,
    file_size   BIGINT NOT NULL DEFAULT 0,
    file_type   TEXT NOT NULL,
    s3_key      TEXT NOT NULL,
    cdn_url     TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_documents_chat_id ON t_p3482084_react_native_family_.chat_documents(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_documents_expires_at ON t_p3482084_react_native_family_.chat_documents(expires_at);
