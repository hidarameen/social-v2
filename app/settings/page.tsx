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
import { Save, Bell, Lock, Palette, Database, KeyRound, Moon, Sun, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { useThemePreset, type ThemePreset } from '@/components/theme-provider';
import { useShellPreferences } from '@/components/layout/shell-provider';

const MANAGED_PLATFORM_IDS = [
  'twitter',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
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
};

const OUTSTAND_PLATFORM_OPTIONS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'linkedin', label: 'LinkedIn' },
] as const;

type OutstandPlatformId = (typeof OUTSTAND_PLATFORM_OPTIONS)[number]['id'];

type OutstandSettingsForm = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  tenantId: string;
  platforms: OutstandPlatformId[];
  applyToAllAccounts: boolean;
};

const EMPTY_OUTSTAND_SETTINGS: OutstandSettingsForm = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://api.outstand.so/v1',
  tenantId: '',
  platforms: [],
  applyToAllAccounts: true,
};

const THEME_PRESET_OPTIONS: Array<{
  id: ThemePreset;
  name: string;
  description: string;
  swatches: [string, string, string];
}> = [
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Formal enterprise palette (Carbon + Atlassian + Primer).',
    swatches: ['#0F62FE', '#0052CC', '#57606A'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Minimal neutral scheme with subtle accents.',
    swatches: ['#667086', '#7f8ea4', '#a6b0c2'],
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    description: 'Warm editorial palette with high contrast.',
    swatches: ['#e57a39', '#edb84c', '#46b8a8'],
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Cool arctic blue-gray with clean contrast.',
    swatches: ['#5e81ac', '#88c0d0', '#81a1c1'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Frost white floating cards over a soft airy blue-gray background.',
    swatches: ['#EEF3F8', '#F8F8FA', '#2F84D4'],
  },
  {
    id: 'warmlux',
    name: 'Warm Luxe',
    description: 'Soft warm neumorphism with elegant golden corporate accents.',
    swatches: ['#E9E6DF', '#E5B73B', '#2C2C2C'],
  },
];

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
  const { resolvedTheme, setTheme } = useTheme();
  const { preset, setPreset } = useThemePreset();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    reducedMotion,
    setReducedMotion,
  } = useShellPreferences();
  const [mounted, setMounted] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<ManagedPlatformId>('twitter');
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialMap, setCredentialMap] = useState<Record<ManagedPlatformId, PlatformCredentialForm>>(
    buildEmptyCredentialMap()
  );
  const [outstandSettings, setOutstandSettings] = useState<OutstandSettingsForm>({
    ...EMPTY_OUTSTAND_SETTINGS,
  });
  const [outstandLoading, setOutstandLoading] = useState(true);
  const [outstandSaving, setOutstandSaving] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    async function loadOutstandSettings() {
      try {
        const res = await fetch('/api/outstand-settings', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load Outstand settings');
        }
        if (cancelled) return;

        const incoming = data.settings || {};
        const selectedPlatforms = Array.isArray(incoming.platforms)
          ? incoming.platforms.filter((value: string) =>
              OUTSTAND_PLATFORM_OPTIONS.some((option) => option.id === value)
            )
          : [];

        setOutstandSettings({
          enabled: Boolean(incoming.enabled),
          apiKey: typeof incoming.apiKey === 'string' ? incoming.apiKey : '',
          baseUrl:
            typeof incoming.baseUrl === 'string' && incoming.baseUrl.trim().length > 0
              ? incoming.baseUrl
              : 'https://api.outstand.so/v1',
          tenantId: typeof incoming.tenantId === 'string' ? incoming.tenantId : '',
          platforms: selectedPlatforms,
          applyToAllAccounts:
            typeof incoming.applyToAllAccounts === 'boolean' ? incoming.applyToAllAccounts : true,
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load Outstand settings');
        }
      } finally {
        if (!cancelled) setOutstandLoading(false);
      }
    }

    loadOutstandSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTheme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';
  const nextTheme = selectedTheme === 'dark' ? 'light' : 'dark';
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

  const toggleOutstandPlatform = (platformId: OutstandPlatformId) => {
    setOutstandSettings((prev) => {
      const has = prev.platforms.includes(platformId);
      return {
        ...prev,
        platforms: has
          ? prev.platforms.filter((id) => id !== platformId)
          : [...prev.platforms, platformId],
      };
    });
  };

  const saveOutstandSettings = async () => {
    try {
      setOutstandSaving(true);
      const res = await fetch('/api/outstand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: outstandSettings.enabled,
          apiKey: outstandSettings.apiKey,
          baseUrl: outstandSettings.baseUrl,
          tenantId: outstandSettings.tenantId,
          platforms: outstandSettings.platforms,
          applyToAllAccounts: outstandSettings.applyToAllAccounts,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save Outstand settings');
      }
      const next = data.settings || {};
      setOutstandSettings({
        enabled: Boolean(next.enabled),
        apiKey: typeof next.apiKey === 'string' ? next.apiKey : '',
        baseUrl:
          typeof next.baseUrl === 'string' && next.baseUrl.trim().length > 0
            ? next.baseUrl
            : 'https://api.outstand.so/v1',
        tenantId: typeof next.tenantId === 'string' ? next.tenantId : '',
        platforms: Array.isArray(next.platforms)
          ? next.platforms.filter((value: string) =>
              OUTSTAND_PLATFORM_OPTIONS.some((option) => option.id === value)
            )
          : [],
        applyToAllAccounts:
          typeof next.applyToAllAccounts === 'boolean' ? next.applyToAllAccounts : true,
      });
      toast.success('Outstand settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save Outstand settings');
    } finally {
      setOutstandSaving(false);
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
        <div className="page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Workspace Control
            </p>
            <h1 className="page-title">
            Settings
            </h1>
            <p className="page-subtitle">
            Manage your account, themes, and platform API credentials
            </p>
          </div>
          <Button size="lg" onClick={handleSave}>
            <Save size={18} className="mr-1" />
            Save All Changes
          </Button>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="surface-card xl:col-span-2">
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

          <Card className="surface-card xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound size={20} />
                Outstand Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure one Outstand API key per user, choose which platforms use Outstand, and publish to all
                Outstand accounts for each selected platform.
              </p>

              {outstandLoading ? (
                <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                  Loading Outstand settings...
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">Enable Outstand</p>
                      <p className="text-sm text-muted-foreground">
                        Use Outstand for the selected platforms only.
                      </p>
                    </div>
                    <Switch
                      checked={outstandSettings.enabled}
                      onCheckedChange={(checked) =>
                        setOutstandSettings((prev) => ({
                          ...prev,
                          enabled: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Outstand API Key</label>
                      <Input
                        type="password"
                        placeholder="outstand_api_key"
                        value={outstandSettings.apiKey}
                        onChange={(event) =>
                          setOutstandSettings((prev) => ({
                            ...prev,
                            apiKey: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Outstand Tenant ID</label>
                      <Input
                        placeholder="optional tenant id"
                        value={outstandSettings.tenantId}
                        onChange={(event) =>
                          setOutstandSettings((prev) => ({
                            ...prev,
                            tenantId: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-2">Outstand API Base URL</label>
                      <Input
                        placeholder="https://api.outstand.so/v1"
                        value={outstandSettings.baseUrl}
                        onChange={(event) =>
                          setOutstandSettings((prev) => ({
                            ...prev,
                            baseUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Platforms Using Outstand</label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {OUTSTAND_PLATFORM_OPTIONS.map((platform) => {
                        const active = outstandSettings.platforms.includes(platform.id);
                        return (
                          <button
                            key={platform.id}
                            type="button"
                            onClick={() => toggleOutstandPlatform(platform.id)}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/60 bg-card/45 text-foreground hover:border-primary/35'
                            }`}
                          >
                            {platform.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">Apply to all accounts per platform</p>
                      <p className="text-sm text-muted-foreground">
                        When enabled, each selected platform publishes to all linked Outstand accounts.
                      </p>
                    </div>
                    <Switch
                      checked={outstandSettings.applyToAllAccounts}
                      onCheckedChange={(checked) =>
                        setOutstandSettings((prev) => ({
                          ...prev,
                          applyToAllAccounts: checked,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              <Button onClick={saveOutstandSettings} disabled={outstandLoading || outstandSaving}>
                {outstandSaving ? 'Saving...' : 'Save Outstand Settings'}
              </Button>
            </CardContent>
          </Card>

          <Card className="surface-card">
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

          <Card className="surface-card">
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
                <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme(nextTheme);
                      toast.success(nextTheme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled');
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90"
                    aria-label={selectedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={selectedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  >
                    {selectedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Theme Preset
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {THEME_PRESET_OPTIONS.map((item) => {
                    const active = preset === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPreset(item.id);
                          toast.success(`Preset switched to ${item.name}`);
                        }}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? 'border-primary/40 bg-primary/10 shadow-md shadow-primary/15'
                            : 'border-border/70 bg-card/55 hover:border-primary/25 hover:bg-card'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          {active && (
                            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mb-2 flex items-center gap-1.5">
                          {item.swatches.map((color) => (
                            <span
                              key={color}
                              className="h-4 w-4 rounded-full border border-border/60"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Workspace Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Reduced Motion
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Minimize animation and transition effects globally.
                  </p>
                </div>
                <Switch
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Collapsed Sidebar by Default
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Keep navigation compact until expanded.
                  </p>
                </div>
                <Switch
                  checked={sidebarCollapsed}
                  onCheckedChange={setSidebarCollapsed}
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-card/45 p-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Productivity Shortcuts
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use `Ctrl/Cmd + K` for command palette and `Shift + ?` for shortcut help.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-global-command-palette'))}
                  >
                    Open Command Palette
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }))}
                  >
                    Open Shortcuts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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

              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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

              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={20} />
                Privacy & Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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

              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} />
                Database & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-card/50 border border-border/50">
                <p className="text-sm text-foreground mb-2">
                  Database Status: <span className="font-semibold text-primary">Connected</span>
                </p>
                <p className="text-sm text-muted-foreground">
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

          <div className="flex flex-wrap gap-3 xl:col-span-2">
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
