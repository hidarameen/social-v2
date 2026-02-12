'use client';

import Link from 'next/link';
import { Suspense, type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Bell, LogOut, Menu, Search, Upload, UserCircle2, WandSparkles } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function HeaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
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
  const userLabel = session?.user?.name || session?.user?.email || 'Account';
  const userImage = session?.user?.image || '';
  const displayedUserImage = profileImageState || userImage;

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      void signOut({ callbackUrl: `${window.location.origin}/login` });
      return;
    }
    void signOut({ callbackUrl: '/login' });
  };

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
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-border/80 bg-background/78 backdrop-blur-xl lg:left-72">
      <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl lg:hidden"
          onClick={() => setMobileMenuOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="kpi-pill mb-1 hidden w-fit gap-1 sm:inline-flex">
            <WandSparkles size={12} />
            Smart Console
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {activeItem?.label || 'Control Panel'}
          </h2>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {activeItem?.caption || 'Real-time orchestration'}
          </p>
        </div>

        <div className="relative hidden max-w-lg flex-1 xl:block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search tasks, accounts, logs..."
            className="h-10 rounded-xl border-border/70 bg-card/70 pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden h-10 rounded-xl border-border/70 bg-card/60 px-3 text-xs sm:inline-flex"
            onClick={handleLogout}
          >
            <LogOut size={14} />
            Logout
          </Button>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl">
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary animate-pulse-glow" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            title={userLabel}
            aria-label={userLabel}
            onClick={() => setProfileOpen(true)}
          >
            {displayedUserImage ? (
              <img
                src={displayedUserImage}
                alt={userLabel}
                className="h-8 w-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserCircle2 size={20} />
            )}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="animate-fade-up border-t border-border/70 bg-card/95 p-3 shadow-xl lg:hidden">
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-transparent text-foreground hover:bg-muted/65'
                  )}
                >
                  <Icon size={15} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <Button
              variant="outline"
              className="mt-2 h-10 w-full rounded-xl border-border/70 bg-card/60"
              onClick={() => setProfileOpen(true)}
            >
              <UserCircle2 size={14} />
              Profile
            </Button>
          </div>
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg">
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
                    <img
                      src={profilePreviewImage}
                      alt="Profile"
                      className="h-16 w-16 rounded-full border border-border/70 object-cover"
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
    <Suspense fallback={<header className="fixed left-0 right-0 top-0 z-40 h-20 border-b border-border/80 bg-background/78 backdrop-blur-xl lg:left-72" />}>
      <HeaderContent />
    </Suspense>
  );
}
