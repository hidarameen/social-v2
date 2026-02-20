'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/common/use-confirm-dialog'
import { PlatformIcon } from '@/components/common/platform-icon'
import { AccountAvatar } from '@/components/common/account-avatar'
import type { PlatformId } from '@/lib/platforms/types'
import {
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

const platforms = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'twitter', name: 'Twitter' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'linkedin', name: 'LinkedIn' },
] satisfies Array<{ id: PlatformId; name: string }>

export default function AccountsPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [selectedPlatform, setSelectedPlatform] = useState<string>('facebook')
  const [accounts, setAccounts] = useState<any[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/accounts?limit=50&offset=0')
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts')
        if (cancelled) return
        setAccounts(
          (data.accounts || []).map((a: any) => ({
            id: a.id,
            platform: a.platformId,
            platformName: platforms.find(p => p.id === a.platformId)?.name || a.platformId,
            accountName: a.accountName,
            username: a.accountUsername,
            status: a.isActive ? 'connected' : 'paused',
            connectedAt: new Date(a.createdAt).toLocaleDateString(),
            profileImageUrl:
              a?.credentials?.profileImageUrl ||
              a?.credentials?.accountInfo?.profileImageUrl ||
              a?.credentials?.accountInfo?.avatarUrl ||
              '',
            isBot: Boolean(a?.credentials?.isBot ?? a?.credentials?.accountInfo?.isBot ?? false),
          }))
        )
      } catch (error) {
        console.error('[Dashboard Accounts] Load error:', error)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.href = `/api/oauth/${selectedPlatform}/start?returnTo=${encodeURIComponent(returnTo)}`
  }

  const handleRemoveAccount = async (id: string) => {
    const accepted = await confirm({
      title: 'Remove Account?',
      description: 'This account will be disconnected from the dashboard.',
      confirmText: 'Remove',
      destructive: true,
    })
    if (!accepted) return

    fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to remove account')
        setAccounts(accounts.filter(a => a.id !== id))
        toast.success('Account removed successfully')
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to remove account'))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-toolbar sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manage Accounts</h1>
            <p className="text-muted-foreground">Connect and manage your social media accounts</p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Connect New Account</DialogTitle>
                <DialogDescription>Use automatic connect to link your social media account</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Platform Selection */}
                <div>
                  <Label className="text-base font-semibold mb-4 block">Select Platform</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {platforms.map(platform => {
                      return (
                        <button
                          key={platform.id}
                          onClick={() => setSelectedPlatform(platform.id)}
                          className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                            selectedPlatform === platform.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border/40 hover:border-border/60'
                          }`}
                        >
                          <PlatformIcon platformId={platform.id} size={24} />
                          <span className="text-xs font-medium text-center">{platform.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    Automatic connect only. Click <strong>Connect Account</strong> to continue.
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Connect Account</Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {accounts.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="py-16 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No Accounts Connected</h3>
              <p className="text-muted-foreground mb-6">
                Connect your first social media account to get started with cross-platform posting.
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Group by Platform */}
            {platforms.map(platform => {
              const platformAccounts = accounts.filter(a => a.platform === platform.id)
              if (platformAccounts.length === 0) return null

              return (
                <Card key={platform.id} className="border-border/40">
                  <CardHeader className="pb-4 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platformId={platform.id} size={24} />
                      <div>
                        <CardTitle>{platform.name}</CardTitle>
                        <CardDescription>{platformAccounts.length} account(s) connected</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {platformAccounts.map(account => (
                        <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-border/60 transition">
                          <div className="flex items-center gap-3 flex-1">
                            <AccountAvatar
                              platformId={account.platform as PlatformId}
                              profileImageUrl={account.profileImageUrl}
                              isBot={account.platform === 'telegram' && account.isBot}
                              label={account.accountName || account.username || account.platformName}
                              size={44}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{account.accountName || account.username}</p>
                              {account.accountName && account.username ? (
                                <p className="text-xs text-muted-foreground">@{account.username}</p>
                              ) : null}
                              <p className="text-sm text-muted-foreground">Connected {account.connectedAt}</p>
                            </div>
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {account.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" className="gap-1">
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveAccount(account.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      {ConfirmDialog}
    </div>
  )
}
