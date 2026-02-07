import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type DownloadResult = {
  videoPath: string;
  thumbnailPath?: string;
  duration?: number;
  tempDir: string;
};

function getBinaryPath() {
  const envPath = process.env.YTDLP_PATH;
  if (envPath) return envPath;
  return 'yt-dlp';
}

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function getEnvString(name: string) {
  const raw = process.env[name];
  return raw ? String(raw) : '';
}

function parseJsonLine(stdout: string) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      // ignore
    }
  }
  return null;
}

export async function downloadTweetVideo(tweetUrl: string): Promise<DownloadResult> {
  const outputTemplate = '/tmp/socialflow_ytdlp_%(id)s.%(ext)s';
  const ffmpegPath = process.env.FFMPEG_PATH;
  const concurrentFragments = getEnvNumber('YTDLP_CONCURRENT_FRAGMENTS', 8);
  const retries = getEnvNumber('YTDLP_RETRIES', 3);
  const fragmentRetries = getEnvNumber('YTDLP_FRAGMENT_RETRIES', 3);
  const maxFilesizeMb = getEnvNumber('TELEGRAM_MAX_UPLOAD_MB', 50);
  const externalDownloader = getEnvString('YTDLP_EXTERNAL_DOWNLOADER');
  const externalDownloaderArgs = getEnvString('YTDLP_EXTERNAL_DOWNLOADER_ARGS');
  const proxy = getEnvString('YTDLP_PROXY');
  const cookiesPath = getEnvString('YTDLP_COOKIES_PATH') || '/home/runner/workspace/twitter_cookies.txt';
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--merge-output-format', 'mp4',
    '--format', 'bv*+ba/b',
    '--write-thumbnail',
    '--convert-thumbnails', 'jpg',
    '--print-json',
    '--concurrent-fragments', String(concurrentFragments),
    '--retries', String(retries),
    '--fragment-retries', String(fragmentRetries),
    '--max-filesize', `${maxFilesizeMb}M`,
    '--output', outputTemplate,
    '--postprocessor-args', 'ffmpeg:-movflags +faststart',
    ...(proxy ? ['--proxy', proxy] : []),
    ...(cookiesPath ? ['--cookies', cookiesPath] : []),
    ...(externalDownloader ? ['--external-downloader', externalDownloader] : []),
    ...(externalDownloaderArgs ? ['--external-downloader-args', externalDownloaderArgs] : []),
    ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
    tweetUrl,
  ];

  const { stdout } = await execFileAsync(getBinaryPath(), args, { maxBuffer: 10 * 1024 * 1024 });
  const info = parseJsonLine(stdout);
  if (!info?.id) {
    throw new Error('yt-dlp did not return video info');
  }

  const videoPath = `/tmp/socialflow_${info.id}.mp4`;
  const thumbnailPath = `/tmp/socialflow_${info.id}.jpg`;

  return {
    videoPath,
    thumbnailPath,
    duration: typeof info.duration === 'number' ? info.duration : undefined,
    tempDir: '/tmp',
  };
}
