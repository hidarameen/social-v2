'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { Suspense, type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Command,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Upload,
  UserCircle2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getNavItemContent, NAV_ITEMS } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { AppLogo } from '@/components/common/app-logo';
import { useLanguage } from '@/components/i18n/language-provider';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const storageKeyNeedsReset = (key: string) => {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'socialflow_splash_seen_v2') return false;
  if (normalizedKey === 'socialflow_auth_remember_email') return false;
  if (normalizedKey === 'socialflow_auth_remember_enabled') return false;
  if (normalizedKey === 'socialflow_locale_v1') return false;
  if (normalizedKey === 'socialflow_theme_preset_v1') return false;
  if (normalizedKey === 'socialflow_shell_sidebar_collapsed_v1') return false;
  if (normalizedKey === 'socialflow_shell_reduced_motion_v1') return false;
  if (normalizedKey === 'socialflow_shell_density_v1') return false;
  return (
    normalizedKey.startsWith('socialflow_') ||
    normalizedKey.includes('nextauth') ||
    normalizedKey.includes('next-auth') ||
    normalizedKey.includes('authjs')
  );
};

const clearMatchingStorageKeys = (storage: Storage) => {
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !storageKeyNeedsReset(key)) continue;
    keysToRemove.push(key);
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
};

async function clearClientSessionArtifacts() {
  try {
    clearMatchingStorageKeys(window.localStorage);
  } catch {
    // ignore storage failures
  }
  try {
    clearMatchingStorageKeys(window.sessionStorage);
  } catch {
    // ignore storage failures
  }

  if ('caches' in window) {
    try {
      const cacheKeys = await window.caches.keys();
      await Promise.allSettled(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    } catch {
      // ignore cache API failures
    }
  }

  try {
    const indexedDbFactory = window.indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };
    if (typeof indexedDbFactory.databases !== 'function') return;

    const databases = await indexedDbFactory.databases();
    await Promise.allSettled(
      databases.map(({ name }) => {
        if (!name || !storageKeyNeedsReset(name)) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const request = window.indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      })
    );
  } catch {
    // ignore indexedDB failures
  }
}

function HeaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session, update } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const [profileImageState, setProfileImageState] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    profileImageUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const isNavItemActive = (href: string) => {
    const [baseHref, query] = href.split('?');
    const pathMatch =
      baseHref === '/'
        ? pathname === baseHref
        : pathname === baseHref || pathname.startsWith(`${baseHref}/`);
    if (!pathMatch) return false;

    if (!query) {
      if (baseHref === '/tasks' && searchParams.get('create') === '1') return false;
      return true;
    }

    const expected = new URLSearchParams(query);
    for (const [key, value] of expected.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  };

  const activeItem = NAV_ITEMS.find((item) => isNavItemActive(item.href));
  const activeItemContent = activeItem
    ? getNavItemContent(activeItem, locale)
    : {
        label: t('header.controlPanel', 'Control Panel'),
        caption: t('header.orchestration', 'Real-time orchestration'),
      };
  const crumbs = useMemo(() => {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .map((seg) => seg.replace(/-/g, ' '))
      .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1));
    return [t('breadcrumb.workspace', 'Workspace'), ...segments];
  }, [pathname, t]);
  const userImage = session?.user?.image || '';
  const isDarkTheme = themeMounted && resolvedTheme === 'dark';
  const userLabel = session?.user?.name || t('header.profile', 'Profile');

  const handleLogout = useCallback(() => {
    void (async () => {
      await clearClientSessionArtifacts();
      try {
        await fetch('/api/clear-cookies', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        });
      } catch {
        // Continue with redirect even if cookie-clear request fails.
      }
      window.location.replace('/login?forceLogin=1&loggedOut=1');
    })();
  }, []);

  useEffect(() => {
    const onOpenProfile = () => setProfileOpen(true);
    const onRequestLogout = () => handleLogout();

    window.addEventListener('open-profile-settings', onOpenProfile);
    window.addEventListener('request-logout', onRequestLogout);

    return () => {
      window.removeEventListener('open-profile-settings', onOpenProfile);
      window.removeEventListener('request-logout', onRequestLogout);
    };
  }, [handleLogout]);

  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    setProfileForm((prev) => ({
      ...prev,
      name: prev.name || session?.user?.name || '',
      email: session?.user?.email || prev.email || '',
    }));
    if (!profileImageState && session?.user?.image) {
      setProfileImageState(session.user.image);
      setProfileForm((prev) => ({
        ...prev,
        profileImageUrl: prev.profileImageUrl || session.user?.image || '',
      }));
    }
  }, [session?.user?.email, session?.user?.image, session?.user?.name, profileImageState]);

  useEffect(() => {
    if (!profileOpen || profileHydrated) return;

    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        const data = await parseJsonSafe(res);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load profile');
        }
        if (cancelled) return;

        setProfileForm({
          name: data.user?.name || session?.user?.name || '',
          email: data.user?.email || session?.user?.email || '',
          profileImageUrl: data.user?.profileImageUrl || session?.user?.image || '',
        });
        setProfileImageState(data.user?.profileImageUrl || session?.user?.image || '');
        setProfileHydrated(true);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load profile');
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileHydrated, profileOpen, session?.user?.email, session?.user?.image, session?.user?.name]);

  const profilePreviewImage = useMemo(
    () => profileForm.profileImageUrl?.trim() || userImage || '',
    [profileForm.profileImageUrl, userImage]
  );

  const onProfileFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be 5MB or less.');
      return;
    }
    const readAsDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
    const compressDataUrl = (dataUrl: string) =>
      new Promise<string>((resolve) => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 512;
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
      });

    void (async () => {
      try {
        const rawDataUrl = await readAsDataUrl();
        const optimizedDataUrl = await compressDataUrl(rawDataUrl);
        if (optimizedDataUrl.length > 1_900_000) {
          toast.error('Image is still too large after compression.');
          return;
        }
        setProfileForm((prev) => ({
          ...prev,
          profileImageUrl: optimizedDataUrl,
        }));
        setProfileImageState(optimizedDataUrl);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to process image');
      }
    })();
  };

  const handleSaveProfile = async () => {
    const name = profileForm.name.trim();
    if (!name) {
      toast.error('Name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          profileImageUrl: profileForm.profileImageUrl.trim(),
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save profile');

      const nextProfileImage = data.user?.profileImageUrl || '';
      setProfileImageState(nextProfileImage);
      setProfileHydrated(true);

      await update({
        name: data.user?.name || name,
        email: data.user?.email || profileForm.email,
        image: null,
      });

      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill all password fields.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password confirmation does not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to change password');

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('Password changed successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <header className="glass-toolbar fixed left-0 right-0 top-0 z-20 md:[inset-inline-start:var(--shell-sidebar-width)]">
      <div className="flex h-[var(--shell-header-height)] items-center gap-2 px-3 sm:px-5 lg:px-8">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/45"
            aria-label={t('header.goToDashboard', 'Go to dashboard')}
          >
            <AppLogo size={28} showText={false} variant="splash" />
            <div className="hidden leading-none lg:block">
              <p className="text-sm font-semibold tracking-tight text-foreground">SocialFlow</p>
              <p className="mt-0.5 text-sm uppercase tracking-[0.14em] text-muted-foreground">
                {t('header.controlSuite', 'Control Suite')}
              </p>
            </div>
          </Link>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 hidden items-center gap-1 text-sm text-muted-foreground lg:flex">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} />}
                <span>{crumb}</span>
              </span>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {activeItemContent.label}
            </h2>
            <span className="hidden max-w-[26rem] truncate rounded-full border border-border/65 bg-card/72 px-2.5 py-1 text-sm text-muted-foreground lg:inline-flex">
              {activeItemContent.caption}
            </span>
          </div>
        </div>

        <div className="relative hidden max-w-xl flex-1 xl:block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t('header.searchPlaceholder', 'Search tasks, accounts, logs...')}
            className="h-10 rounded-2xl border-border/70 bg-card/75 pl-9 pr-16"
            readOnly
            onFocus={() => {
              window.dispatchEvent(new CustomEvent('open-global-command-palette'));
            }}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-global-command-palette'));
            }}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border border-border/65 bg-card/88 px-2 py-1 text-sm font-medium text-muted-foreground">
            <Command size={11} />
            K
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageToggle minimal compact className="inline-flex lg:hidden" />
          <LanguageToggle minimal compact={false} className="hidden lg:inline-flex" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            title={isDarkTheme ? t('auth.themeLight', 'Light mode') : t('auth.themeDark', 'Dark mode')}
            aria-label={isDarkTheme ? t('auth.themeLight', 'Light mode') : t('auth.themeDark', 'Dark mode')}
            onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
          >
            {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground xl:inline-flex"
            title={t('header.quickSearch', 'Quick Search')}
            aria-label={t('header.quickSearch', 'Quick Search')}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-global-command-palette'));
            }}
          >
            <WandSparkles size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground max-[380px]:hidden"
            title={t('header.notifications', 'Notifications')}
            aria-label={t('header.notifications', 'Notifications')}
          >
            <Bell size={17} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary animate-pulse-glow" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl ring-1 ring-border/65 hover:bg-muted/50"
            title={userLabel}
            aria-label={userLabel}
            onClick={() => setProfileOpen(true)}
          >
            {profilePreviewImage ? (
              <NextImage
                src={profilePreviewImage}
                alt={userLabel}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
                unoptimized
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserCircle2 size={19} />
            )}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed left-0 right-0 top-[var(--shell-header-height)] z-[70] md:hidden">
          <div className="max-h-[calc(100vh-var(--shell-header-height))] overflow-y-auto border-t border-border/65 bg-card/95 px-3 pb-4 pt-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="kpi-pill gap-2">
                <Menu size={14} />
                {t('sidebar.controlCenter', 'Control Center')}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl border-border/70 bg-background/70 text-sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('open-global-command-palette'));
                }}
              >
                <Command size={14} />
                {t('header.quickSearch', 'Quick Search')}
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-border/70 bg-background/70 text-sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileOpen(true);
                }}
              >
                <UserCircle2 size={14} />
                {t('header.profile', 'Profile')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 rounded-xl border-border/70 bg-background/70 text-destructive hover:text-destructive min-[380px]:justify-self-start"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                aria-label={t('header.logout', 'Logout')}
              >
                <LogOut size={15} />
              </Button>
            </div>

            <div className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(item.href);
                const itemContent = getNavItemContent(item, locale);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-all',
                      isActive
                        ? 'border-sidebar-primary/38 bg-sidebar-primary/92 text-sidebar-primary-foreground shadow-lg shadow-primary/22'
                        : 'border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/75'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 rounded-lg p-2 transition-colors',
                        isActive
                          ? 'bg-sidebar-primary-foreground/12'
                          : 'bg-sidebar-accent/30 group-hover:bg-sidebar-accent'
                      )}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{itemContent.label}</p>
                      <p
                        className={cn(
                          'truncate text-sm',
                          isActive
                            ? 'text-sidebar-primary-foreground/85'
                            : 'text-sidebar-foreground/65'
                        )}
                      >
                        {itemContent.caption}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>
              Update your name, profile picture, and password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {profilePreviewImage ? (
                    <NextImage
                      src={profilePreviewImage}
                      alt="Profile"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full border border-border/70 object-cover"
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-card/60">
                      <UserCircle2 size={28} className="text-muted-foreground" />
                    </div>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-sm hover:bg-card/80">
                    <Upload size={14} />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onProfileFileSelected}
                    />
                  </label>
                </div>

                <div>
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Your display name"
                  />
                </div>

                <div>
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    value={profileForm.email}
                    disabled
                    className="opacity-70"
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>

              <div className="border-t border-border/70 pt-5">
                <p className="mb-3 text-sm font-semibold text-foreground">Change Password</p>
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    placeholder="Current password"
                  />
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="New password"
                  />
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Confirm new password"
                  />
                  <Button variant="outline" onClick={handleChangePassword} disabled={savingPassword}>
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/70 pt-4">
                <Button variant="destructive" onClick={handleLogout}>
                  <LogOut size={14} />
                  Logout
                </Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={<header className="glass-toolbar fixed left-0 right-0 top-0 z-20 h-[var(--shell-header-height)] md:[inset-inline-start:var(--shell-sidebar-width)]" />}>
      <HeaderContent />
    </Suspense>
  );
}
