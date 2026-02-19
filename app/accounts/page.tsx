'use client';

import React from "react"

import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlatformAccount } from '@/lib/db';
import { platformConfigs } from '@/lib/platforms/configs';
import { type PlatformId } from '@/lib/platforms/types';
import { PlatformIcon } from '@/components/common/platform-icon';
import { AccountAvatar } from '@/components/common/account-avatar';
import { Plus, Trash2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/common/use-confirm-dialog';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { getCachedQuery, setCachedQuery } from '@/lib/client/query-cache';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

type CountryDialOption = {
  iso2: CountryCode;
  dialCode: string;
  name: string;
  flag: string;
};

function countryFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function buildCountryDialOptions(): CountryDialOption[] {
  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new (Intl as any).DisplayNames(['en'], { type: 'region' })
      : null;
  return getCountries()
    .map((iso2) => ({
      iso2,
      dialCode: getCountryCallingCode(iso2),
      name: displayNames?.of(iso2) || iso2,
      flag: countryFlagEmoji(iso2),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function AccountsPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | ''>('');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'manual'>('oauth');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'platformId' | 'isActive' | 'accountName'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 50;
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [formData, setFormData] = useState({
    accountName: '',
    accountUsername: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
    pageId: '',
    channelId: '', // For YouTube
    phoneCountry: 'US' as CountryCode,
    phoneNumber: '',
    phoneCode: '',
    twoFactorPassword: '',
  });
  const [telegramAuthId, setTelegramAuthId] = useState('');
  const [telegramNeedsPassword, setTelegramNeedsPassword] = useState(false);
  const [telegramPasswordHint, setTelegramPasswordHint] = useState('');
  const [isTelegramAuthLoading, setIsTelegramAuthLoading] = useState(false);
  const telegramDirectFlow = selectedPlatform === 'telegram';
  const countryDialOptions = useMemo(buildCountryDialOptions, []);
  const selectedDialOption = useMemo(
    () =>
      countryDialOptions.find((option) => option.iso2 === formData.phoneCountry) ||
      countryDialOptions[0] ||
      null,
    [countryDialOptions, formData.phoneCountry]
  );

  const getTelegramPhoneNumber = () => {
    const digits = formData.phoneNumber.replace(/\D/g, '');
    if (!digits) return '';
    if (!selectedDialOption) return `+${digits}`;
    return `+${selectedDialOption.dialCode}${digits}`;
  };

  const resetTelegramAuthState = () => {
    setTelegramAuthId('');
    setTelegramNeedsPassword(false);
    setTelegramPasswordHint('');
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = `accounts:list:${pageSize}:0:${debouncedSearchTerm}:${statusFilter}:${sortBy}:${sortDir}`;
    const cached = getCachedQuery<{
      accounts: PlatformAccount[];
      nextOffset: number;
      hasMore: boolean;
    }>(cacheKey, 20_000);

    if (cached) {
      setAccounts(cached.accounts);
      setOffset(cached.nextOffset);
      setHasMore(cached.hasMore);
      setIsLoadingAccounts(false);
    } else {
      setIsLoadingAccounts(true);
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/accounts?limit=${pageSize}&offset=0&search=${encodeURIComponent(debouncedSearchTerm)}${statusFilter === 'all' ? '' : `&isActive=${statusFilter === 'active' ? 'true' : 'false'}`}&sortBy=${sortBy}&sortDir=${sortDir}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (!cancelled) {
          const list = data.accounts || [];
          const nextOffset = data.nextOffset || 0;
          const nextHasMore = Boolean(data.hasMore);
          setAccounts(list);
          setOffset(nextOffset);
          setHasMore(nextHasMore);
          setCachedQuery(cacheKey, {
            accounts: list,
            nextOffset,
            hasMore: nextHasMore,
          });
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[v0] AccountsPage: Error loading accounts:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingAccounts(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pageSize, debouncedSearchTerm, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    if (selectedPlatform === 'telegram') {
      setAuthMethod('manual');
      return;
    }
    if (authMethod !== 'manual') {
      resetTelegramAuthState();
    }
  }, [selectedPlatform, authMethod]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAuthMethod: 'oauth' | 'manual' = telegramDirectFlow ? 'manual' : authMethod;

    if (!selectedPlatform) {
      toast.error('Please select a platform');
      return;
    }

    if (effectiveAuthMethod === 'oauth') {
      if (selectedPlatform === 'telegram' || selectedPlatform === 'linkedin') {
        toast.error('OAuth is not available for this platform. Please use manual setup.');
        return;
      }
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/api/oauth/${selectedPlatform}/start?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    if (effectiveAuthMethod === 'manual' && selectedPlatform !== 'telegram' && !formData.accountName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (effectiveAuthMethod === 'manual' && selectedPlatform === 'telegram') {
      const phoneNumber = getTelegramPhoneNumber();
      if (!phoneNumber) {
        toast.error('Please enter your phone number');
        return;
      }
      if (!telegramAuthId) {
        try {
          setIsTelegramAuthLoading(true);
          const res = await fetch('/api/telegram/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'start',
              phoneNumber,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send Telegram code');
          setTelegramAuthId(String(data.authId || ''));
          setTelegramNeedsPassword(false);
          setTelegramPasswordHint('');
          setFormData((prev) => ({ ...prev, phoneCode: '', twoFactorPassword: '' }));
          toast.success('Verification code sent. Enter the code to continue.');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to send Telegram code');
        } finally {
          setIsTelegramAuthLoading(false);
        }
        return;
      }

      if (telegramNeedsPassword) {
        if (!formData.twoFactorPassword.trim()) {
          toast.error('Please enter your Telegram 2FA password');
          return;
        }
      } else if (!formData.phoneCode.trim()) {
        toast.error('Please enter the verification code');
        return;
      }
    }

    if (effectiveAuthMethod === 'manual' && !formData.accessToken && selectedPlatform !== 'telegram') {
      toast.error('Please enter the access token');
      return;
    }

    try {
      const credentials: any = {};
      if (effectiveAuthMethod === 'manual') {
        credentials.accessToken = formData.accessToken;
        credentials.apiKey = formData.apiKey;
        credentials.apiSecret = formData.apiSecret;
        credentials.pageId = formData.pageId;
        credentials.channelId = formData.channelId;
      }

      const payload: any = {
        platformId: selectedPlatform,
        accountName: formData.accountName,
        accountUsername: formData.accountUsername,
        accountId: formData.accountUsername || `${selectedPlatform}_${Date.now()}`,
        accessToken: effectiveAuthMethod === 'manual' ? formData.accessToken : `oauth_${Date.now()}`,
        credentials,
        isActive: true,
      };

      if (effectiveAuthMethod === 'manual' && selectedPlatform === 'telegram') {
        setIsTelegramAuthLoading(true);
        const verifyRes = await fetch('/api/telegram/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            authId: telegramAuthId,
            phoneCode: formData.phoneCode.trim() || undefined,
            password: formData.twoFactorPassword || undefined,
          }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || 'Telegram verification failed');
        }
        if (verifyData.requiresPassword || verifyData.step === 'password_required') {
          setTelegramNeedsPassword(true);
          setTelegramPasswordHint(String(verifyData.hint || '').trim());
          toast.error('2FA password required. Enter your Telegram cloud password.');
          return;
        }

        const profile = verifyData.profile;
        if (!profile?.sessionString) {
          throw new Error('Telegram session was not created');
        }

        payload.accountName = profile.accountName;
        payload.accountUsername = profile.accountUsername;
        payload.accountId = profile.accountId;
        payload.accessToken = profile.sessionString;
        payload.credentials = {
          ...payload.credentials,
          authType: 'user_session',
          sessionString: profile.sessionString,
          phoneNumber: profile.phoneNumber || getTelegramPhoneNumber(),
          accountInfo: {
            id: profile.accountId,
            username: profile.accountUsername,
            name: profile.accountName,
            isBot: false,
            phoneNumber: profile.phoneNumber || getTelegramPhoneNumber(),
          },
        };
      }

      const res = await fetch(`/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create account');

      setFormData({
        accountName: '',
        accountUsername: '',
        accessToken: '',
        apiKey: '',
        apiSecret: '',
        pageId: '',
        channelId: '',
        phoneCountry: 'US',
        phoneNumber: '',
        phoneCode: '',
        twoFactorPassword: '',
      });
      resetTelegramAuthState();
      setSelectedPlatform('');
      setAuthMethod('oauth');
      setOpen(false);
      setAccounts(prev => [data.account, ...prev]);
      toast.success('Account added successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setIsTelegramAuthLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const accepted = await confirm({
      title: 'Delete Account?',
      description: 'This account connection will be removed from your workspace.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!accepted) return;

    fetch(`/api/accounts/${accountId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to delete account');
        setAccounts(accounts.filter(a => a.id !== accountId));
        toast.success('Account deleted successfully');
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to delete account'));
  };

  const handleToggleStatus = (account: PlatformAccount) => {
    fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !account.isActive }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to update account');
        setAccounts(
          accounts.map(a =>
            a.id === account.id ? { ...a, isActive: !a.isActive } : a
          )
        );
        toast.success(!account.isActive ? 'Account activated' : 'Account deactivated');
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to update account'));
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const res = await fetch(
        `/api/accounts?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearchTerm)}${statusFilter === 'all' ? '' : `&isActive=${statusFilter === 'active' ? 'true' : 'false'}`}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
      const next = [...accounts, ...(data.accounts || [])];
      setAccounts(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] AccountsPage: Error loading more accounts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const platformAccountsMap = platformConfigs;
  const accountsByPlatform = Object.entries(platformAccountsMap).reduce(
    (acc, [platformId]) => {
      acc[platformId] = accounts.filter(a => a.platformId === platformId);
      return acc;
    },
    {} as Record<string, PlatformAccount[]>
  );
  const isInitialLoading = isLoadingAccounts && accounts.length === 0;
  const totalConnected = accounts.length;
  const activeConnected = accounts.filter((account) => account.isActive).length;
  const connectedPlatforms = new Set(accounts.map((account) => account.platformId)).size;
  const effectiveAuthMethod: 'oauth' | 'manual' = telegramDirectFlow ? 'manual' : authMethod;

  const handleResendTelegramCode = async () => {
    const phoneNumber = getTelegramPhoneNumber();
    if (!phoneNumber) {
      toast.error('Enter your phone number first.');
      return;
    }
    try {
      setIsTelegramAuthLoading(true);
      const res = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          phoneNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to resend Telegram code');
      setTelegramAuthId(String(data.authId || ''));
      setFormData((prev) => ({ ...prev, phoneCode: '', twoFactorPassword: '' }));
      setTelegramNeedsPassword(false);
      setTelegramPasswordHint('');
      toast.success('Verification code resent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend Telegram code');
    } finally {
      setIsTelegramAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Identity Layer
            </p>
            <h1 className="page-title">
              Connected Accounts
            </h1>
            <p className="page-subtitle">
              Manage account connections, auth status, and platform access
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {isInitialLoading ? (
                <>
                  <span className="kpi-pill">Loading total...</span>
                  <span className="kpi-pill">Loading active...</span>
                  <span className="kpi-pill">Loading platforms...</span>
                </>
              ) : (
                <>
                  <span className="kpi-pill">{totalConnected} total</span>
                  <span className="kpi-pill">{activeConnected} active</span>
                  <span className="kpi-pill">{connectedPlatforms} platforms</span>
                </>
              )}
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus size={20} className="mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Account</DialogTitle>
                <DialogDescription>
                  Connect a new social media account to your SocialFlow workspace
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddAccount} className="space-y-4">
                {!telegramDirectFlow && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Authentication Method
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('oauth')}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          authMethod === 'oauth'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80'
                        }`}
                      >
                        <div className="font-semibold text-sm">OAuth</div>
                        <div className="text-xs text-muted-foreground">Secure, one-click login</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('manual')}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          authMethod === 'manual'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80'
                        }`}
                      >
                        <div className="font-semibold text-sm">Manual</div>
                        <div className="text-xs text-muted-foreground">API keys/tokens</div>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Platform *
                  </label>
                  <Select
                    value={selectedPlatform}
                    onValueChange={(value: any) => {
                      setSelectedPlatform(value);
                      if (value === 'telegram') {
                        setAuthMethod('manual');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(platformAccountsMap).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <span className="inline-flex items-center gap-2">
                            <PlatformIcon platformId={key as PlatformId} size={16} />
                            <span>{config.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {effectiveAuthMethod === 'manual' && selectedPlatform !== 'telegram' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Account Display Name *
                      </label>
                      <Input
                        placeholder="e.g., My Business Page"
                        value={formData.accountName}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            accountName: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Account Username
                      </label>
                      <Input
                        placeholder="e.g., @myusername"
                        value={formData.accountUsername}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            accountUsername: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                )}

                {effectiveAuthMethod === 'manual' && (
                  <div className="space-y-4">
                    {selectedPlatform === 'facebook' && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Page ID *
                        </label>
                        <Input
                          placeholder="Enter your Facebook Page ID"
                          value={formData.pageId}
                          onChange={(e) => setFormData(prev => ({ ...prev, pageId: e.target.value }))}
                        />
                      </div>
                    )}

                    {selectedPlatform === 'telegram' && (
                      <>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                          Telegram uses a direct sign-in flow in one place:
                          phone number, verification code, and 2FA password if enabled.
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Phone Number *
                          </label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,240px)_1fr]">
                            <Select
                              value={formData.phoneCountry}
                              onValueChange={(value: CountryCode) =>
                                setFormData((prev) => ({ ...prev, phoneCountry: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Country code" />
                              </SelectTrigger>
                              <SelectContent>
                                {countryDialOptions.map((option) => (
                                  <SelectItem key={option.iso2} value={option.iso2}>
                                    <span className="inline-flex items-center gap-2">
                                      <span>{option.flag}</span>
                                      <span>{option.iso2}</span>
                                      <span className="text-muted-foreground">+{option.dialCode}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Local phone number"
                              value={formData.phoneNumber}
                              onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            />
                          </div>
                          {selectedDialOption ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Selected: {selectedDialOption.flag} {selectedDialOption.name} ({selectedDialOption.iso2}) +{selectedDialOption.dialCode}
                            </p>
                          ) : null}
                        </div>
                        {telegramAuthId && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Verification Code *
                              </label>
                              <Input
                                placeholder="12345"
                                value={formData.phoneCode}
                                onChange={(e) => setFormData(prev => ({ ...prev, phoneCode: e.target.value }))}
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleResendTelegramCode}
                                disabled={isTelegramAuthLoading}
                              >
                                Resend Code
                              </Button>
                            </div>
                          </>
                        )}
                        {telegramNeedsPassword && (
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              2FA Password *
                            </label>
                            <Input
                              type="password"
                              placeholder={telegramPasswordHint ? `Hint: ${telegramPasswordHint}` : 'Telegram cloud password'}
                              value={formData.twoFactorPassword}
                              onChange={(e) => setFormData(prev => ({ ...prev, twoFactorPassword: e.target.value }))}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedPlatform === 'twitter' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            API Key *
                          </label>
                          <Input
                            placeholder="Twitter API Key"
                            value={formData.apiKey}
                            onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            API Secret *
                          </label>
                          <Input
                            type="password"
                            placeholder="Twitter API Secret"
                            value={formData.apiSecret}
                            onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
                          />
                        </div>
                      </>
                    )}


                    {selectedPlatform === 'youtube' && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Channel ID *
                        </label>
                        <Input
                          placeholder="Your YouTube Channel ID"
                          value={formData.channelId}
                          onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
                        />
                      </div>
                    )}

                    {selectedPlatform !== 'telegram' && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Access Token *
                        </label>
                        <Input
                          type="password"
                          placeholder="Paste your access token here"
                          value={formData.accessToken}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              accessToken: e.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Your credentials are encrypted and stored securely
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                  <Button type="submit" className="flex-1" disabled={isTelegramAuthLoading}>
                    {effectiveAuthMethod === 'oauth'
                      ? 'Connect with OAuth'
                      : effectiveAuthMethod === 'manual' && selectedPlatform === 'telegram'
                      ? !telegramAuthId
                        ? 'Sign In'
                        : telegramNeedsPassword
                        ? 'Confirm Password'
                        : 'Confirm Code'
                      : 'Add Account'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card className="mb-6 animate-fade-up sticky-toolbar surface-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value: string) => {
                  const [by, dir] = value.split(':') as any;
                  setSortBy(by);
                  setSortDir(dir);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Date (Newest)</SelectItem>
                  <SelectItem value="createdAt:asc">Date (Oldest)</SelectItem>
                  <SelectItem value="platformId:asc">Platform (A→Z)</SelectItem>
                  <SelectItem value="platformId:desc">Platform (Z→A)</SelectItem>
                  <SelectItem value="accountName:asc">Name (A→Z)</SelectItem>
                  <SelectItem value="accountName:desc">Name (Z→A)</SelectItem>
                  <SelectItem value="isActive:desc">Active First</SelectItem>
                  <SelectItem value="isActive:asc">Inactive First</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/55 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Visible</span>
                <span className="font-semibold text-foreground">
                  {accounts.length} / {totalConnected}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(searchTerm || statusFilter !== 'all') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isInitialLoading ? (
          <div className="space-y-4 animate-fade-up-delay">
            {[0, 1, 2].map((idx) => (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 w-56 rounded bg-muted/60" />
                    <div className="h-4 w-48 rounded bg-muted/45" />
                    <div className="h-4 w-32 rounded bg-muted/35" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card className="animate-fade-up-delay">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No accounts connected yet. Add your first account to get started.
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus size={18} className="mr-2" />
                Connect First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(accountsByPlatform).map(([platformId, platformAccounts]) => {
              if (platformAccounts.length === 0) return null;

              const config = platformConfigs[platformId as PlatformId];
              const platformActiveCount = platformAccounts.filter((account) => account.isActive).length;
              return (
                <div key={platformId}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                      <PlatformIcon platformId={platformId as PlatformId} size={20} />
                      <span>{config.name}</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="kpi-pill">{platformAccounts.length} accounts</span>
                      <span className="kpi-pill">{platformActiveCount} active</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {platformAccounts.map(account => (
                      <Card
                        key={account.id}
                        className={`surface-card h-full ${account.isActive ? '' : 'opacity-65'} hover:border-primary/30`}
                      >
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <AccountAvatar
                                platformId={account.platformId as PlatformId}
                                profileImageUrl={
                                  (account.credentials as any)?.profileImageUrl ||
                                  (account.credentials as any)?.accountInfo?.profileImageUrl ||
                                  (account.credentials as any)?.accountInfo?.avatarUrl
                                }
                                isBot={
                                  account.platformId === 'telegram' &&
                                  Boolean(
                                    (account.credentials as any)?.isBot ??
                                    (account.credentials as any)?.accountInfo?.isBot ??
                                    false
                                  )
                                }
                                label={account.accountName || account.accountUsername || config.name}
                                size={52}
                              />

                              <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold text-foreground">
                                  {account.accountName}
                                </h3>
                                {account.isActive ? (
                                  <span className="status-pill status-pill--success inline-flex items-center gap-1">
                                    <CheckCircle size={14} />
                                    Connected
                                  </span>
                                ) : (
                                  <span className="status-pill status-pill--neutral inline-flex items-center gap-1">
                                    <AlertCircle size={14} />
                                    Disconnected
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground">
                                @{account.accountUsername || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Added {new Date(account.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(account)}
                              >
                                {account.isActive ? 'Disconnect' : 'Connect'}
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteAccount(account.id)}
                                className="text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </main>
      {ConfirmDialog}
    </div>
  );
}
