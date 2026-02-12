'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const SPLASH_SESSION_KEY = 'socialflow_splash_seen_v2';
const SPLASH_SHOW_MS = 1400;
const SPLASH_EXIT_MS = 450;

export function SplashOverlay() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const seen = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
    if (seen) return;

    setVisible(true);
    const exitTimer = window.setTimeout(() => setExiting(true), SPLASH_SHOW_MS);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    }, SPLASH_SHOW_MS + SPLASH_EXIT_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={cn('splash-overlay', exiting && 'splash-overlay--exit')}>
      <div className="splash-overlay__glow" />
      <div className="splash-overlay__panel">
        <div className="splash-overlay__ring" />
        <div className="splash-overlay__logo">
          <Sparkles size={24} />
        </div>
        <h1 className="splash-overlay__title">SocialFlow Orbit</h1>
        <p className="splash-overlay__subtitle">Preparing your automation workspace...</p>
      </div>
    </div>
  );
}

