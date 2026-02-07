import { db } from '@/lib/db';
import { taskProcessor } from '@/lib/services/task-processor';

const DEFAULT_SCHEDULER_INTERVAL_SECONDS = 30;

function getIntervalMs() {
  const raw = process.env.SCHEDULER_INTERVAL_SECONDS;
  const seconds = raw ? Number(raw) : DEFAULT_SCHEDULER_INTERVAL_SECONDS;
  if (!Number.isFinite(seconds) || seconds < 5) return DEFAULT_SCHEDULER_INTERVAL_SECONDS * 1000;
  return Math.floor(seconds * 1000);
}

export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (this.intervalId) return;
    const interval = getIntervalMs();
    this.intervalId = setInterval(() => {
      this.tick().catch(err => console.error('[TaskScheduler] Tick failed:', err));
    }, interval);
    console.log(`[TaskScheduler] Started with interval ${interval}ms`);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async runOnce() {
    await this.tick();
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tasks = await db.getAllTasks();
      const now = new Date();

      for (const task of tasks) {
        if (task.status !== 'active') continue;

        if (task.executionType === 'scheduled' && task.scheduleTime) {
          const alreadyExecuted = task.lastExecuted && task.lastExecuted >= task.scheduleTime;
          if (!alreadyExecuted && task.scheduleTime <= now) {
            await taskProcessor.processTask(task.id);
            await db.updateTask(task.id, { status: 'completed' });
          }
        }

        if (task.executionType === 'recurring') {
          await taskProcessor.processRecurringTasks();
        }
      }
    } finally {
      this.running = false;
    }
  }
}

const globalKey = '__taskScheduler__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new TaskScheduler();
}

export const taskScheduler: TaskScheduler = g[globalKey];

export function ensureSchedulerStarted() {
  taskScheduler.start();
}
