'use client'

import React from "react"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { PlatformAccount } from '@/lib/db'
import { ArrowRight, Plus } from 'lucide-react'
import { toast } from 'sonner'

const platforms = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'twitter', name: 'Twitter' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'linkedin', name: 'LinkedIn' },
] as const

export default function CreateTaskPage() {
  const [taskName, setTaskName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceAccounts, setSourceAccounts] = useState<string[]>([])
  const [targetAccounts, setTargetAccounts] = useState<string[]>([])
  const [frequency, setFrequency] = useState('daily')
  const [scheduleTime, setScheduleTime] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [addHashtags, setAddHashtags] = useState('')
  const [prependText, setPrependText] = useState('')
  const [appendText, setAppendText] = useState('')
  const [includeSource, setIncludeSource] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [template, setTemplate] = useState('')
  const [includeMedia, setIncludeMedia] = useState(true)
  const [enableYtDlp, setEnableYtDlp] = useState(false)
  const [twitterSourceType, setTwitterSourceType] = useState<'account' | 'username'>('account')
  const [twitterUsername, setTwitterUsername] = useState('')
  const [excludeReplies, setExcludeReplies] = useState(false)
  const [excludeRetweets, setExcludeRetweets] = useState(false)
  const [excludeQuotes, setExcludeQuotes] = useState(false)
  const [originalOnly, setOriginalOnly] = useState(false)
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(60)
  const [triggerType, setTriggerType] = useState<
    'on_tweet' | 'on_mention' | 'on_keyword' | 'on_hashtag' | 'on_search' | 'on_retweet' | 'on_like'
  >('on_tweet')
  const [triggerValue, setTriggerValue] = useState('')
  const [twitterActions, setTwitterActions] = useState({
    post: true,
    reply: false,
    quote: false,
    retweet: false,
    like: false,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts')
        if (!cancelled) setAccounts(data.accounts || [])
      } catch (error) {
        console.error('[CreateTaskPage] Failed to load accounts:', error)
        toast.error('Failed to load accounts')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const hasTwitterTarget = targetAccounts.some(
    id => accounts.find(a => a.id === id)?.platformId === 'twitter'
  )

  const handleToggleSource = (accountId: string) => {
    setSourceAccounts(prev =>
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    )
  }

  const handleToggleTarget = (accountId: string) => {
    setTargetAccounts(prev =>
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    if (!taskName.trim()) {
      toast.error('Task name is required')
      return
    }

    if (sourceAccounts.length === 0) {
      toast.error('Select at least one source account')
      return
    }

    if (targetAccounts.length === 0) {
      toast.error('Select at least one destination account')
      return
    }
    if (twitterSourceType === 'username' && !twitterUsername.trim()) {
      toast.error('Please enter a Twitter username for the source')
      return
    }
    if (triggerType === 'on_like' && twitterSourceType === 'username') {
      toast.error('Liked-tweet trigger requires a connected Twitter account')
      return
    }
    if (
      (triggerType === 'on_keyword' || triggerType === 'on_hashtag' || triggerType === 'on_search') &&
      !triggerValue.trim()
    ) {
      toast.error('Please enter a trigger value for the selected trigger type')
      return
    }

    const recurringPattern =
      frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly'
        ? frequency
        : frequency === 'hourly'
          ? 'custom'
          : undefined
    const executionType = frequency === 'once' ? 'scheduled' : 'recurring'

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taskName,
          description,
          sourceAccounts,
          targetAccounts,
          contentType: 'text',
          status: isActive ? 'active' : 'paused',
          executionType,
          recurringPattern,
          scheduleTime: frequency === 'once' && scheduleTime ? new Date(scheduleTime) : undefined,
          transformations: {
            addHashtags: addHashtags.split('\n').filter(h => h.trim()),
            prependText,
            appendText,
            includeSource,
            template: template || undefined,
            includeMedia,
            enableYtDlp,
            twitterActions,
          },
          filters: {
            twitterSourceType,
            twitterUsername: twitterUsername.trim() || undefined,
            excludeReplies,
            excludeRetweets,
            excludeQuotes,
            originalOnly,
            pollIntervalSeconds,
            triggerType,
            triggerValue: triggerValue.trim() || undefined,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create task')
      toast.success(data?.duplicate ? 'This task already exists' : 'Automation task created successfully!')
      setTaskName('')
      setDescription('')
      setSourceAccounts([])
      setTargetAccounts([])
      setAddHashtags('')
      setPrependText('')
      setAppendText('')
      setIncludeSource(false)
      setTemplate('')
      setIncludeMedia(true)
      setEnableYtDlp(false)
      setTwitterSourceType('account')
      setTwitterUsername('')
      setExcludeReplies(false)
      setExcludeRetweets(false)
      setExcludeQuotes(false)
      setOriginalOnly(false)
      setPollIntervalSeconds(60)
      setTriggerType('on_tweet')
      setTriggerValue('')
      setTwitterActions({ post: true, reply: false, quote: false, retweet: false, like: false })
      setFrequency('daily')
      setScheduleTime('')
      setIsActive(true)
    } catch (error) {
      console.error('[CreateTaskPage] Failed to create task:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create Automation Task</h1>
            <p className="text-muted-foreground">Set up automatic cross-platform content distribution</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Give your automation task a name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="taskName">Task Name *</Label>
                <Input
                  id="taskName"
                  placeholder="e.g., Daily Blog Post Distribution"
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this task will do..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Selection */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Account Configuration</CardTitle>
              <CardDescription>Select source and destination accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Source Accounts */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Source Account(s) *</Label>
                <p className="text-sm text-muted-foreground mb-3">Posts from these accounts will be forwarded</p>
                <div className="space-y-3">
                  {platforms.map(platform => {
                    const platformAccounts = accounts.filter(a => a.platformId === platform.id)
                    if (platformAccounts.length === 0) return null
                    return (
                      <div key={`source-${platform.id}`} className="space-y-2">
                        <div className="text-sm font-medium">{platform.name}</div>
                        <div className="space-y-2">
                          {platformAccounts.map(account => (
                            <label
                              key={account.id}
                              className="flex items-center gap-3 rounded-lg border border-border/40 p-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={sourceAccounts.includes(account.id)}
                                onChange={() => handleToggleSource(account.id)}
                                className="rounded border-border"
                              />
                              <span className="text-sm">
                                <span className="font-medium">{account.accountName || 'Account'}</span>
                                {account.accountUsername ? (
                                  <span className="text-muted-foreground"> @{account.accountUsername}</span>
                                ) : null}
                              </span>
                              {sourceAccounts.includes(account.id) && <Badge className="ml-auto">Selected</Badge>}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Flow Arrow */}
              <div className="flex justify-center py-2">
                <ArrowRight className="w-6 h-6 text-primary/50 rotate-90" />
              </div>

              {/* Destination Accounts */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Destination Account(s) *</Label>
                <p className="text-sm text-muted-foreground mb-3">Posts will be sent to these accounts</p>
                <div className="space-y-3">
                  {platforms.map(platform => {
                    const platformAccounts = accounts.filter(a => a.platformId === platform.id)
                    if (platformAccounts.length === 0) return null
                    return (
                      <div key={`target-${platform.id}`} className="space-y-2">
                        <div className="text-sm font-medium">{platform.name}</div>
                        <div className="space-y-2">
                          {platformAccounts.map(account => (
                            <label
                              key={account.id}
                              className="flex items-center gap-3 rounded-lg border border-border/40 p-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={targetAccounts.includes(account.id)}
                                onChange={() => handleToggleTarget(account.id)}
                                className="rounded border-border"
                              />
                              <span className="text-sm">
                                <span className="font-medium">{account.accountName || 'Account'}</span>
                                {account.accountUsername ? (
                                  <span className="text-muted-foreground"> @{account.accountUsername}</span>
                                ) : null}
                              </span>
                              {targetAccounts.includes(account.id) && <Badge className="ml-auto">Selected</Badge>}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Transformation */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Content Transformation</CardTitle>
              <CardDescription>Customize how content is transformed when posted to different platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prependText">Prepend Text</Label>
                <Textarea
                  id="prependText"
                  placeholder="Text to add at the beginning of each post"
                  value={prependText}
                  onChange={e => setPrependText(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="appendText">Append Text</Label>
                <Textarea
                  id="appendText"
                  placeholder="Text to add at the end of each post"
                  value={appendText}
                  onChange={e => setAppendText(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="hashtags">Hashtags (one per line)</Label>
                <Textarea
                  id="hashtags"
                  placeholder="#marketing&#10;#socialmedia&#10;#automation"
                  value={addHashtags}
                  onChange={e => setAddHashtags(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40">
                <Switch id="includeSource" checked={includeSource} onCheckedChange={setIncludeSource} />
                <Label htmlFor="includeSource" className="cursor-pointer">
                  <span className="font-medium">Add source attribution</span>
                  <span className="text-muted-foreground text-sm block">[Cross-posted via SocialFlow]</span>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Twitter Template */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Twitter Template</CardTitle>
              <CardDescription>Format tweets when the source is Twitter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="twitterTemplate">Message Template</Label>
                <Textarea
                  id="twitterTemplate"
                  placeholder="%name% (@%username%)&#10;%date%&#10;%text%&#10;%link%"
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Placeholders: %text%, %username%, %name%, %date%, %link%, %media%
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeMedia}
                  onChange={(e) => setIncludeMedia(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Include images/videos when available</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enableYtDlp}
                  onChange={(e) => setEnableYtDlp(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Download Twitter videos via yt-dlp</span>
              </div>
            </CardContent>
          </Card>

          {sourceAccounts.some(id => accounts.find(a => a.id === id)?.platformId === 'twitter') && (
          {/* Twitter Source */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Twitter Source</CardTitle>
              <CardDescription>Choose where tweets come from</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="twitterSourceType">Source Type</Label>
                <Select value={twitterSourceType} onValueChange={(v: any) => setTwitterSourceType(v)}>
                  <SelectTrigger id="twitterSourceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">My connected account</SelectItem>
                    <SelectItem value="username">Another user by username</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="twitterTriggerType">Trigger Type</Label>
                <Select value={triggerType} onValueChange={(v: any) => setTriggerType(v)}>
                  <SelectTrigger id="twitterTriggerType">
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
              {(triggerType === 'on_keyword' || triggerType === 'on_hashtag' || triggerType === 'on_search') && (
                <div>
                  <Label htmlFor="twitterTriggerValue">Trigger Value</Label>
                  <Input
                    id="twitterTriggerValue"
                    placeholder="e.g., #AI, crypto, from:news"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                  />
                </div>
              )}
              {twitterSourceType === 'username' && (
                <div>
                  <Label htmlFor="twitterUsername">Twitter Username</Label>
                  <Input
                    id="twitterUsername"
                    placeholder="e.g., jack"
                    value={twitterUsername}
                    onChange={(e) => setTwitterUsername(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Filters</Label>
                <div>
                  <Label htmlFor="pollIntervalSeconds">Poll Interval (seconds)</Label>
                  <Input
                    id="pollIntervalSeconds"
                    type="number"
                    min={10}
                    value={pollIntervalSeconds}
                    onChange={(e) => setPollIntervalSeconds(Math.max(10, Number(e.target.value || 10)))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={originalOnly}
                    disabled={triggerType === 'on_retweet'}
                    onChange={(e) => setOriginalOnly(e.target.checked)}
                  />
                  Original only (exclude replies/retweets/quotes)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={excludeReplies}
                    onChange={(e) => setExcludeReplies(e.target.checked)}
                  />
                  Exclude replies
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={excludeRetweets}
                    disabled={triggerType === 'on_retweet'}
                    onChange={(e) => setExcludeRetweets(e.target.checked)}
                  />
                  Exclude retweets
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={excludeQuotes}
                    onChange={(e) => setExcludeQuotes(e.target.checked)}
                  />
                  Exclude quote tweets
                </label>
              </div>
            </CardContent>
          </Card>
          )}

          {hasTwitterTarget && (
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>Twitter Actions</CardTitle>
                <CardDescription>Choose what to do on Twitter when a trigger fires</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={twitterActions.post}
                    onChange={(e) =>
                      setTwitterActions(prev => ({ ...prev, post: e.target.checked }))
                    }
                  />
                  Post tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={twitterActions.reply}
                    onChange={(e) =>
                      setTwitterActions(prev => ({ ...prev, reply: e.target.checked }))
                    }
                  />
                  Reply to the source tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={twitterActions.quote}
                    onChange={(e) =>
                      setTwitterActions(prev => ({ ...prev, quote: e.target.checked }))
                    }
                  />
                  Quote tweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={twitterActions.retweet}
                    onChange={(e) =>
                      setTwitterActions(prev => ({ ...prev, retweet: e.target.checked }))
                    }
                  />
                  Retweet
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={twitterActions.like}
                    onChange={(e) =>
                      setTwitterActions(prev => ({ ...prev, like: e.target.checked }))
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

          {/* Scheduling */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Scheduling</CardTitle>
              <CardDescription>When and how often this task should run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Run Once</SelectItem>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Every Day</SelectItem>
                    <SelectItem value="weekly">Every Week</SelectItem>
                    <SelectItem value="monthly">Every Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'once' && (
                <div>
                  <Label htmlFor="scheduleTime">Schedule Time</Label>
                  <Input
                    id="scheduleTime"
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Timezone: {timezone}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40">
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive" className="cursor-pointer">
                  <span className="font-medium">Task is active</span>
                  <span className="text-muted-foreground text-sm block">Enable this task to start automation</span>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <Link href="/dashboard">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Create Automation Task'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
