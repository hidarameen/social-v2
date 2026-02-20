import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'threads',
  name: 'Threads',
  icon: '🧵',
  color: '#101010',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferThreadsHandler = new BufferPlatformHandler({
  config,
  network: 'threads',
  selectorsEnvKey: 'BUFFER_THREADS_ACCOUNTS',
});
