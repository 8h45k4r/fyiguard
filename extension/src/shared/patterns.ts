// FYI Guard - Detection Patterns (Single Source of Truth)
import { DetectionCategory, RiskLevel } from './types';

export interface PatternDefinition {
  name: string;
  regex: RegExp;
  category: DetectionCategory;
  risk: RiskLevel;
  tier: 'critical' | 'high' | 'medium';
  description: string;
}

export const PATTERN_DEFINITIONS: PatternDefinition[] = [
  // Tier 1: Critical (Auto-block)
  { name: 'AWS_KEY', regex: /AKIA[0-9A-Z]{16}/g, category: 'API_KEY', risk: 'CRITICAL', tier: 'critical', description: 'AWS Access Key ID' },
  { name: 'GITHUB_TOKEN', regex: /ghp_[a-zA-Z0-9]{36}/g, category: 'API_KEY', risk: 'CRITICAL', tier: 'critical', description: 'GitHub Personal Access Token' },
  { name: 'STRIPE_KEY', regex: /sk_live_[a-zA-Z0-9]{24,}/g, category: 'API_KEY', risk: 'CRITICAL', tier: 'critical', description: 'Stripe Live Secret Key' },
  { name: 'RSA_PRIVATE_KEY', regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g, category: 'PRIVATE_KEY', risk: 'CRITICAL', tier: 'critical', description: 'RSA Private Key' },
  { name: 'SSH_PRIVATE_KEY', regex: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g, category: 'PRIVATE_KEY', risk: 'CRITICAL', tier: 'critical', description: 'SSH Private Key' },
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, category: 'PII', risk: 'CRITICAL', tier: 'critical', description: 'Social Security Number' },
  { name: 'CREDIT_CARD', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, category: 'CREDIT_CARD', risk: 'CRITICAL', tier: 'critical', description: 'Credit card number' },
  { name: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, category: 'JWT_TOKEN', risk: 'CRITICAL', tier: 'critical', description: 'JSON Web Token' },
  { name: 'DB_CONNECTION_STRING', regex: /(?:mysql|postgresql|mongodb|redis):\/\/[^\s]+/gi, category: 'DB_CREDENTIALS', risk: 'CRITICAL', tier: 'critical', description: 'Database connection string' },
  { name: 'DB_PASSWORD', regex: /(?:password|pwd|pass)\s*[:=]\s*['"][^'"]{6,}['"]/gi, category: 'DB_CREDENTIALS', risk: 'CRITICAL', tier: 'critical', description: 'Database password' },
  { name: 'EMAIL_ADDRESS', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, category: 'EMAIL', risk: 'CRITICAL', tier: 'critical', description: 'Email address' },
  { name: 'MEDICAL_RECORD', regex: /\bMRN[-:\s]*\d{6,10}\b/gi, category: 'PHI', risk: 'CRITICAL', tier: 'critical', description: 'Medical Record Number' },
  { name: 'PATIENT_ID', regex: /\bPATIENT[-_\s]*ID[-:\s]*\d{6,10}\b/gi, category: 'PHI', risk: 'CRITICAL', tier: 'critical', description: 'Patient ID' },
  // Tier 2: High Risk
  { name: 'INTERNAL_URL', regex: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)/gi, category: 'INTERNAL_URL', risk: 'HIGH', tier: 'high', description: 'Internal network URL' },
  { name: 'CONFIDENTIAL_MARKER', regex: /\b(?:confidential|internal only|proprietary|trade secret)\b/gi, category: 'CONFIDENTIAL', risk: 'HIGH', tier: 'high', description: 'Confidentiality marker' },
  // Tier 3: Medium Risk
  { name: 'PHONE_NUMBER', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, category: 'PHONE', risk: 'MEDIUM', tier: 'medium', description: 'Phone number' },
  { name: 'US_ADDRESS', regex: /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\b/gi, category: 'ADDRESS', risk: 'MEDIUM', tier: 'medium', description: 'US street address' },
];

// Derived lookups
export const getPatternsByTier = (tier: PatternDefinition['tier']): PatternDefinition[] =>
  PATTERN_DEFINITIONS.filter(p => p.tier === tier);

export const CRITICAL_PATTERNS = getPatternsByTier('critical');
export const HIGH_RISK_PATTERNS = getPatternsByTier('high');
export const MEDIUM_RISK_PATTERNS = getPatternsByTier('medium');