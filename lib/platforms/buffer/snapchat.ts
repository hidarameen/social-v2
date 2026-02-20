import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'snapchat',
  name: 'Snapchat',
  icon: '👻',
  color: '#FFFC00',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['image', 'video', 'text'],
  maxContentLength: 250,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferSnapchatHandler = new BufferPlatformHandler({
  config,
  network: 'snapchat',
  selectorsEnvKey: 'BUFFER_SNAPCHAT_ACCOUNTS',
});
