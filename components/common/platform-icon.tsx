import { cn } from '@/lib/utils';
import type { PlatformId } from '@/lib/platforms/types';
import { siFacebook, siInstagram, siTelegram, siTiktok, siX, siYoutube } from 'simple-icons';

type PlatformMeta = {
  label: string;
  icon?: { path: string; hex: string };
  fallbackBg?: string;
  fallbackText?: string;
};

const PLATFORM_ICON_META: Record<PlatformId, PlatformMeta> = {
  facebook: { icon: siFacebook, label: 'Facebook' },
  instagram: { icon: siInstagram, label: 'Instagram' },
  twitter: { icon: siX, label: 'X' },
  tiktok: { icon: siTiktok, label: 'TikTok' },
  youtube: { icon: siYoutube, label: 'YouTube' },
  telegram: { icon: siTelegram, label: 'Telegram' },
  linkedin: { label: 'LinkedIn', fallbackBg: '#0A66C2', fallbackText: 'in' },
  pinterest: { label: 'Pinterest', fallbackBg: '#BD081C', fallbackText: 'P' },
  google_business: { label: 'Google Business', fallbackBg: '#4285F4', fallbackText: 'G' },
  threads: { label: 'Threads', fallbackBg: '#101010', fallbackText: 'Th' },
  snapchat: { label: 'Snapchat', fallbackBg: '#FACC15', fallbackText: 'S' },
  whatsapp: { label: 'WhatsApp', fallbackBg: '#25D366', fallbackText: 'W' },
};

type PlatformIconProps = {
  platformId: PlatformId;
  size?: number;
  className?: string;
};

export function PlatformIcon({ platformId, size = 18, className }: PlatformIconProps) {
  const meta = PLATFORM_ICON_META[platformId];
  if (!meta) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground',
          className
        )}
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }

  if (!meta.icon) {
    return (
      <span
        role="img"
        aria-label={`${meta.label} icon`}
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] text-xs font-bold uppercase text-white',
          className
        )}
        style={{ width: size, height: size, backgroundColor: meta.fallbackBg || '#64748b' }}
      >
        {meta.fallbackText || meta.label.charAt(0)}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={`${meta.label} icon`}
      className={cn('shrink-0', className)}
      fill={`#${meta.icon.hex}`}
    >
      <path d={meta.icon.path} />
    </svg>
  );
}
