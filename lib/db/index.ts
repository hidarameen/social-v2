import { Pool } from 'pg';
import { v4 as randomUUID } from 'uuid';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
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
    triggerType?: 'on_tweet' | 'on_mention' | 'on_keyword' | 'on_hashtag';
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

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash ?? undefined,
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
  // User Methods
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    const result = await pool.query(
      `
      INSERT INTO users (id, email, name, password_hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
      RETURNING id, email, name, password_hash, created_at, updated_at
      `,
      [user.id, user.email, user.name, user.passwordHash ?? null]
    );
    return mapUser(result.rows[0]);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query(
      `SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query(
      `SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
  }

  async getAllUsers(): Promise<User[]> {
    const result = await pool.query(
      `SELECT id, email, name, password_hash, created_at, updated_at FROM users ORDER BY created_at DESC`
    );
    return result.rows.map(mapUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const current = await this.getUser(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    const result = await pool.query(
      `
      UPDATE users
      SET email = $2, name = $3, password_hash = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, password_hash, created_at, updated_at
      `,
      [id, next.email, next.name, next.passwordHash ?? null]
    );
    return mapUser(result.rows[0]);
  }

  async getUserByEmailWithPassword(email: string): Promise<User | undefined> {
    const result = await pool.query(
      `SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) return undefined;
    return mapUser(result.rows[0]);
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
    return mapExecution(result.rows[0]);
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
    sortBy?: 'executedAt' | 'status' | 'taskName';
    sortDir?: 'asc' | 'desc';
  }): Promise<{ total: number; executions: Array<TaskExecution & { taskName: string }> }> {
    const { userId, limit, offset, status, search, sortBy, sortDir } = params;
    const conditions: string[] = ['t.user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`e.status = $${idx++}`);
      values.push(status);
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
        t.name AS task_name
      FROM task_executions e
      JOIN tasks t ON t.id = e.task_id
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
