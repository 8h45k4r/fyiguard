import crypto from 'crypto';
import { UserSettings, Policy } from '@prisma/client';

export interface DetectionFinding {
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  matchedText?: string;
  ruleSource: 'BUILTIN' | 'POLICY';
}

export interface ScanInput {
  prompt: string;
  platform: string;
  settings: UserSettings;
  policies: Policy[];
}

export interface ScanResult {
  riskScore: number;
  categories: string[];
  findings: DetectionFinding[];
}

// Built-in detection patterns aligned with the spec's detection engine
const BUILTIN_RULES: Array<{
  category: string;
  severity: DetectionFinding['severity'];
  patterns: RegExp[];
  score: number;
}> = [
  {
    category: 'PII',
    severity: 'HIGH',
    score: 30,
    patterns: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,                          // phone
      /\b\d{3}-\d{2}-\d{4}\b/,                                   // SSN
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // credit card
    ],
  },
  {
    category: 'CREDENTIALS',
    severity: 'CRITICAL',
    score: 40,
    patterns: [
      /(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
      /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i,
      /(?:bearer|token)\s+[A-Za-z0-9\-_.~+/]+=*/i,
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    ],
  },
  {
    category: 'PROMPT_INJECTION',
    severity: 'HIGH',
    score: 35,
    patterns: [
      /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
      /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
      /forget\s+(?:everything|all)\s+(?:above|previous|prior)/i,
      /you\s+are\s+now\s+(?:in\s+)?(?:developer|jailbreak|dan)\s+mode/i,
      /act\s+as\s+(?:if\s+you\s+(?:have\s+no|don't\s+have)\s+restrictions|an\s+unfiltered)/i,
      /new\s+system\s+(?:prompt|instruction)/i,
    ],
  },
  {
    category: 'CONFIDENTIAL_DATA',
    severity: 'MEDIUM',
    score: 25,
    patterns: [
      /(?:confidential|proprietary|internal\s+use\s+only|do\s+not\s+distribute)/i,
      /(?:trade\s+secret|nda|non-disclosure)/i,
    ],
  },
  {
    category: 'FINANCIAL_DATA',
    severity: 'HIGH',
    score: 30,
    patterns: [
      /\b(?:account\s+number|routing\s+number|iban|swift\s*code)\s*[:=]?\s*[\d\w]{6,}/i,
      /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/, // IBAN
    ],
  },
  {
    category: 'HEALTH_DATA',
    severity: 'HIGH',
    score: 30,
    patterns: [
      /\b(?:diagnosis|prescription|patient\s+id|medical\s+record|hipaa)\b/i,
      /\b(?:blood\s+type|HIV|cancer|diabetes)\b.*\b(?:patient|my|their)\b/i,
    ],
  },
  {
    category: 'INTERNAL_IP',
    severity: 'MEDIUM',
    score: 20,
    patterns: [
      /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/,
    ],
  },
];

export class DetectionService {
  /**
   * Main scan method — runs built-in rules + policy-based rules.
   * Score is capped at 100. Categories deduped.
   */
  static scan(input: ScanInput): ScanResult {
    const { prompt, settings, policies } = input;
    const findings: DetectionFinding[] = [];
    let rawScore = 0;

    // 1. Apply built-in rules
    for (const rule of BUILTIN_RULES) {
      // Skip category if user's blocked categories config doesn't include it
      const blockedCats = settings.blockedCategories as string[];
      if (blockedCats.length > 0 && !blockedCats.includes(rule.category)) {
        continue;
      }

      for (const pattern of rule.patterns) {
        const match = pattern.exec(prompt);
        if (match) {
          findings.push({
            category: rule.category,
            severity: rule.severity,
            description: `Detected ${rule.category.toLowerCase().replace('_', ' ')} pattern`,
            matchedText: DetectionService.redactMatch(match[0]),
            ruleSource: 'BUILTIN',
          });
          rawScore += rule.score;
          break; // one finding per rule category per scan
        }
      }
    }

    // 2. Apply policy-based rules
    for (const policy of policies) {
      if (!policy.isActive) continue;
      const rules = policy.rules as Array<{
        category: string;
        action: string;
        patterns?: string[];
      }>;

      for (const rule of rules) {
        if (!rule.patterns?.length) continue;
        for (const patternStr of rule.patterns) {
          try {
            const pattern = new RegExp(patternStr, 'i');
            const match = pattern.exec(prompt);
            if (match) {
              const severity = rule.action === 'BLOCK' ? 'HIGH' : 'MEDIUM';
              findings.push({
                category: rule.category,
                severity,
                description: `Policy "${policy.name}" rule matched`,
                matchedText: DetectionService.redactMatch(match[0]),
                ruleSource: 'POLICY',
              });
              rawScore += rule.action === 'BLOCK' ? 40 : 20;
              break;
            }
          } catch {
            // Invalid regex in policy — skip silently
          }
        }
      }
    }

    // 3. Apply sensitivity multiplier
    const sensitivityLevel = settings.sensitivityLevel as string;
    const multiplier = sensitivityLevel === 'HIGH' ? 1.3
      : sensitivityLevel === 'LOW' ? 0.7
      : 1.0;

    const riskScore = Math.min(Math.round(rawScore * multiplier), 100);

    const categories = [...new Set(findings.map((f) => f.category))];

    return { riskScore, categories, findings };
  }

  /**
   * Hash a prompt for storage — SHA-256, hex encoded.
   * We store the hash, never the raw prompt.
   */
  static hashPrompt(prompt: string): string {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  /**
   * Redact sensitive match text for safe logging.
   * Shows first 3 and last 3 chars with asterisks in between.
   */
  private static redactMatch(text: string): string {
    if (text.length <= 6) return '***';
    return `${text.slice(0, 3)}${'*'.repeat(Math.min(text.length - 6, 8))}${text.slice(-3)}`;
  }
}