import type { PlatformConfig } from '../types';
import { OutstandingPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'google_business',
  name: 'Google Business',
  icon: '🗺️',
  color: '#4285F4',
  apiUrl: 'https://api.outstand.so/v1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 1500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const outstandingGoogleBusinessHandler = new OutstandingPlatformHandler({
  config,
  network: 'google_business',
  selectorsEnvKey: 'OUTSTAND_GOOGLE_BUSINESS_ACCOUNTS',
});
