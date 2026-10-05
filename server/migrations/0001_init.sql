-- Консолидированная схема «Семейки» (объединение всех миграций с poehali.dev)
-- Выполняется в схеме, заданной search_path (см. migrate.ts / DB_SCHEMA).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  avatar TEXT DEFAULT '👤',
  bio TEXT DEFAULT '',
  city VARCHAR(64) DEFAULT '',
  age INTEGER,
  last_seen TIMESTAMP WITHOUT TIME ZONE,
  badge_text VARCHAR(32) DEFAULT NULL,
  badge_color VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128),
  is_group BOOLEAN DEFAULT FALSE,
  avatar VARCHAR(8) DEFAULT '💬',
  created_by INTEGER,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  image_url TEXT,
  reply_to_id INTEGER REFERENCES messages(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, member_id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username, attempted_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS chat_documents (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  message_id INTEGER,
  user_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_documents_chat_id ON chat_documents(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_documents_expires_at ON chat_documents(expires_at);

-- Сидовый администратор: логин admin / пароль admin123
-- Хэш совпадает с форматом legacy-проверки check_password() (endsWith sha256(password))
INSERT INTO users (username, display_name, password_hash, role, avatar, city, age, bio)
VALUES (
  'admin',
  'Администратор',
  'legacy$' || encode(sha256('admin123'::bytea), 'hex'),
  'admin',
  '👑',
  'Москва',
  NULL,
  'Администратор семейного чата'
)
ON CONFLICT (username) DO NOTHING;
