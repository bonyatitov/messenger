CREATE TABLE IF NOT EXISTS t_p3482084_react_native_family_.login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON t_p3482084_react_native_family_.login_attempts(username, attempted_at);
