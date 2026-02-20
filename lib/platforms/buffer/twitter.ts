import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'twitter',
  name: 'Twitter / X',
  icon: '𝕏',
  color: '#000000',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 280,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferTwitterHandler = new BufferPlatformHandler({
  config,
  network: 'twitter',
  selectorsEnvKey: 'BUFFER_TWITTER_ACCOUNTS',
});
