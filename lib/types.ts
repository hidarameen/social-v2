// ==================== PLATFORM TYPES ====================

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'telegram'
  | 'linkedin'
  | 'threads'
  | 'pinterest'
  | 'google_business'
  | 'snapchat'
  | 'whatsapp'

export type AccountAuthType = 'oauth' | 'manual'

export type TaskStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'paused'

export type ContentType = 'text' | 'image' | 'video' | 'carousel' | 'link' | 'poll'

// ==================== USER TYPES ====================

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

// ==================== ACCOUNT TYPES ====================

export interface PlatformAccount {
  id: string
  userId: string
  platform: SocialPlatform
  accountId: string // Platform-specific ID
  username: string
  displayName: string
  avatar?: string
  authType: AccountAuthType
  isActive: boolean
  verifiedAt?: Date
  errorCount: number
  lastError?: string
  lastSyncedAt?: Date
  
  // Encrypted credentials
  credentials: EncryptedCredentials
  
  // Metadata
  followers?: number
  metadata?: Record<string, any>
  
  createdAt: Date
  updatedAt: Date
}

export interface EncryptedCredentials {
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
  apiKey?: string
  customData?: Record<string, any>
}

// ==================== TASK/AUTOMATION TYPES ====================

export interface AutomationTask {
  id: string
  userId: string
  name: string
  description?: string
  
  // Source & Destination
  sourcePlatforms: SocialPlatform[]
  sourceAccountIds: string[] // Can be multiple
  destinationPlatforms: SocialPlatform[]
  destinationAccountIds: string[] // Can be multiple
  
  // Content Transformation
  contentTransformation: ContentTransformation
  
  // Scheduling
  isActive: boolean
  schedule?: Schedule
  
  // Status
  status: TaskStatus
  lastRanAt?: Date
  nextScheduledRun?: Date
  executionCount: number
  failureCount: number
  lastError?: string
  
  createdAt: Date
  updatedAt: Date
}

export interface ContentTransformation {
  includeSource: boolean
  addHashtags: string[]
  appendText?: string
  prependText?: string
  mediaHandling: 'copy' | 'transform' | 'skip' // How to handle media
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  maxLength?: number
  customMapping?: Record<SocialPlatform, string> // Custom text per platform
}

export interface Schedule {
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number[] // 0-6 for daily/weekly
  timeOfDay?: string // HH:mm format
  timezone: string
  maxRetries: number
  retryDelay: number // in minutes
}

// ==================== CONTENT TYPES ====================

export interface ScheduledPost {
  id: string
  userId: string
  taskId?: string // If created by automation
  
  content: ContentItem
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  
  // Multi-platform publishing
  platforms: PlatformPost[]
  
  // Scheduling
  scheduledFor: Date
  publishedAt?: Date
  
  // Analytics
  metrics?: PostMetrics
  
  createdAt: Date
  updatedAt: Date
}

export interface ContentItem {
  type: ContentType
  text: string
  media?: Media[]
  link?: string
  metadata?: Record<string, any>
}

export interface Media {
  id: string
  url: string
  type: 'image' | 'video' | 'gif'
  altText?: string
  duration?: number // for videos
}

export interface PlatformPost {
  platform: SocialPlatform
  accountId: string
  postId?: string // Platform-specific post ID after publishing
  status: 'pending' | 'published' | 'failed'
  platformUrl?: string
  error?: string
}

export interface PostMetrics {
  views: number
  likes: number
  comments: number
  shares: number
  clicks: number
  engagement: number // calculated
  lastUpdated: Date
}

// ==================== ANALYTICS TYPES ====================

export interface PlatformAnalytics {
  accountId: string
  platform: SocialPlatform
  period: 'day' | 'week' | 'month'
  date: Date
  
  metrics: {
    postsPublished: number
    totalEngagement: number
    totalReach: number
    totalImpressions: number
    newFollowers: number
    avgEngagementRate: number
  }
  
  topPosts: PostMetrics[]
  bestTimeToPost: string
}

export interface UserAnalytics {
  userId: string
  period: 'day' | 'week' | 'month'
  date: Date
  
  totalAccounts: number
  activeAccounts: number
  scheduledPosts: number
  publishedPosts: number
  failedPosts: number
  totalEngagement: number
  
  platformBreakdown: Record<SocialPlatform, PlatformAnalytics>
}

// ==================== WEBHOOK TYPES ====================

export interface WebhookEvent {
  id: string
  platform: SocialPlatform
  eventType: string
  payload: Record<string, any>
  processed: boolean
  createdAt: Date
}

// ==================== ERROR & LOGGING ====================

export interface TaskExecution {
  id: string
  taskId: string
  status: 'success' | 'failed' | 'partial'
  startedAt: Date
  completedAt: Date
  duration: number // ms
  itemsProcessed: number
  itemsFailed: number
  errors: ExecutionError[]
}

export interface ExecutionError {
  platform: SocialPlatform
  accountId: string
  code: string
  message: string
  timestamp: Date
  retryable: boolean
}
