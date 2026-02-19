const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@socialflow.app';
const DEMO_NAME = process.env.DEMO_USER_NAME || 'demo';

function parseEnvFile(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
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

async function ensurePlatformCredentialsSchema(client) {
  await client.query(`
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
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const envLocal = parseEnvFile(path.join(root, '.env.local'));
  const env = parseEnvFile(path.join(root, '.env'));
  const merged = { ...env, ...envLocal, ...process.env };
  const databaseUrl = pickFirst(merged.DATABASE_URL);

  if (!databaseUrl) {
    console.error('[migrate:demo-user] DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensurePlatformCredentialsSchema(client);

    const existingDemo = await client.query(
      `SELECT id, email, name FROM users WHERE email = $1 LIMIT 1`,
      [DEMO_EMAIL]
    );

    let demoUser;
    if ((existingDemo.rowCount || 0) > 0) {
      const updatedDemo = await client.query(
        `
        UPDATE users
        SET name = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name
        `,
        [existingDemo.rows[0].id, DEMO_NAME]
      );
      demoUser = updatedDemo.rows[0];
    } else {
      const insertedDemo = await client.query(
        `
        INSERT INTO users (id, email, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, name
        `,
        [randomUUID(), DEMO_EMAIL, DEMO_NAME]
      );
      demoUser = insertedDemo.rows[0];
    }

    const sourceUsersResult = await client.query(
      `SELECT id FROM users WHERE id <> $1`,
      [demoUser.id]
    );
    const sourceUserIds = sourceUsersResult.rows.map((row) => row.id);

    if (sourceUserIds.length === 0) {
      await client.query('COMMIT');
      console.log(`[migrate:demo-user] No source users found. Demo user is ready: ${demoUser.email}`);
      return;
    }

    const accountsMoved = await client.query(
      `UPDATE platform_accounts SET user_id = $1 WHERE user_id = ANY($2::text[])`,
      [demoUser.id, sourceUserIds]
    );
    const tasksMoved = await client.query(
      `UPDATE tasks SET user_id = $1 WHERE user_id = ANY($2::text[])`,
      [demoUser.id, sourceUserIds]
    );
    const analyticsMoved = await client.query(
      `UPDATE analytics SET user_id = $1 WHERE user_id = ANY($2::text[])`,
      [demoUser.id, sourceUserIds]
    );

    const credRows = await client.query(
      `
      SELECT DISTINCT ON (platform_id)
        platform_id,
        credentials
      FROM user_platform_credentials
      WHERE user_id = ANY($1::text[])
      ORDER BY platform_id, updated_at DESC
      `,
      [sourceUserIds]
    );

    let credentialsMerged = 0;
    for (const row of credRows.rows) {
      await client.query(
        `
        INSERT INTO user_platform_credentials (id, user_id, platform_id, credentials)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (user_id, platform_id)
        DO UPDATE SET credentials = EXCLUDED.credentials, updated_at = NOW()
        `,
        [randomUUID(), demoUser.id, row.platform_id, JSON.stringify(row.credentials || {})]
      );
      credentialsMerged += 1;
    }

    const credentialsDeleted = await client.query(
      `DELETE FROM user_platform_credentials WHERE user_id = ANY($1::text[])`,
      [sourceUserIds]
    );

    await client.query('COMMIT');

    console.log(`[migrate:demo-user] Demo user: ${demoUser.email} (${demoUser.id})`);
    console.log(`[migrate:demo-user] Source users merged: ${sourceUserIds.length}`);
    console.log(`[migrate:demo-user] Accounts moved: ${accountsMoved.rowCount || 0}`);
    console.log(`[migrate:demo-user] Tasks moved: ${tasksMoved.rowCount || 0}`);
    console.log(`[migrate:demo-user] Analytics moved: ${analyticsMoved.rowCount || 0}`);
    console.log(`[migrate:demo-user] Platform credentials merged: ${credentialsMerged}`);
    console.log(`[migrate:demo-user] Old credential rows removed: ${credentialsDeleted.rowCount || 0}`);
    console.log(`[migrate:demo-user] Completed successfully.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[migrate:demo-user] Failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
