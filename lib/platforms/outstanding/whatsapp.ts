import type { PlatformConfig } from '../types';
import { OutstandingPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'whatsapp',
  name: 'WhatsApp',
  icon: '💬',
  color: '#25D366',
  apiUrl: 'https://api.outstand.so/v1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 4096,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const outstandingWhatsAppHandler = new OutstandingPlatformHandler({
  config,
  network: 'whatsapp',
  selectorsEnvKey: 'OUTSTAND_WHATSAPP_ACCOUNTS',
});
