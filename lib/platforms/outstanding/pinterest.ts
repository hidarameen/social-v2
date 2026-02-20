import type { PlatformConfig } from '../types';
import { OutstandingPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'pinterest',
  name: 'Pinterest',
  icon: '📌',
  color: '#BD081C',
  apiUrl: 'https://api.outstand.so/v1',
  supportedContentTypes: ['text', 'image', 'link'],
  maxContentLength: 500,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const outstandingPinterestHandler = new OutstandingPlatformHandler({
  config,
  network: 'pinterest',
  selectorsEnvKey: 'OUTSTAND_PINTEREST_ACCOUNTS',
});
