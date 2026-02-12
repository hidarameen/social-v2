const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

function normalizePossibleUrl(value: string): string {
  return value.trim().replace(/[)\].,;!?]+$/, '');
}

function collectUrls(value: unknown, urls: string[], seen: Set<string>, depth = 0): void {
  if (depth > 5 || value == null) return;

  if (typeof value === 'string') {
    const normalized = normalizePossibleUrl(value);
    if (!/^https?:\/\//i.test(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 50)) {
      collectUrls(item, urls, seen, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>).slice(0, 50)) {
      collectUrls(item, urls, seen, depth + 1);
    }
  }
}

function isYouTubeVideoUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return false;

    if (parsed.hostname.toLowerCase() === 'youtu.be') {
      return parsed.pathname.length > 1;
    }

    return (
      parsed.pathname.startsWith('/watch') ||
      parsed.pathname.startsWith('/shorts/') ||
      parsed.pathname.startsWith('/live/')
    );
  } catch {
    return false;
  }
}

export function extractYouTubeVideoLinks(responseData: unknown): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  collectUrls(responseData, urls, seen);
  return urls.filter(isYouTubeVideoUrl);
}
