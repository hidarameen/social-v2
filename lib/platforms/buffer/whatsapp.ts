import type { PlatformConfig } from '../types';
import { BufferPlatformHandler } from './base-handler';

const config: PlatformConfig = {
  id: 'whatsapp',
  name: 'WhatsApp',
  icon: '💬',
  color: '#25D366',
  apiUrl: 'https://api.bufferapp.com/1',
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 4096,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

export const bufferWhatsAppHandler = new BufferPlatformHandler({
  config,
  network: 'whatsapp',
  selectorsEnvKey: 'BUFFER_WHATSAPP_ACCOUNTS',
});
