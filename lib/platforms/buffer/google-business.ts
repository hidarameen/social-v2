import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'google_business',
  name: 'Google Business',
  icon: '🗺️',
  color: '#4285F4',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 1500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferGoogleBusinessHandler = new BufferPlatformHandler({
  config,
  network: 'googlebusiness',
  selectorsEnvKey: 'BUFFER_GOOGLE_BUSINESS_ACCOUNTS',
});
