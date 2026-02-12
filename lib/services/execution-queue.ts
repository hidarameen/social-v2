type QueueJobOptions<T> = {
  label: string;
  run: () => Promise<T>;
  userId?: string;
  taskId?: string;
  dedupeKey?: string;
};

type QueueJob<T> = QueueJobOptions<T> & {
  id: string;
  enqueuedAt: number;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function jobId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ExecutionQueue {
  private readonly maxGlobalConcurrency: number;
  private readonly maxPerUserConcurrency: number;
  private readonly maxPerTaskConcurrency: number;
  private readonly maxQueueSize: number;

  private queue: QueueJob<unknown>[] = [];
  private activeGlobal = 0;
  private activePerUser = new Map<string, number>();
  private activePerTask = new Map<string, number>();
  private inFlightByDedupeKey = new Map<string, Promise<unknown>>();
  private draining = false;

  constructor() {
    this.maxGlobalConcurrency = parsePositiveInt(process.env.WORKER_GLOBAL_CONCURRENCY, 8);
    this.maxPerUserConcurrency = parsePositiveInt(process.env.WORKER_PER_USER_CONCURRENCY, 2);
    this.maxPerTaskConcurrency = parsePositiveInt(process.env.WORKER_PER_TASK_CONCURRENCY, 1);
    this.maxQueueSize = parsePositiveInt(process.env.WORKER_QUEUE_MAX_SIZE, 2000);
  }

  enqueue<T>(options: QueueJobOptions<T>): Promise<T> {
    if (options.dedupeKey) {
      const existing = this.inFlightByDedupeKey.get(options.dedupeKey);
      if (existing) return existing as Promise<T>;
    }

    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error(`Execution queue is full (${this.maxQueueSize})`));
    }

    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const job: QueueJob<T> = {
      id: jobId(),
      enqueuedAt: Date.now(),
      ...options,
      resolve,
      reject,
    };

    this.queue.push(job as QueueJob<unknown>);
    if (options.dedupeKey) {
      this.inFlightByDedupeKey.set(options.dedupeKey, promise as Promise<unknown>);
    }

    void this.drain();
    return promise;
  }

  snapshot() {
    return {
      queued: this.queue.length,
      activeGlobal: this.activeGlobal,
      maxGlobalConcurrency: this.maxGlobalConcurrency,
      maxPerUserConcurrency: this.maxPerUserConcurrency,
      maxPerTaskConcurrency: this.maxPerTaskConcurrency,
      maxQueueSize: this.maxQueueSize,
    };
  }

  private canRun(job: QueueJob<unknown>): boolean {
    if (this.activeGlobal >= this.maxGlobalConcurrency) return false;

    if (job.userId) {
      const activeForUser = this.activePerUser.get(job.userId) || 0;
      if (activeForUser >= this.maxPerUserConcurrency) return false;
    }

    if (job.taskId) {
      const activeForTask = this.activePerTask.get(job.taskId) || 0;
      if (activeForTask >= this.maxPerTaskConcurrency) return false;
    }

    return true;
  }

  private increment(job: QueueJob<unknown>) {
    this.activeGlobal += 1;
    if (job.userId) {
      this.activePerUser.set(job.userId, (this.activePerUser.get(job.userId) || 0) + 1);
    }
    if (job.taskId) {
      this.activePerTask.set(job.taskId, (this.activePerTask.get(job.taskId) || 0) + 1);
    }
  }

  private decrement(job: QueueJob<unknown>) {
    this.activeGlobal = Math.max(0, this.activeGlobal - 1);

    if (job.userId) {
      const next = (this.activePerUser.get(job.userId) || 0) - 1;
      if (next > 0) this.activePerUser.set(job.userId, next);
      else this.activePerUser.delete(job.userId);
    }

    if (job.taskId) {
      const next = (this.activePerTask.get(job.taskId) || 0) - 1;
      if (next > 0) this.activePerTask.set(job.taskId, next);
      else this.activePerTask.delete(job.taskId);
    }
  }

  private async execute(job: QueueJob<unknown>) {
    this.increment(job);
    try {
      const result = await job.run();
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    } finally {
      this.decrement(job);
      if (job.dedupeKey) {
        this.inFlightByDedupeKey.delete(job.dedupeKey);
      }
      void this.drain();
    }
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (true) {
        if (this.activeGlobal >= this.maxGlobalConcurrency) return;
        const index = this.queue.findIndex((job) => this.canRun(job));
        if (index === -1) return;
        const [job] = this.queue.splice(index, 1);
        if (!job) return;
        void this.execute(job);
      }
    } finally {
      this.draining = false;
    }
  }
}

const globalKey = '__executionQueue__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new ExecutionQueue();
}

export const executionQueue: ExecutionQueue = g[globalKey];
