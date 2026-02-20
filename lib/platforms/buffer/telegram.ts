import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'telegram',
  name: 'Telegram',
  icon: '✈️',
  color: '#0088cc',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video'],
  maxContentLength: 4096,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferTelegramHandler = new BufferPlatformHandler({
  config,
  network: 'telegram',
  selectorsEnvKey: 'BUFFER_TELEGRAM_ACCOUNTS',
});
