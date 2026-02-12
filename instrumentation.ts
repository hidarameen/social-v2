export const runtime = 'nodejs';

function isIgnorableProcessWarning(warning: Error & { name?: string }): boolean {
  const message = String(warning?.message || '');
  const stack = String(warning?.stack || '');

  return (
    message.includes("SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'") &&
    (stack.includes('pg-connection-string') || message.includes('pg-connection-string'))
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logServerError, logServerInfo, logServerWarn } = await import('@/lib/server-logger');
    const globalKey = '__socialflow_server_error_hooks_registered__';
    const globalRef = globalThis as any;

    if (!globalRef[globalKey]) {
      process.on('unhandledRejection', (reason) => {
        logServerError('runtime', 'Unhandled promise rejection', reason);
      });

      process.on('uncaughtException', (error) => {
        logServerError('runtime', 'Uncaught exception', error);
      });

      process.on('warning', (warning) => {
        if (isIgnorableProcessWarning(warning)) {
          return;
        }
        logServerWarn('runtime', 'Process warning', {
          name: warning.name,
          message: warning.message,
          stack: warning.stack,
        });
      });

      globalRef[globalKey] = true;
      logServerInfo('runtime', 'Global server error hooks registered');
    }

    // Dynamically import background services to avoid Edge runtime issues with Node.js built-ins
    const { ensureTwitterPollingStarted } = await import('@/lib/services/twitter-poller');
    const { ensureSchedulerStarted } = await import('@/lib/services/task-scheduler');
    const { ensureTwitterStreamStarted } = await import('@/lib/services/twitter-stream');
    
    ensureTwitterPollingStarted();
    ensureSchedulerStarted();
    ensureTwitterStreamStarted();
  }
}
