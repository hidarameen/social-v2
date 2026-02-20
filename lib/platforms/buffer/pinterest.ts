import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'pinterest',
  name: 'Pinterest',
  icon: '📌',
  color: '#BD081C',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'link'],
  maxContentLength: 500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferPinterestHandler = new BufferPlatformHandler({
  config,
  network: 'pinterest',
  selectorsEnvKey: 'BUFFER_PINTEREST_ACCOUNTS',
});
