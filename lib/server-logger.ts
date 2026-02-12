type LogLevel = 'info' | 'warn' | 'error';

type LogPayload = {
  level: LogLevel;
  scope: string;
  message: string;
  requestId?: string;
  meta?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  timestamp: string;
};

function serializeError(error: unknown): LogPayload['error'] | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

function safeMeta(meta?: Record<string, any>): Record<string, any> | undefined {
  if (!meta) return undefined;
  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return { note: 'meta_not_serializable' };
  }
}

function writeLog(payload: LogPayload) {
  const line = JSON.stringify(payload);
  if (payload.level === 'error') {
    console.error(line);
  } else if (payload.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logServerInfo(scope: string, message: string, meta?: Record<string, any>) {
  writeLog({
    level: 'info',
    scope,
    message,
    meta: safeMeta(meta),
    timestamp: new Date().toISOString(),
  });
}

export function logServerWarn(scope: string, message: string, meta?: Record<string, any>) {
  writeLog({
    level: 'warn',
    scope,
    message,
    meta: safeMeta(meta),
    timestamp: new Date().toISOString(),
  });
}

export function logServerError(
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, any>
) {
  writeLog({
    level: 'error',
    scope,
    message,
    meta: safeMeta(meta),
    error: serializeError(error),
    timestamp: new Date().toISOString(),
  });
}

