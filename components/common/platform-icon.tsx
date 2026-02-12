import { cn } from '@/lib/utils';
import type { PlatformId } from '@/lib/platforms/types';

const PLATFORM_ICON_META: Record<
  PlatformId,
  { slug: string; color: string; label: string }
> = {
  facebook: { slug: 'facebook', color: '1877F2', label: 'Facebook' },
  instagram: { slug: 'instagram', color: 'E4405F', label: 'Instagram' },
  twitter: { slug: 'x', color: '111111', label: 'X' },
  tiktok: { slug: 'tiktok', color: '000000', label: 'TikTok' },
  youtube: { slug: 'youtube', color: 'FF0000', label: 'YouTube' },
  telegram: { slug: 'telegram', color: '26A5E4', label: 'Telegram' },
  linkedin: { slug: 'linkedin', color: '0A66C2', label: 'LinkedIn' },
};

type PlatformIconProps = {
  platformId: PlatformId;
  size?: number;
  className?: string;
};

export function PlatformIcon({
  platformId,
  size = 18,
  className,
}: PlatformIconProps) {
  const meta = PLATFORM_ICON_META[platformId];
  const src = `https://cdn.simpleicons.org/${meta.slug}/${meta.color}`;

  return (
    <img
      src={src}
      alt={`${meta.label} icon`}
      width={size}
      height={size}
      loading="lazy"
      className={cn('shrink-0', className)}
    />
  );
}
