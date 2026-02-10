'use client';

import React from "react"

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PlatformAccount } from '@/lib/db';
import { platformConfigs } from '@/lib/platforms/handlers';
import { ArrowRight, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateTaskPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourceAccounts: [] as string[],
    targetAccounts: [] as string[],
    executionType: 'immediate' as const,
    scheduleTime: '',
    recurringPattern: 'daily' as const,
    template: '',
    includeMedia: true,
    enableYtDlp: false,
    twitterSourceType: 'account' as 'account' | 'username',
    twitterUsername: '',
    excludeReplies: false,
    excludeRetweets: false,
    excludeQuotes: false,
    originalOnly: false,
    pollIntervalSeconds: 60,
    triggerType: 'on_tweet' as 'on_tweet' | 'on_mention' | 'on_keyword' | 'on_hashtag' | 'on_search' | 'on_retweet' | 'on_like',
    triggerValue: '',
    twitterActions: {
      post: true,
      reply: false,
      quote: false,
      retweet: false,
      like: false,
    },
  });

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedSourcePlatform, setSelectedSourcePlatform] = useState('');
  const [selectedTargetPlatform, setSelectedTargetPlatform] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/accounts`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (!cancelled) setAccounts(data.accounts || []);
      } catch (error) {
        console.error('[v0] CreateTaskPage: Error loading accounts:', error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourcePlatformAccounts = accounts.filter(
    a => a.platformId === selectedSourcePlatform
  );
  const targetPlatformAccounts = accounts.filter(
    a => a.platformId === selectedTargetPlatform
  );
  const selectedSourceTwitter = accounts
    .filter(a => formData.sourceAccounts.includes(a.id))
    .some(a => a.platformId === 'twitter');
  const selectedTargetTwitter = accounts
    .filter(a => formData.targetAccounts.includes(a.id))
    .some(a => a.platformId === 'twitter');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[v0] handleSubmit: Form submitted');
    console.log('[v0] formData:', formData);

    if (isSubmitting) return;

    if (!formData.name || formData.sourceAccounts.length === 0 || formData.targetAccounts.length === 0) {
      console.warn('[v0] handleSubmit: Validation failed - missing required fields');
      alert('Please fill in all required fields');
      return;
    }
    if (formData.twitterSourceType === 'username' && !formData.twitterUsername.trim()) {
      alert('Please enter a Twitter username for the source');
      return;
    }
    if (formData.triggerType === 'on_like' && formData.twitterSourceType === 'username') {
      alert('Liked-tweet trigger requires a connected Twitter account');
      return;
    }
    if (
      (formData.triggerType === 'on_keyword' ||
        formData.triggerType === 'on_hashtag' ||
        formData.triggerType === 'on_search') &&
      !formData.triggerValue.trim()
    ) {
      alert('Please enter a trigger value for the selected trigger type');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          sourceAccounts: formData.sourceAccounts,
          targetAccounts: formData.targetAccounts,
          contentType: 'text',
          status: 'active',
          executionType: formData.executionType,
          scheduleTime: formData.scheduleTime ? new Date(formData.scheduleTime) : undefined,
          recurringPattern: formData.recurringPattern,
          transformations: {
            template: formData.template || undefined,
            includeMedia: formData.includeMedia,
            enableYtDlp: formData.enableYtDlp,
            twitterActions: formData.twitterActions,
          },
          filters: {
            twitterSourceType: formData.twitterSourceType,
            twitterUsername: formData.twitterUsername.trim() || undefined,
            excludeReplies: formData.excludeReplies,
            excludeRetweets: formData.excludeRetweets,
            excludeQuotes: formData.excludeQuotes,
            originalOnly: formData.originalOnly,
            pollIntervalSeconds: formData.pollIntervalSeconds,
            triggerType: formData.triggerType,
            triggerValue: formData.triggerValue.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create task');
      router.push('/tasks');
    } catch (error) {
      console.error('[v0] handleSubmit: Error creating task:', error);
      alert(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSourceAccount = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      sourceAccounts: prev.sourceAccounts.includes(accountId)
        ? prev.sourceAccounts.filter(id => id !== accountId)
        : [...prev.sourceAccounts, accountId],
    }));
  };

  const toggleTargetAccount = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      targetAccounts: prev.targetAccounts.includes(accountId)
        ? prev.targetAccounts.filter(id => id !== accountId)
        : [...prev.targetAccounts, accountId],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main className="ml-64 mt-16 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Create New Task
          </h1>
          <p className="text-muted-foreground">
            Set up an automation task to transfer content between platforms
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Task Name *
                </label>
                <Input
                  placeholder="e.g., Facebook to Twitter Daily Sync"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="Describe what this task does..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Source Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Source Account(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Source Platform
                </label>
                <Select value={selectedSourcePlatform} onValueChange={setSelectedSourcePlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose source platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformConfigs).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSourcePlatform && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Accounts
                  </label>
                  {sourcePlatformAccounts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No accounts connected for this platform
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sourcePlatformAccounts.map(account => (
                        <div key={account.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`source-${account.id}`}
                            checked={formData.sourceAccounts.includes(account.id)}
                            onChange={() => toggleSourceAccount(account.id)}
                            className="rounded border-border"
                          />
                          <label
                            htmlFor={`source-${account.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            <span className="font-medium">{account.accountName}</span>
                            <span className="text-muted-foreground">
                              {' '}(@{account.accountUsername})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Target Account(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Target Platform(s)
                </label>
                <Select value={selectedTargetPlatform} onValueChange={setSelectedTargetPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose target platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformConfigs).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTargetPlatform && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Accounts
                  </label>
                  {targetPlatformAccounts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No accounts connected for this platform
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {targetPlatformAccounts.map(account => (
                        <div key={account.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`target-${account.id}`}
                            checked={formData.targetAccounts.includes(account.id)}
                            onChange={() => toggleTargetAccount(account.id)}
                            className="rounded border-border"
                          />
                          <label
                            htmlFor={`target-${account.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            <span className="font-medium">{account.accountName}</span>
                            <span className="text-muted-foreground">
                              {' '}(@{account.accountUsername})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Execution Type
                </label>
                <Select
                  value={formData.executionType}
                  onValueChange={(value: any) =>
                    setFormData(prev => ({ ...prev, executionType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.executionType === ('scheduled' as string) && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Schedule Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduleTime}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))
                    }
                  />
                </div>
              )}

              {formData.executionType === ('recurring' as string) && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Recurrence Pattern
                  </label>
                  <Select
                    value={formData.recurringPattern}
                    onValueChange={(value: any) =>
                      setFormData(prev => ({ ...prev, recurringPattern: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedSourceTwitter && (
          <Card>
            <CardHeader>
              <CardTitle>Twitter Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Source Type
                  </label>
                  <Select
                    value={formData.twitterSourceType}
                    onValueChange={(value: any) =>
                      setFormData(prev => ({ ...prev, twitterSourceType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account">My connected account</SelectItem>
                      <SelectItem value="username">Another user by username</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Trigger Type
                  </label>
                  <Select
                    value={formData.triggerType}
                    onValueChange={(value: any) =>
                      setFormData(prev => ({ ...prev, triggerType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_tweet">New tweet by source</SelectItem>
                      <SelectItem value="on_retweet">New retweet by source</SelectItem>
                      <SelectItem value="on_like">New liked tweet by source</SelectItem>
                      <SelectItem value="on_mention">New mention of source</SelectItem>
                      <SelectItem value="on_search">New tweet from search</SelectItem>
                      <SelectItem value="on_keyword">New tweet with keyword</SelectItem>
                      <SelectItem value="on_hashtag">New tweet with hashtag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.triggerType === 'on_keyword' ||
                  formData.triggerType === 'on_hashtag' ||
                  formData.triggerType === 'on_search') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Trigger Value
                    </label>
                    <Input
                      placeholder="e.g., #AI, crypto, from:news"
                      value={formData.triggerValue}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, triggerValue: e.target.value }))
                      }
                    />
                  </div>
                )}

                {formData.twitterSourceType === 'username' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Twitter Username
                    </label>
                    <Input
                      placeholder="e.g., jack"
                      value={formData.twitterUsername}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, twitterUsername: e.target.value }))
                      }
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Poll Interval (seconds)
                  </label>
                  <Input
                    type="number"
                    min={10}
                    value={formData.pollIntervalSeconds}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        pollIntervalSeconds: Math.max(10, Number(e.target.value || 10)),
                      }))
                    }
                  />
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Filters
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.originalOnly}
                      disabled={formData.triggerType === 'on_retweet'}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, originalOnly: e.target.checked }))
                      }
                    />
                    Original only (exclude replies/retweets/quotes)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.excludeReplies}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, excludeReplies: e.target.checked }))
                      }
                    />
                    Exclude replies
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.excludeRetweets}
                      disabled={formData.triggerType === 'on_retweet'}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, excludeRetweets: e.target.checked }))
                      }
                    />
                    Exclude retweets
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.excludeQuotes}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, excludeQuotes: e.target.checked }))
                      }
                    />
                    Exclude quote tweets
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTargetTwitter && (
            <Card>
              <CardHeader>
                <CardTitle>Twitter Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.twitterActions.post}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        twitterActions: { ...prev.twitterActions, post: e.target.checked },
                      }))
                    }
                  />
                  Post tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.twitterActions.reply}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        twitterActions: { ...prev.twitterActions, reply: e.target.checked },
                      }))
                    }
                  />
                  Reply to the source tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.twitterActions.quote}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        twitterActions: { ...prev.twitterActions, quote: e.target.checked },
                      }))
                    }
                  />
                  Quote tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.twitterActions.retweet}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        twitterActions: { ...prev.twitterActions, retweet: e.target.checked },
                      }))
                    }
                  />
                  Retweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.twitterActions.like}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        twitterActions: { ...prev.twitterActions, like: e.target.checked },
                      }))
                    }
                  />
                  Like
                </label>
                <p className="text-xs text-muted-foreground">
                  If none are selected, a tweet will be posted by default.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Twitter Template */}
          <Card>
            <CardHeader>
              <CardTitle>Twitter Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message Template
                </label>
                <Textarea
                  placeholder="%name% (@%username%)&#10;%date%&#10;%text%&#10;%link%"
                  value={formData.template}
                  onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Available placeholders: %text%, %username%, %name%, %date%, %link%, %media%
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.includeMedia}
                  onChange={(e) => setFormData(prev => ({ ...prev, includeMedia: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Include images/videos when available</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.enableYtDlp}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableYtDlp: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Download Twitter videos via yt-dlp</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Save size={20} className="mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.push('/tasks')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
