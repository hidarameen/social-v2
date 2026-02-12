CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  profile_image_url TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_platform_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_user_platform_credentials_user
  ON user_platform_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_platform_credentials_platform
  ON user_platform_credentials(platform_id);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_username TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  credentials JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_accounts TEXT[] NOT NULL DEFAULT '{}',
  target_accounts TEXT[] NOT NULL DEFAULT '{}',
  content_type TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_type TEXT NOT NULL,
  schedule_time TIMESTAMPTZ,
  recurring_pattern TEXT,
  recurring_days INTEGER[],
  filters JSONB,
  transformations JSONB,
  execution_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_executed TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  source_account TEXT NOT NULL,
  target_account TEXT NOT NULL,
  original_content TEXT NOT NULL,
  transformed_content TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  response_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);

CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
  account_id TEXT NOT NULL,
  update_id BIGINT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, update_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_first_seen
  ON telegram_webhook_updates(first_seen);

CREATE TABLE IF NOT EXISTS telegram_processed_messages (
  account_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_first_seen
  ON telegram_processed_messages(first_seen);

CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  platform_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  posts INTEGER NOT NULL DEFAULT 0,
  engagements INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_platform ON analytics(platform_id);
