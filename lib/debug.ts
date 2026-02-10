export function debugEnabled() {
  return process.env.DEBUG_LOGS === 'true';
}

export function debugLog(message: string, data?: Record<string, any>) {
  if (!debugEnabled()) return;
  if (data) {
    console.log(`[DEBUG] ${message}`, data);
  } else {
    console.log(`[DEBUG] ${message}`);
  }
}

export function debugError(message: string, error: unknown, data?: Record<string, any>) {
  if (!debugEnabled()) return;
  const err =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error };
  console.error(`[DEBUG] ${message}`, { ...data, ...err });
}
