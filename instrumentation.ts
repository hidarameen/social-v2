export const runtime = 'nodejs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import background services to avoid Edge runtime issues with Node.js built-ins
    const { ensureTwitterPollingStarted } = await import('@/lib/services/twitter-poller');
    const { ensureSchedulerStarted } = await import('@/lib/services/task-scheduler');
    const { ensureTwitterStreamStarted } = await import('@/lib/services/twitter-stream');
    
    ensureTwitterPollingStarted();
    ensureSchedulerStarted();
    ensureTwitterStreamStarted();
  }
}
