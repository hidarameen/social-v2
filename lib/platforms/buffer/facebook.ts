import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'facebook',
  name: 'Facebook',
  icon: '📘',
  color: '#1877F2',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 63206,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferFacebookHandler = new BufferPlatformHandler({
  config,
  network: 'facebook',
  selectorsEnvKey: 'BUFFER_FACEBOOK_ACCOUNTS',
});
