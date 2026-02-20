import type { PlatformConfig } from '../types';
import { OutstandingPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'threads',
  name: 'Threads',
  icon: '🧵',
  color: '#101010',
  apiUrl: 'https://api.outstand.so/v1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const outstandingThreadsHandler = new OutstandingPlatformHandler({
  config,
  network: 'threads',
  selectorsEnvKey: 'OUTSTAND_THREADS_ACCOUNTS',
});
