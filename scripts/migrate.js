const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Applying schema...');
    await client.query(schemaSql);
    console.log('[migrate] Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
