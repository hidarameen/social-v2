'use client';

import React from "react"

import { useState, useEffect } from 'react';
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
import { platformConfigs } from '@/lib/platforms/handlers';
import { type PlatformId } from '@/lib/platforms/types';
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | ''>('');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'manual'>('oauth');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'platformId' | 'isActive' | 'accountName'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;
  const [formData, setFormData] = useState({
    accountName: '',
    accountUsername: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
    pageId: '',
    chatId: '', // For Telegram
    channelId: '', // For YouTube
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/accounts?limit=${pageSize}&offset=0&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (!cancelled) {
          setAccounts(data.accounts || []);
          setOffset(data.nextOffset || 0);
          setHasMore(Boolean(data.hasMore));
        }
      } catch (error) {
        console.error('[v0] AccountsPage: Error loading accounts:', error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, sortBy, sortDir]);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlatform) {
      alert('Please select a platform');
      return;
    }

    if (authMethod === 'oauth') {
      if (selectedPlatform === 'telegram' || selectedPlatform === 'linkedin') {
        alert('OAuth is not available for this platform. Please use manual setup.');
        return;
      }
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/api/oauth/${selectedPlatform}/start?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    if (authMethod === 'manual' && selectedPlatform !== 'telegram' && !formData.accountName) {
      alert('Please fill in all required fields');
      return;
    }

    if (authMethod === 'manual' && selectedPlatform === 'telegram') {
      if (!formData.accessToken) {
        alert('Please enter the Telegram bot token');
        return;
      }
      if (!formData.chatId) {
        alert('Please enter the Telegram channel/chat ID');
        return;
      }
    }

    if (authMethod === 'manual' && !formData.accessToken && selectedPlatform !== 'telegram' && selectedPlatform !== 'twitter') {
      alert('Please enter the access token');
      return;
    }

    const credentials: any = {};
    if (authMethod === 'manual') {
      credentials.accessToken = formData.accessToken;
      credentials.apiKey = formData.apiKey;
      credentials.apiSecret = formData.apiSecret;
      credentials.pageId = formData.pageId;
      credentials.chatId = formData.chatId;
      credentials.channelId = formData.channelId;
    }

    const payload: any = {
      platformId: selectedPlatform,
      accountName: formData.accountName,
      accountUsername: formData.accountUsername,
      accountId: formData.accountUsername || `${selectedPlatform}_${Date.now()}`,
      accessToken: authMethod === 'manual' ? formData.accessToken : `oauth_${Date.now()}`,
      credentials,
      isActive: true,
    };

    if (selectedPlatform === 'telegram') {
      delete payload.accountName;
      delete payload.accountUsername;
      delete payload.accountId;
    }

    fetch(`/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to create account');
        setFormData({
          accountName: '',
          accountUsername: '',
          accessToken: '',
          apiKey: '',
          apiSecret: '',
          pageId: '',
          chatId: '',
          channelId: '',
        });
        setSelectedPlatform('');
        setAuthMethod('oauth');
        setOpen(false);
        setAccounts(prev => [data.account, ...prev]);
      })
      .catch(error => alert(error instanceof Error ? error.message : 'Failed to create account'));
  };

  const handleDeleteAccount = (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      fetch(`/api/accounts/${accountId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (!data.success) throw new Error(data.error || 'Failed to delete account');
          setAccounts(accounts.filter(a => a.id !== accountId));
        })
        .catch(error => alert(error instanceof Error ? error.message : 'Failed to delete account'));
    }
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
      })
      .catch(error => alert(error instanceof Error ? error.message : 'Failed to update account'));
  };

  const handleLoadMore = async () => {
    try {
      const res = await fetch(
        `/api/accounts?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
      const next = [...accounts, ...(data.accounts || [])];
      setAccounts(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] AccountsPage: Error loading more accounts:', error);
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main className="ml-64 mt-16 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Connected Accounts
            </h1>
            <p className="text-muted-foreground">
              Manage your social media platform connections
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={20} className="mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Account</DialogTitle>
                <DialogDescription>
                  Connect a new social media account to your SocialFlow workspace
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Authentication Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Platform *
                  </label>
                  <Select
                    value={selectedPlatform}
                    onValueChange={(value: any) => setSelectedPlatform(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(platformAccountsMap).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {authMethod === 'manual' && selectedPlatform !== 'telegram' && (
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

                {authMethod === 'manual' && (
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
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Telegram Bot Token *
                          </label>
                          <Input
                            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                            type="password"
                            value={formData.accessToken}
                            onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Channel / Chat ID *
                          </label>
                          <Input
                            placeholder="-1001234567890"
                            value={formData.chatId}
                            onChange={(e) => setFormData(prev => ({ ...prev, chatId: e.target.value }))}
                          />
                        </div>
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

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {authMethod === 'oauth' ? 'Connect with OAuth' : 'Add Account'}
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
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
        </div>

        {accounts.length === 0 ? (
          <Card>
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
              return (
                <div key={platformId}>
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    {config.icon} {config.name}
                  </h2>

                  <div className="grid grid-cols-1 gap-4">
                    {platformAccounts.map(account => (
                      <Card
                        key={account.id}
                        className={account.isActive ? '' : 'opacity-50'}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-foreground">
                                  {account.accountName}
                                </h3>
                                {account.isActive ? (
                                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircle size={16} />
                                    <span className="text-xs font-semibold">
                                      Connected
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <AlertCircle size={16} />
                                    <span className="text-xs font-semibold">
                                      Disconnected
                                    </span>
                                  </div>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground">
                                @{account.accountUsername || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Added {new Date(account.createdAt).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(account)}
                              >
                                {account.isActive ? 'Disconnect' : 'Reconnect'}
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteAccount(account.id)}
                                className="text-destructive"
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
            <Button variant="outline" onClick={handleLoadMore}>
              Load More
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
