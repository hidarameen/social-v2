/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

function parseEnvFile(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function stripEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
  );
}

function buildPlatformCredentials(env) {
  return {
    twitter: stripEmpty({
      clientId: pickFirst(env.TWITTER_CLIENT_ID),
      clientSecret: pickFirst(env.TWITTER_CLIENT_SECRET),
      apiKey: pickFirst(env.TWITTER_API_KEY, env.TWITTER_CONSUMER_KEY),
      apiSecret: pickFirst(env.TWITTER_API_SECRET, env.TWITTER_CONSUMER_SECRET),
      bearerToken: pickFirst(env.TWITTER_BEARER_TOKEN),
      webhookSecret: pickFirst(
        env.TWITTER_WEBHOOK_SECRET,
        env.TWITTER_API_SECRET,
        env.TWITTER_CLIENT_SECRET
      ),
      accessToken: pickFirst(
        env.TWITTER_ACCESS_TOKEN,
        env.TWITTER_USER_ACCESS_TOKEN,
        env.TWITTER_OAUTH_TOKEN
      ),
      accessTokenSecret: pickFirst(
        env.TWITTER_ACCESS_TOKEN_SECRET,
        env.TWITTER_USER_ACCESS_TOKEN_SECRET,
        env.TWITTER_OAUTH_TOKEN_SECRET
      ),
    }),
    facebook: stripEmpty({
      clientId: pickFirst(env.FACEBOOK_CLIENT_ID),
      clientSecret: pickFirst(env.FACEBOOK_CLIENT_SECRET),
    }),
    instagram: stripEmpty({
      clientId: pickFirst(env.INSTAGRAM_CLIENT_ID),
      clientSecret: pickFirst(env.INSTAGRAM_CLIENT_SECRET),
    }),
    youtube: stripEmpty({
      clientId: pickFirst(env.GOOGLE_CLIENT_ID),
      clientSecret: pickFirst(env.GOOGLE_CLIENT_SECRET),
    }),
    tiktok: stripEmpty({
      clientId: pickFirst(env.TIKTOK_CLIENT_KEY),
      clientSecret: pickFirst(env.TIKTOK_CLIENT_SECRET),
    }),
    linkedin: stripEmpty({
      clientId: pickFirst(env.LINKEDIN_CLIENT_ID),
      clientSecret: pickFirst(env.LINKEDIN_CLIENT_SECRET),
    }),
    telegram: stripEmpty({
      botToken: pickFirst(env.TELEGRAM_BOT_TOKEN),
    }),
  };
}

async function ensurePlatformCredentialSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_platform_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform_id TEXT NOT NULL,
      credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, platform_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_platform_credentials_user
    ON user_platform_credentials(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_platform_credentials_platform
    ON user_platform_credentials(platform_id)
  `);
}

async function run() {
  const workspaceRoot = path.resolve(__dirname, '..');
  const envLocalPath = path.join(workspaceRoot, '.env.local');
  const envPath = path.join(workspaceRoot, '.env');

  const parsedLocal = parseEnvFile(envLocalPath);
  const parsedEnv = parseEnvFile(envPath);
  const env = { ...parsedEnv, ...parsedLocal, ...process.env };

  const databaseUrl = pickFirst(env.DATABASE_URL);
  if (!databaseUrl) {
    console.error('[migrate:platform-credentials] DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await ensurePlatformCredentialSchema(pool);
    const credentialByPlatform = buildPlatformCredentials(env);
    const platformsWithValues = Object.entries(credentialByPlatform)
      .filter(([, credentials]) => Object.keys(credentials).length > 0);

    if (platformsWithValues.length === 0) {
      console.log('[migrate:platform-credentials] No platform credentials found in env files.');
      return;
    }

    const usersResult = await pool.query(
      'SELECT id, email FROM users ORDER BY created_at ASC'
    );
    const users = usersResult.rows;
    if (!users.length) {
      console.log('[migrate:platform-credentials] No users found. Nothing to migrate.');
      return;
    }

    let writes = 0;
    for (const user of users) {
      for (const [platformId, credentials] of platformsWithValues) {
        await pool.query(
          `
          INSERT INTO user_platform_credentials (id, user_id, platform_id, credentials)
          VALUES ($1, $2, $3, $4::jsonb)
          ON CONFLICT (user_id, platform_id)
          DO UPDATE SET credentials = EXCLUDED.credentials, updated_at = NOW()
          `,
          [randomUUID(), user.id, platformId, JSON.stringify(credentials)]
        );
        writes += 1;
      }
    }

    console.log(
      `[migrate:platform-credentials] Migrated ${platformsWithValues.length} platform(s) for ${users.length} user(s) (${writes} upserts).`
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('[migrate:platform-credentials] Failed:', error);
  process.exit(1);
});

