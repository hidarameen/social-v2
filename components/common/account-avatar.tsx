'use client';

import { useMemo, useState } from 'react';
import { Bot, UserCircle2 } from 'lucide-react';
import type { PlatformId } from '@/lib/platforms/types';
import { PlatformIcon } from '@/components/common/platform-icon';

type AccountAvatarProps = {
  platformId: PlatformId;
  profileImageUrl?: string;
  isBot?: boolean;
  label?: string;
  size?: number;
};

export function AccountAvatar({
  platformId,
  profileImageUrl,
  isBot = false,
  label = 'Account',
  size = 48,
}: AccountAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const cleanUrl = useMemo(() => {
    const value = (profileImageUrl || '').trim();
    return value.length > 0 ? value : undefined;
  }, [profileImageUrl]);

  const showImage = Boolean(cleanUrl) && !imageError;
  const fallbackIconSize = Math.max(16, Math.floor(size * 0.46));
  const platformBadgeSize = Math.max(14, Math.floor(size * 0.34));

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card/60"
      style={{ width: size, height: size }}
      title={label}
      aria-label={label}
    >
      {showImage ? (
        <img
          src={cleanUrl}
          alt={label}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          {platformId === 'telegram' && isBot ? (
            <Bot size={fallbackIconSize} />
          ) : (
            <UserCircle2 size={fallbackIconSize} />
          )}
        </div>
      )}

      <div
        className="absolute bottom-0.5 right-0.5 flex items-center justify-center rounded-full border border-background bg-background/90 shadow-sm"
        style={{ width: platformBadgeSize, height: platformBadgeSize }}
      >
        <PlatformIcon platformId={platformId} size={Math.max(10, Math.floor(platformBadgeSize * 0.66))} />
      </div>
    </div>
  );
}

