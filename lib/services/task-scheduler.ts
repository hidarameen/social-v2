import { db } from '@/lib/db';
import { taskProcessor } from '@/lib/services/task-processor';
import { executionQueue } from '@/lib/services/execution-queue';

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
      const active = tasks.filter((task) => task.status === 'active');
      const jobs: Array<Promise<unknown>> = [];

      for (const task of active) {
        if (task.executionType === 'scheduled' && task.scheduleTime) {
          const alreadyExecuted = task.lastExecuted && task.lastExecuted >= task.scheduleTime;
          if (!alreadyExecuted && task.scheduleTime <= now) {
            jobs.push(
              executionQueue.enqueue({
                label: 'scheduler:scheduled-task',
                userId: task.userId,
                taskId: task.id,
                dedupeKey: `scheduler:scheduled:${task.id}`,
                run: async () => {
                  await taskProcessor.processTask(task.id);
                  await db.updateTask(task.id, { status: 'completed' });
                },
              })
            );
          }
        }

        if (task.executionType === 'recurring' && this.shouldExecuteRecurring(task, now)) {
          jobs.push(
            executionQueue.enqueue({
              label: 'scheduler:recurring-task',
              userId: task.userId,
              taskId: task.id,
              dedupeKey: `scheduler:recurring:${task.id}`,
              run: async () => {
                await taskProcessor.processTask(task.id);
              },
            })
          );
        }
      }
      if (jobs.length > 0) {
        await Promise.allSettled(jobs);
      }
    } finally {
      this.running = false;
    }
  }

  private shouldExecuteRecurring(task: { lastExecuted?: Date; recurringPattern?: string }, now: Date): boolean {
    if (!task.lastExecuted) return true;

    const lastExec = new Date(task.lastExecuted);
    const elapsed = now.getTime() - lastExec.getTime();

    switch (task.recurringPattern) {
      case 'daily':
        return elapsed >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return elapsed >= 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return elapsed >= 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
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
