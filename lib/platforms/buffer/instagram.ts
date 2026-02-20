import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'instagram',
  name: 'Instagram',
  icon: '📷',
  color: '#E4405F',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['image', 'video', 'text'],
  maxContentLength: 2200,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferInstagramHandler = new BufferPlatformHandler({
  config,
  network: 'instagram',
  selectorsEnvKey: 'BUFFER_INSTAGRAM_ACCOUNTS',
});
