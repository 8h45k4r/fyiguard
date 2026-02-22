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