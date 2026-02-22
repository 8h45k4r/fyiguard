import { DetectionCategory, RiskLevel } from './types';

export type CategoryGroup = 'pii' | 'financial' | 'credentials' | 'medical' | 'proprietary';

export interface PatternDefinition {
  name: string;
  regex: RegExp;
  category: DetectionCategory;
  categoryGroup: CategoryGroup;
  risk: RiskLevel;
  description: string;
}

export const PATTERN_DEFINITIONS: PatternDefinition[] = [
  // Credentials (critical)
  { name: 'AWS_KEY', regex: /AKIA[0-9A-Z]{16}/g, category: 'API_KEY', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'AWS Access Key ID' },
  { name: 'GITHUB_TOKEN', regex: /ghp_[a-zA-Z0-9]{36}/g, category: 'API_KEY', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'GitHub Token' },
  { name: 'STRIPE_KEY', regex: /sk_live_[a-zA-Z0-9]{24,}/g, category: 'API_KEY', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'Stripe Key' },
  { name: 'RSA_PRIVATE_KEY', regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g, category: 'PRIVATE_KEY', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'RSA Private Key' },
  { name: 'SSH_PRIVATE_KEY', regex: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g, category: 'PRIVATE_KEY', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'SSH Private Key' },
  { name: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, category: 'JWT_TOKEN', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'JWT Token' },
  { name: 'DB_CONNECTION', regex: /(?:mysql|postgresql|mongodb|redis):\/\/[^\s]+/gi, category: 'DB_CREDENTIALS', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'DB Connection String' },
  { name: 'DB_PASSWORD', regex: /(?:password|pwd|pass)\s*[:=]\s*['"][^'"]{6,}['"]/gi, category: 'DB_CREDENTIALS', categoryGroup: 'credentials', risk: 'CRITICAL', description: 'DB Password' },
  // Financial
  { name: 'CREDIT_CARD', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, category: 'CREDIT_CARD', categoryGroup: 'financial', risk: 'CRITICAL', description: 'Credit Card Number' },
  // PII
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, category: 'SSN', categoryGroup: 'pii', risk: 'CRITICAL', description: 'Social Security Number' },
  { name: 'EMAIL_ADDRESS', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, category: 'EMAIL', categoryGroup: 'pii', risk: 'HIGH', description: 'Email Address' },
  { name: 'PHONE_NUMBER', regex: /\b(?:\+?1[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/g, category: 'PHONE', categoryGroup: 'pii', risk: 'MEDIUM', description: 'Phone Number' },
  { name: 'US_ADDRESS', regex: /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|blvd|lane|ln)\b/gi, category: 'ADDRESS', categoryGroup: 'pii', risk: 'MEDIUM', description: 'US Address' },
  // Medical
  { name: 'MEDICAL_RECORD', regex: /\bMRN[-:\s]*\d{6,10}\b/gi, category: 'PHI', categoryGroup: 'medical', risk: 'CRITICAL', description: 'Medical Record Number' },
  { name: 'PATIENT_ID', regex: /\bPATIENT[-_\s]*ID[-:\s]*\d{6,10}\b/gi, category: 'PHI', categoryGroup: 'medical', risk: 'CRITICAL', description: 'Patient ID' },
  // Proprietary
  { name: 'INTERNAL_URL', regex: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)/gi, category: 'INTERNAL_URL', categoryGroup: 'proprietary', risk: 'HIGH', description: 'Internal URL' },
  { name: 'CONFIDENTIAL_MARKER', regex: /\b(?:confidential|internal only|proprietary|trade secret)\b/gi, category: 'CONFIDENTIAL', categoryGroup: 'proprietary', risk: 'HIGH', description: 'Confidentiality Marker' },
];