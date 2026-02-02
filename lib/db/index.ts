// محاكاة قاعدة البيانات الشاملة
// في بيئة الإنتاج، ستستخدم Neon PostgreSQL

export interface User {
  id: string;
  email: string;
  name: string;
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
  };
  transformations?: {
    addHashtags?: string[];
    prependText?: string;
    appendText?: string;
    mediaResize?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
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

// محاكاة التخزين
class Database {
  private users: Map<string, User> = new Map();
  private accounts: Map<string, PlatformAccount> = new Map();
  private tasks: Map<string, Task> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private analytics: Map<string, Analytics> = new Map();

  // User Methods
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // Platform Account Methods
  createAccount(account: Omit<PlatformAccount, 'id' | 'createdAt' | 'updatedAt'>): PlatformAccount {
    const newAccount: PlatformAccount = {
      ...account,
      id: `acc_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.set(newAccount.id, newAccount);
    return newAccount;
  }

  getAccount(id: string): PlatformAccount | undefined {
    return this.accounts.get(id);
  }

  getUserAccounts(userId: string): PlatformAccount[] {
    return Array.from(this.accounts.values()).filter(a => a.userId === userId);
  }

  getPlatformAccounts(userId: string, platformId: string): PlatformAccount[] {
    return Array.from(this.accounts.values()).filter(
      a => a.userId === userId && a.platformId === platformId
    );
  }

  updateAccount(id: string, updates: Partial<PlatformAccount>): PlatformAccount | undefined {
    const account = this.accounts.get(id);
    if (!account) return undefined;
    const updated = { ...account, ...updates, updatedAt: new Date() };
    this.accounts.set(id, updated);
    return updated;
  }

  deleteAccount(id: string): boolean {
    return this.accounts.delete(id);
  }

  // Task Methods
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'lastExecuted'>): Task {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getUserTasks(userId: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.userId === userId);
  }

  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  // Task Execution Methods
  createExecution(execution: Omit<TaskExecution, 'id'>): TaskExecution {
    const newExecution: TaskExecution = {
      ...execution,
      id: `exec_${Date.now()}`,
    };
    this.executions.set(newExecution.id, newExecution);
    return newExecution;
  }

  getTaskExecutions(taskId: string): TaskExecution[] {
    return Array.from(this.executions.values()).filter(e => e.taskId === taskId);
  }

  getExecutionsByDate(userId: string, startDate: Date, endDate: Date): TaskExecution[] {
    return Array.from(this.executions.values()).filter(e => {
      const task = this.tasks.get(e.taskId);
      return (
        task?.userId === userId &&
        e.executedAt >= startDate &&
        e.executedAt <= endDate
      );
    });
  }

  // Analytics Methods
  recordAnalytics(analytics: Omit<Analytics, 'id'>): Analytics {
    const newAnalytics: Analytics = {
      ...analytics,
      id: `analytics_${Date.now()}`,
    };
    this.analytics.set(newAnalytics.id, newAnalytics);
    return newAnalytics;
  }

  getAnalytics(userId: string, platformId: string, startDate: Date, endDate: Date): Analytics[] {
    return Array.from(this.analytics.values()).filter(
      a => a.userId === userId && a.platformId === platformId && 
      a.date >= startDate && a.date <= endDate
    );
  }

  // Seed data for demo
  seedDemoData() {
    const demoUser = this.createUser({
      email: 'demo@example.com',
      name: 'Demo User',
    });

    this.createAccount({
      userId: demoUser.id,
      platformId: 'facebook',
      accountName: 'My Facebook Page',
      accountUsername: 'demo_page',
      accountId: 'fb_123456',
      accessToken: 'fb_token_demo',
      isActive: true,
    });

    this.createAccount({
      userId: demoUser.id,
      platformId: 'twitter',
      accountName: 'My Twitter Account',
      accountUsername: '@demo_user',
      accountId: 'tw_123456',
      accessToken: 'tw_token_demo',
      isActive: true,
    });

    return demoUser;
  }
}

// Export singleton instance
export const db = new Database();

// Seed demo data on initialization (always seed for consistent behavior)
db.seedDemoData();
