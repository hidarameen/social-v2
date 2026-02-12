import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import path from 'path';
import { getTelegramApiBaseUrl } from '@/lib/telegram-api';

type EnsureLocalApiResult = {
  ok: boolean;
  started: boolean;
  reason?: string;
};

type ProbeStatus = {
  reachable: boolean;
  isProxy: boolean;
};

let activeBoot: Promise<EnsureLocalApiResult> | null = null;

function parseBaseUrl(baseUrl: string): URL | null {
  try {
    return new URL(getTelegramApiBaseUrl(baseUrl));
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

async function probeTelegramApi(baseUrl: string): Promise<ProbeStatus> {
  const parsed = parseBaseUrl(baseUrl);
  if (!parsed) return { reachable: false, isProxy: false };

  // Any HTTP response means endpoint is reachable; status code is not important here.
  const probeUrl = `${parsed.origin}/`;
  try {
    const response = await fetch(probeUrl, { method: 'GET' });
    if (!response.ok) {
      return { reachable: true, isProxy: false };
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return { reachable: true, isProxy: false };
    }
    const payload = (await response.json().catch(() => null)) as any;
    const isProxy = String(payload?.mode || '').toLowerCase() === 'proxy';
    return { reachable: true, isProxy };
  } catch {
    return { reachable: false, isProxy: false };
  }
}

async function waitForTelegramApi(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const probe = await probeTelegramApi(baseUrl);
    if (probe.reachable) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
}

async function spawnDetachedProcess(
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<void> {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...(env || {}),
    },
  });

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => resolve());
    child.once('error', (error) => reject(error));
  });

  child.unref();
}

async function startNativeTelegramLocalApi(baseUrl: string, parsed: URL): Promise<EnsureLocalApiResult> {
  const apiId = String(process.env.API_ID || process.env.TELEGRAM_API_ID || '').trim();
  const apiHash = String(process.env.API_HASH || process.env.TELEGRAM_API_HASH || '').trim();
  if (!apiId || !apiHash) {
    return {
      ok: false,
      started: false,
      reason: 'Missing API_ID/API_HASH for Telegram Local Bot API auto-start',
    };
  }

  const binary = String(process.env.TELEGRAM_LOCAL_API_BIN || 'telegram-bot-api').trim();
  const port = parsed.port ? Number(parsed.port) : 8081;
  const workDir = String(process.env.TELEGRAM_LOCAL_API_DIR || '/tmp/telegram-bot-api').trim();
  const httpIpAddress = String(process.env.TELEGRAM_LOCAL_API_HTTP_IP_ADDRESS || '').trim();
  const startupTimeoutMs = Math.max(
    1500,
    Number(process.env.TELEGRAM_LOCAL_API_START_TIMEOUT_MS || '12000')
  );

  try {
    await mkdir(workDir, { recursive: true });
    const args = [
      `--api-id=${apiId}`,
      `--api-hash=${apiHash}`,
      '--local',
      `--http-port=${port}`,
      `--dir=${workDir}`,
    ];
    if (httpIpAddress) {
      args.push(`--http-ip-address=${httpIpAddress}`);
    }
    await spawnDetachedProcess(binary, args);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown process start error';
    return { ok: false, started: false, reason: `Native local API start failed: ${reason}` };
  }

  const ready = await waitForTelegramApi(baseUrl, startupTimeoutMs);
  if (!ready) {
    return {
      ok: false,
      started: false,
      reason: `Native local API did not become ready within ${startupTimeoutMs}ms`,
    };
  }
  return { ok: true, started: true };
}

async function startProxyTelegramLocalApi(baseUrl: string, parsed: URL): Promise<EnsureLocalApiResult> {
  const port = parsed.port ? Number(parsed.port) : 8081;
  const host = parsed.hostname;
  const startupTimeoutMs = Math.max(
    1000,
    Number(process.env.TELEGRAM_LOCAL_API_PROXY_START_TIMEOUT_MS || '6000')
  );
  const scriptPath = path.join(process.cwd(), 'scripts', 'telegram-local-api-proxy.js');

  try {
    await spawnDetachedProcess(process.execPath, [scriptPath], {
      TELEGRAM_PROXY_HOST: host,
      TELEGRAM_PROXY_PORT: String(port),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown process start error';
    return { ok: false, started: false, reason: `Proxy local API start failed: ${reason}` };
  }

  const ready = await waitForTelegramApi(baseUrl, startupTimeoutMs);
  if (!ready) {
    return {
      ok: false,
      started: false,
      reason: `Proxy local API did not become ready within ${startupTimeoutMs}ms`,
    };
  }
  return { ok: true, started: true };
}

async function startLocalApiProcess(baseUrl: string): Promise<EnsureLocalApiResult> {
  const parsed = parseBaseUrl(baseUrl);
  if (!parsed) {
    return { ok: false, started: false, reason: 'Invalid TELEGRAM_LOCAL_API_BASE_URL' };
  }
  if (!isLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      started: false,
      reason: `Auto-start supports only localhost addresses (got ${parsed.hostname})`,
    };
  }

  const mode = String(process.env.TELEGRAM_LOCAL_API_MODE || 'auto').trim().toLowerCase();
  const reasons: string[] = [];

  if (mode === 'binary' || mode === 'auto') {
    const nativeResult = await startNativeTelegramLocalApi(baseUrl, parsed);
    if (nativeResult.ok) {
      return nativeResult;
    }
    reasons.push(nativeResult.reason || 'Native local API startup failed');
    if (mode === 'binary') {
      return { ok: false, started: false, reason: reasons.join(' | ') };
    }
  }

  const proxyAllowed =
    String(process.env.TELEGRAM_LOCAL_API_PROXY_FALLBACK || 'true') !== 'false';
  if (mode === 'proxy' || mode === 'auto') {
    if (!proxyAllowed && mode !== 'proxy') {
      reasons.push('Proxy fallback disabled');
    } else {
      const proxyResult = await startProxyTelegramLocalApi(baseUrl, parsed);
      if (proxyResult.ok) {
        return proxyResult;
      }
      reasons.push(proxyResult.reason || 'Proxy local API startup failed');
    }
  }

  return { ok: false, started: false, reason: reasons.join(' | ') || 'Local API startup failed' };
}

export async function ensureTelegramLocalApiServer(baseUrl?: string): Promise<EnsureLocalApiResult> {
  const resolvedBase = getTelegramApiBaseUrl(baseUrl);
  const mode = String(process.env.TELEGRAM_LOCAL_API_MODE || 'auto').trim().toLowerCase();
  const initialProbe = await probeTelegramApi(resolvedBase);
  if (initialProbe.reachable) {
    if (mode === 'binary' && initialProbe.isProxy) {
      // Binary mode forbids cloud-backed proxy for large media support.
    } else {
      return { ok: true, started: false };
    }
  }

  const autoStartEnabled = String(process.env.TELEGRAM_LOCAL_API_AUTOSTART || 'true') !== 'false';
  if (!autoStartEnabled) {
    return {
      ok: false,
      started: false,
      reason: `Local API unreachable at ${resolvedBase} (auto-start disabled)`,
    };
  }

  if (!activeBoot) {
    activeBoot = startLocalApiProcess(resolvedBase);
  }
  const result = await activeBoot;
  if (!result.ok) {
    activeBoot = null;
  }
  return result;
}
