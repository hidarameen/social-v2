const DEFAULT_LOCAL_TELEGRAM_API_BASE_URL = 'http://127.0.0.1:8081';

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = String(raw || '').trim();
  const candidate = trimmed || DEFAULT_LOCAL_TELEGRAM_API_BASE_URL;
  const withScheme = /^[a-z]+:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  return withScheme.replace(/\/+$/, '');
}

export function getTelegramApiBaseUrl(preferred?: string): string {
  const envBase =
    process.env.TELEGRAM_LOCAL_API_BASE_URL ||
    process.env.TELEGRAM_API_BASE_URL;
  return normalizeBaseUrl(preferred || envBase);
}

export function buildTelegramBotMethodUrl(
  botToken: string,
  method: string,
  baseUrl?: string
): string {
  return `${getTelegramApiBaseUrl(baseUrl)}/bot${botToken}/${method}`;
}

export function buildTelegramBotFileUrl(
  botToken: string,
  filePath: string,
  baseUrl?: string
): string {
  const safePath = String(filePath || '').replace(/^\/+/, '');
  return `${getTelegramApiBaseUrl(baseUrl)}/file/bot${botToken}/${safePath}`;
}

export function looksLikeTelegramCloudApi(baseUrl?: string): boolean {
  try {
    const parsed = new URL(getTelegramApiBaseUrl(baseUrl));
    return parsed.hostname.toLowerCase() === 'api.telegram.org';
  } catch {
    return false;
  }
}
