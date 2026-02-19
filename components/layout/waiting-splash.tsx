'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppLogo } from '@/components/common/app-logo';
import { cn } from '@/lib/utils';

type WaitingSplashProps = {
  active: boolean;
  title?: string;
  subtitle?: string;
  credit?: string;
  className?: string;
  showDelayMs?: number;
};

const MIN_VISIBLE_MS = 520;
const EXIT_MS = 420;

export function WaitingSplash({
  active,
  title = 'Please Wait',
  subtitle = 'Processing your request...',
  credit,
  className,
  showDelayMs = 120,
}: WaitingSplashProps) {
  const showDelay = Math.max(0, showDelayMs);

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const minVisibleTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const shownAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (minVisibleTimerRef.current) {
        window.clearTimeout(minVisibleTimerRef.current);
        minVisibleTimerRef.current = null;
      }
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  const beginExit = useCallback(() => {
    if (!visible || exiting) return;
    setExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
      exitTimerRef.current = null;
    }, EXIT_MS);
  }, [exiting, visible]);

  useEffect(() => {
    if (active) {
      if (minVisibleTimerRef.current) {
        window.clearTimeout(minVisibleTimerRef.current);
        minVisibleTimerRef.current = null;
      }
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      setExiting(false);
      if (visible) return;
      // Avoid flashing overlays for very fast operations.
      showTimerRef.current = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
        showTimerRef.current = null;
      }, showDelay);
      return;
    }

    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible) return;
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    if (remaining === 0) {
      beginExit();
      return;
    }
    minVisibleTimerRef.current = window.setTimeout(() => {
      minVisibleTimerRef.current = null;
      beginExit();
    }, remaining);
  }, [active, beginExit, showDelay, visible]);

  if (!visible) return null;

  const overlay = (
    <div
      className={cn('splash-overlay', exiting ? 'splash-overlay--exit' : '', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="splash-overlay__glow" />
      <div className="splash-overlay__panel">
        <div className="splash-overlay__ring" />
        <div className="splash-overlay__logo">
          <AppLogo size={72} showText={false} variant="splash" splashSurface={false} className="!m-0" />
        </div>
        <h2 className="splash-overlay__title">{title}</h2>
        <p className="splash-overlay__subtitle">{subtitle}</p>
        <div className="splash-overlay__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {credit ? <p className="splash-overlay__credit">{credit}</p> : null}
      </div>
    </div>
  );

  // Avoid a mount delay on client-triggered splashes, but keep SSR safe.
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
