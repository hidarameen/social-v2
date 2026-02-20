import type { PlatformConfig } from '../types';
import { OutstandingPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'snapchat',
  name: 'Snapchat',
  icon: '👻',
  color: '#FFFC00',
  apiUrl: 'https://api.outstand.so/v1',
  supportedContentTypes: ['image', 'video', 'text'],
  maxContentLength: 250,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const outstandingSnapchatHandler = new OutstandingPlatformHandler({
  config,
  network: 'snapchat',
  selectorsEnvKey: 'OUTSTAND_SNAPCHAT_ACCOUNTS',
});
