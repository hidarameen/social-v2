import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'tiktok',
  name: 'TikTok',
  icon: '🎵',
  color: '#000000',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['video', 'text'],
  maxContentLength: 5000,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferTikTokHandler = new BufferPlatformHandler({
  config,
  network: 'tiktok',
  selectorsEnvKey: 'BUFFER_TIKTOK_ACCOUNTS',
});
