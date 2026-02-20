import type { BasePlatformHandler, PlatformId } from '../types';
import { outstandingFacebookHandler } from './facebook';
import { outstandingInstagramHandler } from './instagram';
import { outstandingTwitterHandler } from './twitter';
import { outstandingTikTokHandler } from './tiktok';
import { outstandingYouTubeHandler } from './youtube';
import { outstandingTelegramHandler } from './telegram';
import { outstandingLinkedInHandler } from './linkedin';
import { outstandingPinterestHandler } from './pinterest';
import { outstandingGoogleBusinessHandler } from './google-business';
import { outstandingThreadsHandler } from './threads';
import { outstandingSnapchatHandler } from './snapchat';
import { outstandingWhatsAppHandler } from './whatsapp';

export const outstandingPlatformHandlers: Record<PlatformId, BasePlatformHandler> = {
  facebook: outstandingFacebookHandler,
  instagram: outstandingInstagramHandler,
  twitter: outstandingTwitterHandler,
  tiktok: outstandingTikTokHandler,
  youtube: outstandingYouTubeHandler,
  telegram: outstandingTelegramHandler,
  linkedin: outstandingLinkedInHandler,
  pinterest: outstandingPinterestHandler,
  google_business: outstandingGoogleBusinessHandler,
  threads: outstandingThreadsHandler,
  snapchat: outstandingSnapchatHandler,
  whatsapp: outstandingWhatsAppHandler,
};
