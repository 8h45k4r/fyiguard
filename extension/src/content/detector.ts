import { PATTERN_DEFINITIONS, PatternDefinition } from '../shared/patterns';
import { Detection, ScanResult, UserSettings, RiskLevel, DetectionCategory } from '../shared/types';

const CRITICAL_PATTERNS: Record<string, boolean> = {
  ssn: true,
  credit_card: true,
  api_key: true,
  private_key: true,
  password_inline: true,
};

export class PromptDetector {
  private patterns: Array<{ def: PatternDefinition; compiled: RegExp }>;

  constructor() {
    this.patterns = PATTERN_DEFINITIONS.map((def) => ({
      def,
      compiled: new RegExp(def.pattern, def.flags),
    }));
  }

  async scanText(text: string, settings: UserSettings): Promise<ScanResult> {
    const startTime = performance.now();
    const detections: Detection[] = [];

    for (const { def, compiled } of this.patterns) {
      if (!this.isCategoryEnabled(def.category, settings)) continue;

      compiled.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = compiled.exec(text)) !== null) {
        const confidence = this.calculateConfidence(match, def);
        detections.push({
          category: def.category,
          confidence,
          riskLevel: this.getRiskLevel(def.name, confidence),
          patternMatched: match[0],
          sanitizedMatch: match[0].replace(/./g, 'X').substring(0, 20),
          position: { start: match.index, length: match[0].length },
        });

        if (!def.flags.includes('g')) break;
      }
    }

    return {
      blocked: this.shouldBlock(detections, settings),
      warnings: detections.filter((d) => d.riskLevel !== 'CRITICAL'),
      detections,
      riskScore: this.calculateOverallRisk(detections),
      processingTime: performance.now() - startTime,
    };
  }

  private isCategoryEnabled(category: DetectionCategory, settings: UserSettings): boolean {
    const categoryMap: Record<DetectionCategory, keyof UserSettings['categories']> = {
      pii: 'pii',
      financial: 'financial',
      credentials: 'credentials',
      medical: 'medical',
      proprietary: 'proprietary',
    };
    return settings.categories[categoryMap[category]] ?? true;
  }

  private calculateConfidence(match: RegExpExecArray, def: PatternDefinition): number {
    let confidence = def.baseConfidence;
    const fullMatch = match[0];

    if (fullMatch.length > 8) confidence += 0.05;
    if (def.contextHints.some((hint) => fullMatch.toLowerCase().includes(hint))) {
      confidence += 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private getRiskLevel(name: string, confidence: number): RiskLevel {
    if (CRITICAL_PATTERNS[name] && confidence > 0.8) return 'CRITICAL';
    if (confidence > 0.7) return 'HIGH';
    if (confidence > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  private shouldBlock(detections: Detection[], settings: UserSettings): boolean {
    if (!settings.autoBlock) return false;
    return detections.some((d) => d.riskLevel === 'CRITICAL');
  }

  private calculateOverallRisk(detections: Detection[]): number {
    if (!detections.length) return 0;
    const weights: Record<string, number> = { CRITICAL: 1, HIGH: 0.7, MEDIUM: 0.4, LOW: 0.1 };
    const total = detections.reduce((s, d) => s + (weights[d.riskLevel] || 0), 0);
    return Math.min(1, total / detections.length);
  }
}

export default PromptDetector;