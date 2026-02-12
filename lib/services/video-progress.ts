import { debugLog } from '@/lib/debug';

export type VideoProgressContext = {
  flow: string;
  platform?: string;
  taskId?: string;
  targetId?: string;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function buildProgressBar(percent: number, width = 20): string {
  const safePercent = clampPercent(percent);
  const filled = Math.round((safePercent / 100) * width);
  const empty = Math.max(0, width - filled);
  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value || '');
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function formatCounterValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value <= 9999) return String(Math.trunc(value));
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`;
}

export function createVideoProgressLogger(context: VideoProgressContext) {
  let lastPercent = -1;
  let lastLoggedAt = 0;
  let lastCurrent = -1;
  const minPercentDelta = parsePositiveNumber(process.env.VIDEO_PROGRESS_MIN_PERCENT_DELTA, 2);
  const minIntervalMs = parsePositiveNumber(process.env.VIDEO_PROGRESS_MIN_INTERVAL_MS, 800);

  return (
    currentStep: number,
    totalSteps: number,
    stage: string,
    meta?: Record<string, any>
  ) => {
    const safeTotal = Math.max(1, Math.trunc(totalSteps || 1));
    const safeCurrent = Math.min(safeTotal, Math.max(0, Math.trunc(currentStep || 0)));
    const percent = clampPercent((safeCurrent / safeTotal) * 100);
    const now = Date.now();

    // Byte-sized totals (resumable chunk uploads) can emit thousands of updates.
    // Throttle logs to keep upload throughput high and logs readable.
    if (safeTotal > 1000) {
      const isFinal = safeCurrent >= safeTotal;
      const percentAdvanced = percent - lastPercent;
      const progressed = safeCurrent > lastCurrent;
      const elapsed = now - lastLoggedAt;
      const shouldLog =
        isFinal ||
        (progressed && percentAdvanced >= minPercentDelta) ||
        (progressed && elapsed >= minIntervalMs);
      if (!shouldLog) {
        return;
      }
    }

    lastPercent = percent;
    lastLoggedAt = now;
    lastCurrent = safeCurrent;

    const counter =
      safeTotal > 1000
        ? `${formatCounterValue(safeCurrent)}/${formatCounterValue(safeTotal)}`
        : `${safeCurrent}/${safeTotal}`;
    const bar = buildProgressBar(percent, safeTotal > 1000 ? 24 : 20);

    debugLog('Video progress', {
      ...context,
      stage,
      counter,
      percent,
      bar,
      ...meta,
    });
  };
}
