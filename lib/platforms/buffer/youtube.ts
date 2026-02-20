import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'youtube',
  name: 'YouTube',
  icon: '📹',
  color: '#FF0000',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['video', 'text'],
  maxContentLength: 5000,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferYouTubeHandler = new BufferPlatformHandler({
  config,
  network: 'youtube',
  selectorsEnvKey: 'BUFFER_YOUTUBE_ACCOUNTS',
});
