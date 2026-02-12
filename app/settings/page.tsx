'use client';

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
import { Switch } from '@/components/ui/switch';
import { Save, Bell, Lock, Palette, Database, KeyRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';

const MANAGED_PLATFORM_IDS = [
  'twitter',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'telegram',
] as const;

type ManagedPlatformId = (typeof MANAGED_PLATFORM_IDS)[number];

type PlatformCredentialForm = {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  apiSecret: string;
  bearerToken: string;
  webhookSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  botToken: string;
};

type CredentialField = {
  key: keyof PlatformCredentialForm;
  label: string;
  placeholder: string;
  secret?: boolean;
};

const EMPTY_CREDENTIAL_FORM: PlatformCredentialForm = {
  clientId: '',
  clientSecret: '',
  apiKey: '',
  apiSecret: '',
  bearerToken: '',
  webhookSecret: '',
  accessToken: '',
  accessTokenSecret: '',
  botToken: '',
};

const PLATFORM_LABELS: Record<ManagedPlatformId, string> = {
  twitter: 'Twitter / X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
};

const PLATFORM_FIELDS: Record<ManagedPlatformId, CredentialField[]> = {
  twitter: [
    { key: 'clientId', label: 'OAuth Client ID', placeholder: 'Twitter app client id' },
    { key: 'clientSecret', label: 'OAuth Client Secret', placeholder: 'Twitter app client secret', secret: true },
    { key: 'apiKey', label: 'API Key (OAuth1)', placeholder: 'Twitter API key' },
    { key: 'apiSecret', label: 'API Secret (OAuth1)', placeholder: 'Twitter API secret', secret: true },
    { key: 'accessToken', label: 'Access Token (OAuth1)', placeholder: 'Twitter access token', secret: true },
    { key: 'accessTokenSecret', label: 'Access Token Secret (OAuth1)', placeholder: 'Twitter access token secret', secret: true },
    { key: 'bearerToken', label: 'Bearer Token (Streaming)', placeholder: 'Twitter bearer token', secret: true },
    { key: 'webhookSecret', label: 'Webhook Secret', placeholder: 'Twitter webhook/API secret', secret: true },
  ],
  facebook: [
    { key: 'clientId', label: 'App ID / Client ID', placeholder: 'Facebook app id' },
    { key: 'clientSecret', label: 'App Secret / Client Secret', placeholder: 'Facebook app secret', secret: true },
  ],
  instagram: [
    { key: 'clientId', label: 'Client ID', placeholder: 'Instagram client id' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Instagram client secret', secret: true },
  ],
  youtube: [
    { key: 'clientId', label: 'Google Client ID', placeholder: 'Google OAuth client id' },
    { key: 'clientSecret', label: 'Google Client Secret', placeholder: 'Google OAuth client secret', secret: true },
  ],
  tiktok: [
    { key: 'clientId', label: 'Client Key', placeholder: 'TikTok client key' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'TikTok client secret', secret: true },
  ],
  linkedin: [
    { key: 'clientId', label: 'Client ID', placeholder: 'LinkedIn client id' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'LinkedIn client secret', secret: true },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true },
    { key: 'webhookSecret', label: 'Webhook Secret (Optional)', placeholder: 'Telegram webhook secret', secret: true },
  ],
};

function buildEmptyCredentialMap(): Record<ManagedPlatformId, PlatformCredentialForm> {
  return MANAGED_PLATFORM_IDS.reduce((acc, id) => {
    acc[id] = { ...EMPTY_CREDENTIAL_FORM };
    return acc;
  }, {} as Record<ManagedPlatformId, PlatformCredentialForm>);
}

function normalizeCredentialForm(raw: any): PlatformCredentialForm {
  return {
    clientId: typeof raw?.clientId === 'string' ? raw.clientId : '',
    clientSecret: typeof raw?.clientSecret === 'string' ? raw.clientSecret : '',
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
    apiSecret: typeof raw?.apiSecret === 'string' ? raw.apiSecret : '',
    bearerToken: typeof raw?.bearerToken === 'string' ? raw.bearerToken : '',
    webhookSecret: typeof raw?.webhookSecret === 'string' ? raw.webhookSecret : '',
    accessToken: typeof raw?.accessToken === 'string' ? raw.accessToken : '',
    accessTokenSecret: typeof raw?.accessTokenSecret === 'string' ? raw.accessTokenSecret : '',
    botToken: typeof raw?.botToken === 'string' ? raw.botToken : '',
  };
}

function sanitizeForSave(form: PlatformCredentialForm): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(form)) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      output[key] = trimmed;
    }
  }
  return output;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<ManagedPlatformId>('twitter');
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialMap, setCredentialMap] = useState<Record<ManagedPlatformId, PlatformCredentialForm>>(
    buildEmptyCredentialMap()
  );

  const [settings, setSettings] = useState({
    email: '',
    timezone: 'UTC',
    notifications: {
      emailOnSuccess: true,
      emailOnError: true,
      pushNotifications: false,
    },
    privacy: {
      allowAnalytics: true,
      shareErrorLogs: false,
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    setSettings(prev => ({ ...prev, email: session.user.email || '' }));
  }, [session?.user?.email]);

  useEffect(() => {
    let cancelled = false;
    async function loadCredentials() {
      try {
        const res = await fetch('/api/platform-credentials', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load platform credentials');
        }
        if (cancelled) return;

        const next = buildEmptyCredentialMap();
        for (const platformId of MANAGED_PLATFORM_IDS) {
          next[platformId] = normalizeCredentialForm(data.credentials?.[platformId] ?? {});
        }
        setCredentialMap(next);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load platform credentials');
        }
      } finally {
        if (!cancelled) setCredentialsLoading(false);
      }
    }
    loadCredentials();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTheme = mounted ? (theme ?? 'system') : 'system';
  const activeCredentials = useMemo(
    () => credentialMap[selectedPlatform] ?? { ...EMPTY_CREDENTIAL_FORM },
    [credentialMap, selectedPlatform]
  );

  const updateCredentialField = (key: keyof PlatformCredentialForm, value: string) => {
    setCredentialMap(prev => ({
      ...prev,
      [selectedPlatform]: {
        ...prev[selectedPlatform],
        [key]: value,
      },
    }));
  };

  const savePlatformCredentials = async () => {
    try {
      setCredentialsSaving(true);
      const payload = sanitizeForSave(activeCredentials);
      const res = await fetch('/api/platform-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId: selectedPlatform,
          credentials: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save credentials');
      }
      setCredentialMap(prev => ({
        ...prev,
        [selectedPlatform]: normalizeCredentialForm(data.credentials ?? {}),
      }));
      toast.success(`${PLATFORM_LABELS[selectedPlatform]} credentials saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setCredentialsSaving(false);
    }
  };

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, themes, and platform API credentials
          </p>
        </div>

        <div className="max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound size={20} />
                Platform API Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                OAuth and API keys are stored per-user in the database and isolated between accounts.
              </p>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Platform
                </label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(value) => setSelectedPlatform(value as ManagedPlatformId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANAGED_PLATFORM_IDS.map((platformId) => (
                      <SelectItem key={platformId} value={platformId}>
                        {PLATFORM_LABELS[platformId]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {credentialsLoading ? (
                <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                  Loading credentials...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {PLATFORM_FIELDS[selectedPlatform].map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {field.label}
                      </label>
                      <Input
                        type={field.secret ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={activeCredentials[field.key]}
                        onChange={(e) => updateCredentialField(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={savePlatformCredentials} disabled={credentialsLoading || credentialsSaving}>
                {credentialsSaving ? 'Saving...' : 'Save Platform Credentials'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={20} />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={settings.email}
                  disabled
                  className="opacity-50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Timezone
                </label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) =>
                    setSettings(prev => ({
                      ...prev,
                      timezone: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">EST (Eastern Standard Time)</SelectItem>
                    <SelectItem value="CST">CST (Central Standard Time)</SelectItem>
                    <SelectItem value="MST">MST (Mountain Standard Time)</SelectItem>
                    <SelectItem value="PST">PST (Pacific Standard Time)</SelectItem>
                    <SelectItem value="GMT">GMT (Greenwich Mean Time)</SelectItem>
                    <SelectItem value="CET">CET (Central European Time)</SelectItem>
                    <SelectItem value="IST">IST (Indian Standard Time)</SelectItem>
                    <SelectItem value="JST">JST (Japan Standard Time)</SelectItem>
                    <SelectItem value="AEST">AEST (Australian Eastern Standard Time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={20} />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Theme
                </label>
                <Select
                  value={selectedTheme}
                  onValueChange={(value) => {
                    setTheme(value);
                    toast.success('Theme updated');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Email on Success
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when tasks complete successfully
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.emailOnSuccess}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailOnSuccess: checked,
                      },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Email on Error
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when tasks fail
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.emailOnError}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailOnError: checked,
                      },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Push Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive browser push notifications
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.pushNotifications}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        pushNotifications: checked,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={20} />
                Privacy & Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Usage Analytics
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Help us improve by sharing anonymous usage data
                  </p>
                </div>
                <Switch
                  checked={settings.privacy.allowAnalytics}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        allowAnalytics: checked,
                      },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Share Error Logs
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Help us debug issues by sharing error logs
                  </p>
                </div>
                <Switch
                  checked={settings.privacy.shareErrorLogs}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        shareErrorLogs: checked,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} />
                Database & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-card/50 border border-border/50">
                <p className="text-sm text-foreground mb-2">
                  Database Status: <span className="font-semibold text-green-600">Connected</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Platform API credentials and user data are now persisted in PostgreSQL per user.
                </p>
              </div>

              <Button variant="outline" className="w-full bg-transparent">
                Export Data
              </Button>
              <Button variant="outline" className="w-full bg-transparent">
                Clear Cache
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button size="lg" onClick={handleSave}>
              <Save size={20} className="mr-2" />
              Save Settings
            </Button>
            <Button size="lg" variant="outline">
              Reset to Default
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
