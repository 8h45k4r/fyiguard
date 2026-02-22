// FYI Guard - TypeScript Types
// Branding: Primary #368F4D | Font: Outfit | Logo: Certifyi

export type DetectionCategory =
  | 'CREDIT_CARD'
  | 'SSN'
  | 'DB_CREDENTIALS'
  | 'API_KEY'
  | 'PRIVATE_KEY'
  | 'PII'
  | 'PHI'
  | 'EMAIL'
  | 'PHONE'
  | 'ADDRESS'
  | 'CONFIDENTIAL'
  | 'INTERNAL_URL'
  | 'CODE_BLOCK'
  | 'JWT_TOKEN';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EventType = 'BLOCK' | 'WARN' | 'ALLOW';
export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';
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
  userId?: string;
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
  customMessage?: string;
}

export interface Policy {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  rules: PolicyRule[];
  platforms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  notifications: {
    email: boolean;
    browser: boolean;
    slack?: string;
  };
  sensitivity: Sensitivity;
  autoBlock: boolean;
  whitelistedDomains: string[];
  enabledPlatforms: string[];
}

export interface User {
  id: string;
  certifyiUserId?: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  settings: UserSettings;
}

export interface PlatformAdapter {
  getPromptInputSelector(): string;
  getSubmitButtonSelector(): string;
  extractPromptText(): string;
  interceptSubmit(callback: (text: string) => boolean): void;
  showBlockedNotification(detections: Detection[]): void;
  getConversationId(): string | null;
  getPlatformName(): string;
}

export interface ContextAnalysis {
  matched: boolean;
  confidence: number;
  shouldBlock: boolean;
  context: string;
}

export interface AnalyticsSummary {
  period: { start: string; end: string };
  summary: {
    totalEvents: number;
    blocked: number;
    warnings: number;
    platforms: Record<string, number>;
    topCategories: Array<{ category: string; count: number; percent: number }>;
  };
  trends: { daily: Array<{ date: string; events: number }> };
}

export interface ExtensionState {
  isEnabled: boolean;
  user: User | null;
  policies: Policy[];
  recentEvents: DetectionEvent[];
  analyticsCache: AnalyticsSummary | null;
  lastSync: Date | null;
}