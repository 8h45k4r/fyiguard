/**
 * FYI Guard - DetectionService Unit Tests
 *
 * Tests the built-in detection rules for PII, credentials,
 * prompt injection, and other sensitive data categories.
 */
import { DetectionService, ScanInput } from '../services/detectionService';

// Helper to create a minimal ScanInput
function makeInput(prompt: string, blockedCategories: string[] = []): ScanInput {
  return {
    prompt,
    platform: 'test',
    settings: {
      id: 'test',
      userId: 'test',
      blockedCategories,
      sensitivityLevel: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    policies: [],
  };
}

describe('DetectionService', () => {
  describe('PII Detection', () => {
    it('detects email addresses', () => {
      const result = DetectionService.scan(makeInput('Contact me at john@example.com'));
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.categories).toContain('PII');
    });

    it('detects phone numbers', () => {
      const result = DetectionService.scan(makeInput('Call me at 555-123-4567'));
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.categories).toContain('PII');
    });

    it('detects SSN patterns', () => {
      const result = DetectionService.scan(makeInput('My SSN is 123-45-6789'));
      expect(result.categories).toContain('PII');
    });

    it('does not flag clean text', () => {
      const result = DetectionService.scan(makeInput('Hello, how are you today?'));
      expect(result.findings.length).toBe(0);
      expect(result.riskScore).toBe(0);
    });
  });
  });
