import type { BasePlatformHandler, PlatformId } from '../types';
import { bufferFacebookHandler } from './facebook';
import { bufferInstagramHandler } from './instagram';
import { bufferTwitterHandler } from './twitter';
import { bufferTikTokHandler } from './tiktok';
import { bufferYouTubeHandler } from './youtube';
import { bufferTelegramHandler } from './telegram';
import { bufferLinkedInHandler } from './linkedin';
import { bufferPinterestHandler } from './pinterest';
import { bufferGoogleBusinessHandler } from './google-business';
import { bufferThreadsHandler } from './threads';
import { bufferSnapchatHandler } from './snapchat';
import { bufferWhatsAppHandler } from './whatsapp';

export const bufferPlatformHandlers: Record<PlatformId, BasePlatformHandler> = {
  facebook: bufferFacebookHandler,
  instagram: bufferInstagramHandler,
  twitter: bufferTwitterHandler,
  tiktok: bufferTikTokHandler,
  youtube: bufferYouTubeHandler,
  telegram: bufferTelegramHandler,
  linkedin: bufferLinkedInHandler,
  pinterest: bufferPinterestHandler,
  google_business: bufferGoogleBusinessHandler,
  threads: bufferThreadsHandler,
  snapchat: bufferSnapchatHandler,
  whatsapp: bufferWhatsAppHandler,
};
