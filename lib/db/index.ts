import { Pool } from 'pg';
import { v4 as randomUUID } from 'uuid';
import { executionEvents } from '@/lib/services/execution-events';

export interface User {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string;
  passwordHash?: string;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformAccount {
  id: string;
  userId: string;
  platformId: string; // facebook, instagram, twitter, tiktok, youtube, telegram, linkedin
  accountName: string;
  accountUsername: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  credentials?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPlatformCredential {
  id: string;
  userId: string;
  platformId: string;
  credentials: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  name: string;
  description: string;
  sourceAccounts: string[]; // IDs of PlatformAccount
  targetAccounts: string[]; // IDs of PlatformAccount
  contentType: 'text' | 'image' | 'video' | 'link';
  status: 'active' | 'paused' | 'completed' | 'error';
  executionType: 'immediate' | 'scheduled' | 'recurring';
  scheduleTime?: Date;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringDays?: number[];
  filters?: {
    keywords?: string[];
    excludeKeywords?: string[];
    minEngagement?: number;
    mediaOnly?: boolean;
    twitterSourceType?: 'account' | 'username';
    twitterUsername?: string;
    excludeReplies?: boolean;
    excludeRetweets?: boolean;
    excludeQuotes?: boolean;
    originalOnly?: boolean;
    pollIntervalMinutes?: number;
    pollIntervalSeconds?: number;
    triggerType?: 'on_tweet' | 'on_mention' | 'on_keyword' | 'on_hashtag' | 'on_search' | 'on_retweet' | 'on_like';
    triggerValue?: string;
  };
  transformations?: {
    addHashtags?: string[];
    prependText?: string;
    appendText?: string;
    mediaResize?: boolean;
    template?: string;
    includeMedia?: boolean;
    enableYtDlp?: boolean;
    manualPublish?: {
      enabled?: boolean;
      sourceAccountId?: string;
      sourceLabel?: string;
      sourcePlatformId?: string;
      mode?: 'now' | 'schedule';
      message?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'link';
      platformOverrides?: Record<
        string,
        {
          message?: string;
          mediaUrl?: string;
          mediaType?: 'image' | 'video' | 'link';
        }
      >;
      createdAt?: string;
    };
    automationSources?: Array<{
      accountId?: string;
      platformId?: string;
      accountLabel?: string;
      triggerId?: string;
    }>;
    automationTargets?: Array<{
      accountId?: string;
      platformId?: string;
      accountLabel?: string;
      actionId?: string;
    }>;
    twitterActions?: {
      post?: boolean;
      reply?: boolean;
      quote?: boolean;
      retweet?: boolean;
      like?: boolean;
    };
    youtubeActions?: {
      uploadVideo?: boolean;
      uploadVideoToPlaylist?: boolean;
      playlistId?: string;
    };
    youtubeVideo?: {
      titleTemplate?: string;
      descriptionTemplate?: string;
      tags?: string[];
      categoryId?: string;
      privacyStatus?: 'private' | 'unlisted' | 'public';
      embeddable?: boolean;
      license?: 'youtube' | 'creativeCommon';
      publicStatsViewable?: boolean;
      selfDeclaredMadeForKids?: boolean;
      notifySubscribers?: boolean;
      publishAt?: string;
      defaultLanguage?: string;
      defaultAudioLanguage?: string;
      recordingDate?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  failureCount: number;
  lastError?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  sourceAccount: string;
  targetAccount: string;
  originalContent: string;
  transformedContent: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  executedAt: Date;
  responseData?: Record<string, any>;
}

export interface Analytics {
  id: string;
  userId: string;
  date: Date;
  platformId: string;
  accountId: string;
  posts: number;
  engagements: number;
  clicks: number;
  reach: number;
  impressions: number;
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('[DB] DATABASE_URL is not set. Database calls will fail.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

const MIN_PENDING_VISIBILITY_MS = (() => {
  const parsed = Number(process.env.EXECUTION_MIN_PENDING_VISIBILITY_MS || '2200');
  if (!Number.isFinite(parsed) || parsed < 0) return 2200;
  return Math.floor(parsed);
})();

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    profileImageUrl: row.profile_image_url ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapAccount(row: any): PlatformAccount {
  return {
    id: row.id,
    userId: row.user_id,
    platformId: row.platform_id,
    accountName: row.account_name,
    accountUsername: row.account_username,
    accountId: row.account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    credentials: row.credentials ?? undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapTask(row: any): Task {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    sourceAccounts: row.source_accounts ?? [],
    targetAccounts: row.target_accounts ?? [],
    contentType: row.content_type,
    status: row.status,
    executionType: row.execution_type,
    scheduleTime: row.schedule_time ? new Date(row.schedule_time) : undefined,
    recurringPattern: row.recurring_pattern ?? undefined,
    recurringDays: row.recurring_days ?? undefined,
    filters: row.filters ?? undefined,
    transformations: row.transformations ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastExecuted: row.last_executed ? new Date(row.last_executed) : undefined,
    executionCount: row.execution_count ?? 0,
    failureCount: row.failure_count ?? 0,
    lastError: row.last_error ?? undefined,
  };
}

function mapUserPlatformCredential(row: any): UserPlatformCredential {
  return {
    id: row.id,
    userId: row.user_id,
    platformId: row.platform_id,
    credentials: row.credentials ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapExecution(row: any): TaskExecution {
  return {
    id: row.id,
    taskId: row.task_id,
    sourceAccount: row.source_account,
    targetAccount: row.target_account,
    originalContent: row.original_content,
    transformedContent: row.transformed_content,
    status: row.status,
    error: row.error ?? undefined,
    executedAt: new Date(row.executed_at),
    responseData: row.response_data ?? undefined,
  };
}

function mapAnalytics(row: any): Analytics {
  return {
    id: row.id,
    userId: row.user_id,
    date: new Date(row.date),
    platformId: row.platform_id,
    accountId: row.account_id,
    posts: row.posts,
    engagements: row.engagements,
    clicks: row.clicks,
    reach: row.reach,
    impressions: row.impressions,
  };
}

class Database {
  private telegramMediaGroupSchemaReady = false;
  private telegramWebhookUpdatesSchemaReady = false;
  private telegramProcessedMessagesSchemaReady = false;
  private platformCredentialsSchemaReady = false;
  private usersSchemaReady = false;
  private authTokensSchemaReady = false;

  private async ensureUsersSchema() {
    if (this.usersSchemaReady) return;

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_image_url TEXT
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ
    `);

    this.usersSchemaReady = true;
  }

  private async ensureAuthTokensSchema() {
    if (this.authTokensSchemaReady) return;

    await this.ensureUsersSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
      ON email_verification_tokens(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires
      ON email_verification_tokens(expires_at)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
      ON password_reset_tokens(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
      ON password_reset_tokens(expires_at)
    `);

    this.authTokensSchemaReady = true;
  }

  private async ensurePlatformCredentialsSchema() {
    if (this.platformCredentialsSchemaReady) return;

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

    this.platformCredentialsSchemaReady = true;
  }

  private async ensureTelegramMediaGroupSchema() {
    if (this.telegramMediaGroupSchemaReady) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_media_groups (
        group_key TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        media_group_id TEXT NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processing_owner TEXT,
        processing_started_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_media_group_items (
        group_key TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_key, message_id),
        FOREIGN KEY (group_key) REFERENCES telegram_media_groups(group_key) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_media_groups_last_seen
      ON telegram_media_groups(last_seen)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_media_groups_processed_at
      ON telegram_media_groups(processed_at)
    `);

    this.telegramMediaGroupSchemaReady = true;
  }

  private async ensureTelegramWebhookUpdatesSchema() {
    if (this.telegramWebhookUpdatesSchemaReady) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
        account_id TEXT NOT NULL,
        update_id BIGINT NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (account_id, update_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_first_seen
      ON telegram_webhook_updates(first_seen)
    `);

    this.telegramWebhookUpdatesSchemaReady = true;
  }

  private async ensureTelegramProcessedMessagesSchema() {
    if (this.telegramProcessedMessagesSchemaReady) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_processed_messages (
        account_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (account_id, chat_id, message_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_first_seen
      ON telegram_processed_messages(first_seen)
    `);

    this.telegramProcessedMessagesSchemaReady = true;
  }

  // User Methods
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    await this.ensureUsersSchema();
    const result = await pool.query(
      `
      INSERT INTO users (id, email, name, profile_image_url, password_hash, email_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        profile_image_url = EXCLUDED.profile_image_url,
        password_hash = EXCLUDED.password_hash,
        email_verified_at = EXCLUDED.email_verified_at
      RETURNING id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at
      `,
      [
        user.id,
        user.email,
        user.name,
        user.profileImageUrl ?? null,
        user.passwordHash ?? null,
        user.emailVerifiedAt ?? null,
      ]
    );
    return mapUser(result.rows[0]);
  }

  async getUser(id: string): Promise<User | undefined> {
    await this.ensureUsersSchema();
    const result = await pool.query(
      `SELECT id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureUsersSchema();
    const result = await pool.query(
      `SELECT id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at FROM users WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
  }

  async getAllUsers(): Promise<User[]> {
    await this.ensureUsersSchema();
    const result = await pool.query(
      `SELECT id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at FROM users ORDER BY created_at DESC`
    );
    return result.rows.map(mapUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    await this.ensureUsersSchema();
    const current = await this.getUser(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    const result = await pool.query(
      `
      UPDATE users
      SET email = $2, name = $3, profile_image_url = $4, password_hash = $5, email_verified_at = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at
      `,
      [
        id,
        next.email,
        next.name,
        next.profileImageUrl ?? null,
        next.passwordHash ?? null,
        next.emailVerifiedAt ?? null,
      ]
    );
    return mapUser(result.rows[0]);
  }

  async getUserByEmailWithPassword(email: string): Promise<User | undefined> {
    await this.ensureUsersSchema();
    const result = await pool.query(
      `SELECT id, email, name, profile_image_url, password_hash, email_verified_at, created_at, updated_at FROM users WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.ensureAuthTokensSchema();
    await pool.query(
      `
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), userId, tokenHash, expiresAt]
    );
  }

  async consumeEmailVerificationToken(tokenHash: string): Promise<{ userId: string } | undefined> {
    await this.ensureAuthTokensSchema();
    const result = await pool.query(
      `
      UPDATE email_verification_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
      `,
      [tokenHash]
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return { userId: result.rows[0].user_id };
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.ensureAuthTokensSchema();
    await pool.query(
      `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), userId, tokenHash, expiresAt]
    );
  }

  async consumePasswordResetToken(tokenHash: string): Promise<{ userId: string } | undefined> {
    await this.ensureAuthTokensSchema();
    const result = await pool.query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
      `,
      [tokenHash]
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return { userId: result.rows[0].user_id };
  }

  // User Platform Credentials Methods
  async getUserPlatformCredential(
    userId: string,
    platformId: string
  ): Promise<UserPlatformCredential | undefined> {
    await this.ensurePlatformCredentialsSchema();
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, credentials, created_at, updated_at
      FROM user_platform_credentials
      WHERE user_id = $1 AND platform_id = $2
      `,
      [userId, platformId]
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return mapUserPlatformCredential(result.rows[0]);
  }

  async getUserPlatformCredentials(userId: string): Promise<UserPlatformCredential[]> {
    await this.ensurePlatformCredentialsSchema();
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, credentials, created_at, updated_at
      FROM user_platform_credentials
      WHERE user_id = $1
      ORDER BY platform_id ASC
      `,
      [userId]
    );
    return result.rows.map(mapUserPlatformCredential);
  }

  async getAnyPlatformCredential(platformId: string): Promise<UserPlatformCredential | undefined> {
    await this.ensurePlatformCredentialsSchema();
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, credentials, created_at, updated_at
      FROM user_platform_credentials
      WHERE platform_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [platformId]
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return mapUserPlatformCredential(result.rows[0]);
  }

  async upsertUserPlatformCredential(params: {
    userId: string;
    platformId: string;
    credentials: Record<string, any>;
  }): Promise<UserPlatformCredential> {
    await this.ensurePlatformCredentialsSchema();
    const result = await pool.query(
      `
      INSERT INTO user_platform_credentials (id, user_id, platform_id, credentials)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (user_id, platform_id)
      DO UPDATE SET credentials = EXCLUDED.credentials, updated_at = NOW()
      RETURNING id, user_id, platform_id, credentials, created_at, updated_at
      `,
      [randomUUID(), params.userId, params.platformId, JSON.stringify(params.credentials ?? {})]
    );
    return mapUserPlatformCredential(result.rows[0]);
  }

  // Platform Account Methods
  async createAccount(account: Omit<PlatformAccount, 'createdAt' | 'updatedAt'>): Promise<PlatformAccount> {
    const result = await pool.query(
      `
      INSERT INTO platform_accounts (
        id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      `,
      [
        account.id,
        account.userId,
        account.platformId,
        account.accountName,
        account.accountUsername,
        account.accountId,
        account.accessToken,
        account.refreshToken ?? null,
        account.credentials ?? {},
        account.isActive,
      ]
    );
    return mapAccount(result.rows[0]);
  }

  async getAccount(id: string): Promise<PlatformAccount | undefined> {
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      FROM platform_accounts WHERE id = $1
      `,
      [id]
    );
    if (result.rowCount === 0) return undefined;
    return mapAccount(result.rows[0]);
  }

  async getUserAccounts(userId: string): Promise<PlatformAccount[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      FROM platform_accounts WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );
    return result.rows.map(mapAccount);
  }

  async getUserAccountsPaged(params: {
    userId: string;
    limit: number;
    offset: number;
    search?: string;
    platformId?: string;
    isActive?: boolean;
    sortBy?: 'createdAt' | 'platformId' | 'isActive' | 'accountName';
    sortDir?: 'asc' | 'desc';
  }): Promise<{ total: number; accounts: PlatformAccount[] }> {
    const { userId, limit, offset, search, platformId, isActive, sortBy, sortDir } = params;
    const conditions: string[] = ['user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (platformId) {
      conditions.push(`platform_id = $${idx++}`);
      values.push(platformId);
    }
    if (typeof isActive === 'boolean') {
      conditions.push(`is_active = $${idx++}`);
      values.push(isActive);
    }
    if (search) {
      conditions.push(`(account_name ILIKE $${idx} OR account_username ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM platform_accounts ${where}`,
      values
    );

    const sortColumn =
      sortBy === 'platformId'
        ? 'platform_id'
        : sortBy === 'isActive'
        ? 'is_active'
        : sortBy === 'accountName'
        ? 'account_name'
        : 'created_at';
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC';

    const dataRes = await pool.query(
      `
      SELECT id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      FROM platform_accounts
      ${where}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, limit, offset]
    );

    return {
      total: countRes.rows[0]?.count ?? 0,
      accounts: dataRes.rows.map(mapAccount),
    };
  }

  async getPlatformAccounts(userId: string, platformId: string): Promise<PlatformAccount[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      FROM platform_accounts WHERE user_id = $1 AND platform_id = $2
      ORDER BY created_at DESC
      `,
      [userId, platformId]
    );
    return result.rows.map(mapAccount);
  }

  async getAllAccounts(): Promise<PlatformAccount[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      FROM platform_accounts
      ORDER BY created_at DESC
      `
    );
    return result.rows.map(mapAccount);
  }

  async updateAccount(id: string, updates: Partial<PlatformAccount>): Promise<PlatformAccount | undefined> {
    const current = await this.getAccount(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    const result = await pool.query(
      `
      UPDATE platform_accounts
      SET platform_id = $2,
          account_name = $3,
          account_username = $4,
          account_id = $5,
          access_token = $6,
          refresh_token = $7,
          credentials = $8,
          is_active = $9,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, user_id, platform_id, account_name, account_username, account_id,
        access_token, refresh_token, credentials, is_active, created_at, updated_at
      `,
      [
        id,
        next.platformId,
        next.accountName,
        next.accountUsername,
        next.accountId,
        next.accessToken,
        next.refreshToken ?? null,
        next.credentials ?? {},
        next.isActive,
      ]
    );
    return mapAccount(result.rows[0]);
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM platform_accounts WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Task Methods
  async createTask(task: Omit<Task, 'createdAt' | 'updatedAt' | 'lastExecuted'>): Promise<Task> {
    const result = await pool.query(
      `
      INSERT INTO tasks (
        id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, execution_count, failure_count, last_error
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      `,
      [
        task.id,
        task.userId,
        task.name,
        task.description,
        task.sourceAccounts,
        task.targetAccounts,
        task.contentType,
        task.status,
        task.executionType,
        task.scheduleTime ?? null,
        task.recurringPattern ?? null,
        task.recurringDays ?? null,
        task.filters ?? null,
        task.transformations ?? null,
        task.executionCount ?? 0,
        task.failureCount ?? 0,
        task.lastError ?? null,
      ]
    );
    return mapTask(result.rows[0]);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await pool.query(
      `
      SELECT id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      FROM tasks WHERE id = $1
      `,
      [id]
    );
    if (result.rowCount === 0) return undefined;
    return mapTask(result.rows[0]);
  }

  async getUserTasks(userId: string): Promise<Task[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      FROM tasks WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );
    return result.rows.map(mapTask);
  }

  async getUserTasksPaged(params: {
    userId: string;
    limit: number;
    offset: number;
    search?: string;
    status?: string;
    sortBy?: 'createdAt' | 'status' | 'name';
    sortDir?: 'asc' | 'desc';
  }): Promise<{ total: number; tasks: Task[] }> {
    const { userId, limit, offset, search, status, sortBy, sortDir } = params;
    const conditions: string[] = ['user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks ${where}`,
      values
    );

    const sortColumn =
      sortBy === 'status' ? 'status' : sortBy === 'name' ? 'name' : 'created_at';
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC';

    const dataRes = await pool.query(
      `
      SELECT id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      FROM tasks
      ${where}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, limit, offset]
    );

    return {
      total: countRes.rows[0]?.count ?? 0,
      tasks: dataRes.rows.map(mapTask),
    };
  }

  async getAllTasks(): Promise<Task[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      FROM tasks
      ORDER BY created_at DESC
      `
    );
    return result.rows.map(mapTask);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const current = await this.getTask(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    const result = await pool.query(
      `
      UPDATE tasks
      SET name = $2,
          description = $3,
          source_accounts = $4,
          target_accounts = $5,
          content_type = $6,
          status = $7,
          execution_type = $8,
          schedule_time = $9,
          recurring_pattern = $10,
          recurring_days = $11,
          filters = $12,
          transformations = $13,
          last_executed = $14,
          execution_count = $15,
          failure_count = $16,
          last_error = $17,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      `,
      [
        id,
        next.name,
        next.description,
        next.sourceAccounts,
        next.targetAccounts,
        next.contentType,
        next.status,
        next.executionType,
        next.scheduleTime ?? null,
        next.recurringPattern ?? null,
        next.recurringDays ?? null,
        next.filters ?? null,
        next.transformations ?? null,
        next.lastExecuted ?? null,
        next.executionCount ?? 0,
        next.failureCount ?? 0,
        next.lastError ?? null,
      ]
    );
    return mapTask(result.rows[0]);
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveTasks(): Promise<Task[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, name, description, source_accounts, target_accounts,
        content_type, status, execution_type, schedule_time, recurring_pattern,
        recurring_days, filters, transformations, created_at, updated_at, last_executed,
        execution_count, failure_count, last_error
      FROM tasks
      WHERE status = 'active'
      ORDER BY created_at DESC
      `
    );
    return result.rows.map(mapTask);
  }

  // Task Execution Methods
  async createExecution(execution: Omit<TaskExecution, 'id'>): Promise<TaskExecution> {
    const id = randomUUID();
    const result = await pool.query(
      `
      INSERT INTO task_executions (
        id, task_id, source_account, target_account, original_content,
        transformed_content, status, error, executed_at, response_data
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, task_id, source_account, target_account, original_content,
        transformed_content, status, error, executed_at, response_data
      `,
      [
        id,
        execution.taskId,
        execution.sourceAccount,
        execution.targetAccount,
        execution.originalContent,
        execution.transformedContent,
        execution.status,
        execution.error ?? null,
        execution.executedAt,
        execution.responseData ?? null,
      ]
    );
    const created = mapExecution(result.rows[0]);
    executionEvents.emitChanged();
    return created;
  }

  async updateExecution(
    executionId: string,
    patch: Partial<{
      transformedContent: string;
      status: TaskExecution['status'];
      error: string | null;
      executedAt: Date;
      responseData: Record<string, any> | null;
    }>
  ): Promise<TaskExecution> {
    const currentRes = await pool.query(
      `
      SELECT id, task_id, source_account, target_account, original_content,
        transformed_content, status, error, executed_at, response_data
      FROM task_executions
      WHERE id = $1
      LIMIT 1
      `,
      [executionId]
    );
    if (currentRes.rows.length === 0) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const current = mapExecution(currentRes.rows[0]);
    if (
      MIN_PENDING_VISIBILITY_MS > 0 &&
      current.status === 'pending' &&
      patch.status !== undefined &&
      patch.status !== 'pending'
    ) {
      const elapsed = Date.now() - current.executedAt.getTime();
      const waitMs = MIN_PENDING_VISIBILITY_MS - elapsed;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    const nextTransformedContent =
      patch.transformedContent !== undefined
        ? patch.transformedContent
        : current.transformedContent;
    const nextStatus = patch.status !== undefined ? patch.status : current.status;
    const nextError = patch.error !== undefined ? patch.error : current.error ?? null;
    const nextExecutedAt = patch.executedAt !== undefined ? patch.executedAt : current.executedAt;
    const nextResponseData = (() => {
      if (patch.responseData === undefined) {
        return current.responseData ?? null;
      }
      if (patch.responseData === null) {
        return null;
      }
      const currentData =
        current.responseData && typeof current.responseData === 'object'
          ? (current.responseData as Record<string, any>)
          : {};
      return {
        ...currentData,
        ...patch.responseData,
      };
    })();

    const result = await pool.query(
      `
      UPDATE task_executions
      SET
        transformed_content = $2,
        status = $3,
        error = $4,
        executed_at = $5,
        response_data = $6
      WHERE id = $1
      RETURNING id, task_id, source_account, target_account, original_content,
        transformed_content, status, error, executed_at, response_data
      `,
      [
        executionId,
        nextTransformedContent,
        nextStatus,
        nextError,
        nextExecutedAt,
        nextResponseData,
      ]
    );

    const updated = mapExecution(result.rows[0]);
    executionEvents.emitChanged();
    return updated;
  }

  async getTaskExecutions(taskId: string, limit = 100): Promise<TaskExecution[]> {
    const result = await pool.query(
      `
      SELECT id, task_id, source_account, target_account, original_content,
        transformed_content, status, error, executed_at, response_data
      FROM task_executions
      WHERE task_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
      `,
      [taskId, limit]
    );
    return result.rows.map(mapExecution);
  }

  async getExecutionsForUserPaged(params: {
    userId: string;
    limit: number;
    offset: number;
    status?: string;
    search?: string;
    taskId?: string;
    sortBy?: 'executedAt' | 'status' | 'taskName';
    sortDir?: 'asc' | 'desc';
  }): Promise<{
    total: number;
    executions: Array<
      TaskExecution & {
        taskName: string;
        sourceAccountName?: string;
        targetAccountName?: string;
        sourcePlatformId?: string;
        targetPlatformId?: string;
      }
    >;
  }> {
    const { userId, limit, offset, status, search, taskId, sortBy, sortDir } = params;
    const conditions: string[] = ['t.user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`e.status = $${idx++}`);
      values.push(status);
    }
    if (taskId) {
      conditions.push(`e.task_id = $${idx++}`);
      values.push(taskId);
    }
    if (search) {
      conditions.push(`(t.name ILIKE $${idx} OR e.original_content ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM task_executions e
      JOIN tasks t ON t.id = e.task_id
      ${where}
      `,
      values
    );

    const sortColumn =
      sortBy === 'status' ? 'e.status' : sortBy === 'taskName' ? 't.name' : 'e.executed_at';
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC';

    const dataRes = await pool.query(
      `
      SELECT e.id, e.task_id, e.source_account, e.target_account, e.original_content,
        e.transformed_content, e.status, e.error, e.executed_at, e.response_data,
        t.name AS task_name,
        source_account_row.account_name AS source_account_name,
        source_account_row.account_username AS source_account_username,
        source_account_row.platform_id AS source_platform_id,
        target_account_row.account_name AS target_account_name,
        target_account_row.account_username AS target_account_username,
        target_account_row.platform_id AS target_platform_id
      FROM task_executions e
      JOIN tasks t ON t.id = e.task_id
      LEFT JOIN platform_accounts source_account_row
        ON source_account_row.id = e.source_account AND source_account_row.user_id = t.user_id
      LEFT JOIN platform_accounts target_account_row
        ON target_account_row.id = e.target_account AND target_account_row.user_id = t.user_id
      ${where}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, limit, offset]
    );

    return {
      total: countRes.rows[0]?.count ?? 0,
      executions: dataRes.rows.map((row: any) => ({
        ...mapExecution(row),
        taskName: row.task_name,
        sourceAccountName:
          row.source_account_name ||
          row.source_account_username ||
          row.response_data?.manualSourceLabel ||
          undefined,
        sourcePlatformId:
          row.source_platform_id ||
          row.response_data?.manualSourcePlatformId ||
          row.response_data?.sourcePlatformId ||
          undefined,
        targetAccountName:
          row.target_account_name ||
          row.target_account_username ||
          row.response_data?.targetAccountName ||
          undefined,
        targetPlatformId:
          row.target_platform_id ||
          row.response_data?.targetPlatformId ||
          undefined,
      })),
    };
  }

  async getExecutionTotalsForUser(userId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const res = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END), 0)::int AS successful,
        COALESCE(SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
      FROM task_executions e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.user_id = $1
      `,
      [userId]
    );
    return {
      total: res.rows[0]?.total ?? 0,
      successful: res.rows[0]?.successful ?? 0,
      failed: res.rows[0]?.failed ?? 0,
    };
  }

  async getTaskStatsForUser(params: {
    userId: string;
    limit: number;
    offset: number;
    search?: string;
    sortBy?: 'taskName' | 'successRate' | 'totalExecutions' | 'failed';
    sortDir?: 'asc' | 'desc';
  }): Promise<{ total: number; stats: Array<{
    taskId: string;
    taskName: string;
    totalExecutions: number;
    successful: number;
    failed: number;
    successRate: number;
  }> }> {
    const { userId, limit, offset, search, sortBy, sortDir } = params;
    const conditions: string[] = ['t.user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (search) {
      conditions.push(`t.name ILIKE $${idx}`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks t ${where}`,
      values
    );

    const sortColumn =
      sortBy === 'taskName'
        ? 't.name'
        : sortBy === 'totalExecutions'
        ? 'total_executions'
        : sortBy === 'failed'
        ? 'failed'
        : 'success_rate';
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC';

    const dataRes = await pool.query(
      `
      SELECT
        t.id AS task_id,
        t.name AS task_name,
        COUNT(e.id)::int AS total_executions,
        COALESCE(SUM(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END), 0)::int AS successful,
        COALESCE(SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed,
        CASE
          WHEN COUNT(e.id) = 0 THEN 0
          ELSE ROUND((SUM(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END)::numeric / COUNT(e.id)) * 100)
        END AS success_rate
      FROM tasks t
      LEFT JOIN task_executions e ON e.task_id = t.id
      ${where}
      GROUP BY t.id
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, limit, offset]
    );

    return {
      total: countRes.rows[0]?.count ?? 0,
      stats: dataRes.rows.map((row: any) => {
        const total = row.total_executions ?? 0;
        const successful = row.successful ?? 0;
        return {
          taskId: row.task_id,
          taskName: row.task_name,
          totalExecutions: total,
          successful,
          failed: row.failed ?? 0,
          successRate: row.success_rate ?? (total > 0 ? Math.round((successful / total) * 100) : 0),
        };
      }),
    };
  }

  async getExecutionsByDate(userId: string, startDate: Date, endDate: Date): Promise<TaskExecution[]> {
    const result = await pool.query(
      `
      SELECT e.id, e.task_id, e.source_account, e.target_account, e.original_content,
        e.transformed_content, e.status, e.error, e.executed_at, e.response_data
      FROM task_executions e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.user_id = $1 AND e.executed_at >= $2 AND e.executed_at <= $3
      ORDER BY e.executed_at DESC
      `,
      [userId, startDate, endDate]
    );
    return result.rows.map(mapExecution);
  }

  async addTelegramMediaGroupMessage(params: {
    groupKey: string;
    accountId: string;
    chatId: string;
    mediaGroupId: string;
    messageId: number;
    payload: Record<string, any>;
  }): Promise<void> {
    await this.ensureTelegramMediaGroupSchema();
    await pool.query(
      `
      INSERT INTO telegram_media_groups (
        group_key, account_id, chat_id, media_group_id, first_seen, last_seen
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (group_key)
      DO UPDATE SET last_seen = NOW()
      `,
      [params.groupKey, params.accountId, params.chatId, params.mediaGroupId]
    );

    await pool.query(
      `
      INSERT INTO telegram_media_group_items (group_key, message_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (group_key, message_id) DO NOTHING
      `,
      [params.groupKey, params.messageId, JSON.stringify(params.payload ?? {})]
    );
  }

  async tryClaimTelegramMediaGroup(params: {
    groupKey: string;
    ownerId: string;
    quietWindowMs: number;
    staleClaimMs: number;
  }): Promise<boolean> {
    await this.ensureTelegramMediaGroupSchema();
    const result = await pool.query(
      `
      UPDATE telegram_media_groups
      SET processing_owner = $2,
          processing_started_at = NOW()
      WHERE group_key = $1
        AND processed_at IS NULL
        AND last_seen <= NOW() - ($3 * INTERVAL '1 millisecond')
        AND (
          processing_started_at IS NULL
          OR processing_started_at <= NOW() - ($4 * INTERVAL '1 millisecond')
        )
      RETURNING group_key
      `,
      [params.groupKey, params.ownerId, params.quietWindowMs, params.staleClaimMs]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async isTelegramMediaGroupPending(groupKey: string): Promise<boolean> {
    await this.ensureTelegramMediaGroupSchema();
    const result = await pool.query(
      `
      SELECT processed_at
      FROM telegram_media_groups
      WHERE group_key = $1
      `,
      [groupKey]
    );

    if ((result.rowCount ?? 0) === 0) return false;
    return !Boolean(result.rows[0]?.processed_at);
  }

  async getTelegramMediaGroupMessages(groupKey: string): Promise<Record<string, any>[]> {
    await this.ensureTelegramMediaGroupSchema();
    const result = await pool.query(
      `
      SELECT payload
      FROM telegram_media_group_items
      WHERE group_key = $1
      ORDER BY message_id ASC
      `,
      [groupKey]
    );
    return result.rows.map((row: any) => row.payload as Record<string, any>);
  }

  async markTelegramMediaGroupProcessed(groupKey: string, ownerId: string): Promise<void> {
    await this.ensureTelegramMediaGroupSchema();
    await pool.query(
      `
      UPDATE telegram_media_groups
      SET processed_at = NOW()
      WHERE group_key = $1 AND processing_owner = $2
      `,
      [groupKey, ownerId]
    );
  }

  async releaseTelegramMediaGroupClaim(groupKey: string, ownerId: string): Promise<void> {
    await this.ensureTelegramMediaGroupSchema();
    await pool.query(
      `
      UPDATE telegram_media_groups
      SET processing_owner = NULL,
          processing_started_at = NULL
      WHERE group_key = $1 AND processing_owner = $2 AND processed_at IS NULL
      `,
      [groupKey, ownerId]
    );
  }

  async cleanupTelegramMediaGroups(olderThanHours = 24): Promise<void> {
    await this.ensureTelegramMediaGroupSchema();
    await pool.query(
      `
      DELETE FROM telegram_media_groups
      WHERE (processed_at IS NOT NULL AND processed_at < NOW() - ($1 * INTERVAL '1 hour'))
         OR (processed_at IS NULL AND last_seen < NOW() - ($1 * INTERVAL '1 hour'))
      `,
      [olderThanHours]
    );
  }

  async registerTelegramWebhookUpdate(params: { accountId: string; updateId: number }): Promise<boolean> {
    await this.ensureTelegramWebhookUpdatesSchema();
    const result = await pool.query(
      `
      INSERT INTO telegram_webhook_updates (account_id, update_id, first_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (account_id, update_id) DO NOTHING
      RETURNING update_id
      `,
      [params.accountId, params.updateId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupTelegramWebhookUpdates(olderThanHours = 72): Promise<void> {
    await this.ensureTelegramWebhookUpdatesSchema();
    await pool.query(
      `
      DELETE FROM telegram_webhook_updates
      WHERE first_seen < NOW() - ($1 * INTERVAL '1 hour')
      `,
      [olderThanHours]
    );
  }

  async registerTelegramProcessedMessage(params: {
    accountId: string;
    chatId: string;
    messageId: number;
  }): Promise<boolean> {
    await this.ensureTelegramProcessedMessagesSchema();
    const result = await pool.query(
      `
      INSERT INTO telegram_processed_messages (account_id, chat_id, message_id, first_seen)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (account_id, chat_id, message_id) DO NOTHING
      RETURNING message_id
      `,
      [params.accountId, params.chatId, params.messageId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupTelegramProcessedMessages(olderThanHours = 72): Promise<void> {
    await this.ensureTelegramProcessedMessagesSchema();
    await pool.query(
      `
      DELETE FROM telegram_processed_messages
      WHERE first_seen < NOW() - ($1 * INTERVAL '1 hour')
      `,
      [olderThanHours]
    );
  }

  // Analytics Methods
  async recordAnalytics(analytics: Omit<Analytics, 'id'>): Promise<Analytics> {
    const id = randomUUID();
    const result = await pool.query(
      `
      INSERT INTO analytics (
        id, user_id, date, platform_id, account_id,
        posts, engagements, clicks, reach, impressions
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, user_id, date, platform_id, account_id,
        posts, engagements, clicks, reach, impressions
      `,
      [
        id,
        analytics.userId,
        analytics.date,
        analytics.platformId,
        analytics.accountId,
        analytics.posts,
        analytics.engagements,
        analytics.clicks,
        analytics.reach,
        analytics.impressions,
      ]
    );
    return mapAnalytics(result.rows[0]);
  }

  async getAnalytics(userId: string, platformId: string, startDate: Date, endDate: Date): Promise<Analytics[]> {
    const result = await pool.query(
      `
      SELECT id, user_id, date, platform_id, account_id,
        posts, engagements, clicks, reach, impressions
      FROM analytics
      WHERE user_id = $1 AND platform_id = $2 AND date >= $3 AND date <= $4
      ORDER BY date DESC
      `,
      [userId, platformId, startDate, endDate]
    );
    return result.rows.map(mapAnalytics);
  }
}

export const db = new Database();

export async function ensureUserExists(userId: string): Promise<User> {
  const existing = await db.getUser(userId);
  if (existing) return existing;
  return db.createUser({
    id: userId,
    email: `user-${userId}@socialflow.app`,
    name: 'User',
  });
}

export async function getOrCreateAccount(
  userId: string,
  platformId: string,
  accountId: string,
  username: string
): Promise<PlatformAccount> {
  const accounts = await db.getUserAccounts(userId);
  const existing = accounts.find(a => a.platformId === platformId && a.accountId === accountId);
  if (existing) return existing;
  return db.createAccount({
    id: randomUUID(),
    userId,
    platformId,
    accountName: username,
    accountUsername: username,
    accountId,
    accessToken: 'manual',
    credentials: {},
    isActive: true,
  });
}
