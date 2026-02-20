import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'linkedin',
  name: 'LinkedIn',
  icon: '💼',
  color: '#0A66C2',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 3000,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferLinkedInHandler = new BufferPlatformHandler({
  config,
  network: 'linkedin',
  selectorsEnvKey: 'BUFFER_LINKEDIN_ACCOUNTS',
});
