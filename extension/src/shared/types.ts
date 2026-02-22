export type DetectionCategory =
  | 'CREDIT_CARD' | 'SSN' | 'DB_CREDENTIALS' | 'API_KEY'
  | 'PRIVATE_KEY' | 'PII' | 'PHI' | 'EMAIL' | 'PHONE'
  | 'ADDRESS' | 'CONFIDENTIAL' | 'INTERNAL_URL'
  | 'CODE_BLOCK' | 'JWT_TOKEN';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EventType = 'BLOCK' | 'WARN' | 'ALLOW';
export type Sensitivity = 'LOW' | 'MEDIUM' | 'HIGH';
export type PolicyAction = 'BLOCK' | 'WARN' | 'ALLOW';
export type UserAction = 'attempted_send' | 'copy_paste' | 'file_upload';

export interface Detection {
  category: DetectionCategory;
  confidence: number;
  riskLevel: RiskLevel;
  patternMatched: string;
  sanitizedMatch: string;
  position?: { start: number; length: number };
}

export interface ScanResult {
  blocked: boolean;
  warnings: Detection[];
  detections: Detection[];
  riskScore: number;
  processingTime: number;
}

export interface CategorySettings {
  pii: boolean;
  financial: boolean;
  credentials: boolean;
  medical: boolean;
  proprietary: boolean;
}

export interface UserSettings {
  categories: CategorySettings;
  notifications: { email: boolean; browser: boolean };
  sensitivity: Sensitivity;
  autoBlock: boolean;
  whitelistedDomains: string[];
  enabledPlatforms: string[];
}

export interface EventContext {
  platform: string;
  url: string;
  conversationId?: string;
  promptLength: number;
}

export interface EventMetadata {
  extensionVersion: string;
  browser: string;
  userAction: UserAction;
}

export interface DetectionEvent {
  id: string;
  eventType: EventType;
  timestamp: Date;
  detection: Detection;
  context: EventContext;
  metadata: EventMetadata;
}

export interface PolicyRule {
  category: DetectionCategory;
  action: PolicyAction;
  exceptions: string[];
}

export interface Policy {
  id: string;
  name: string;
  enabled: boolean;
  rules: PolicyRule[];
  platforms: string[];
}

export interface PlatformAdapter {
  getPromptInputSelector(): string;
  getSubmitButtonSelector(): string;
  extractPromptText(): string;
  interceptSubmit(callback: (text: string) => Promise<boolean>): void;
  showBlockedNotification(detections: Detection[]): void;
  getConversationId(): string | null;
  getPlatformName(): string;
}

export interface ExtensionState {
  isEnabled: boolean;
  user: null;
  policies: Policy[];
  recentEvents: DetectionEvent[];
  analyticsCache: null;
  lastSync: Date | null;
}

// ============================================
// Alert Types (for org admin notifications)
// ============================================

export interface AlertPayload {
  orgId: string;
  userId: string;
  category: DetectionCategory;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventType: string;
  platform: string;
  details: string;
  eventId?: string;
}

export interface AdminAlertConfig {
  emailEnabled: boolean;
  adminEmail: string;
  webhookUrl?: string;
  alertThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  digestFrequency: 'realtime' | 'hourly' | 'daily';
}

// ============================================
// Behavior Tracking Types
// ============================================

export type BehaviorEventType =
  | 'session_start'
  | 'session_end'
  | 'prompt_submitted'
  | 'file_uploaded'
  | 'detection_triggered';

export interface BehaviorTrackingEvent {
  userId: string;
  orgId: string;
  platform: string;
  eventType: BehaviorEventType;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface UserProductivitySummary {
  userId: string;
  totalTimeMinutes: number;
  platformBreakdown: Record<string, number>;
  productivityScore: number;
  promptsSubmitted: number;
  detectionsTriggered: number;
  blockedAttempts: number;
  riskScore: number;
}

export interface OrgDashboardData {
  orgId: string;
  period: string;
  totalUsers: number;
  totalSessions: number;
  totalTimeHours: number;
  avgTimePerUserMinutes: number;
  platformUsage: Record<string, { users: number; timeMinutes: number; prompts: number }>;
  topUsers: Array<{ userId: string; timeMinutes: number; prompts: number }>;
  riskSummary: { critical: number; high: number; medium: number; low: number };
  productivityMetrics: { avgScore: number; topPlatform: string; peakHour: number };
}