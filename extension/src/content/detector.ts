import { PATTERN_DEFINITIONS, PatternDefinition, CategoryGroup } from '../shared/patterns';
import { Detection, ScanResult, UserSettings, RiskLevel } from '../shared/types';

export class PromptDetector {
  private patterns: PatternDefinition[];

  constructor() {
    this.patterns = PATTERN_DEFINITIONS;
  }

  async scanText(text: string, settings: UserSettings): Promise<ScanResult> {
    const startTime = performance.now();
    const detections: Detection[] = [];

    for (const def of this.patterns) {
      if (!this.isCategoryEnabled(def.categoryGroup, settings)) continue;

      const regex = new RegExp(def.regex.source, def.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        detections.push({
          category: def.category,
          confidence: this.getConfidence(def.risk, match[0]),
          riskLevel: def.risk,
          patternMatched: match[0],
          sanitizedMatch: match[0].replace(/./g, 'X').substring(0, 20),
          position: { start: match.index, length: match[0].length },
        });

        if (!regex.global) break;
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

  private isCategoryEnabled(group: CategoryGroup, settings: UserSettings): boolean {
    return settings.categories[group] ?? true;
  }

  private getConfidence(risk: RiskLevel, matched: string): number {
    const base: Record<RiskLevel, number> = {
      CRITICAL: 0.95, HIGH: 0.8, MEDIUM: 0.6, LOW: 0.4,
    };
    let confidence = base[risk];
    if (matched.length > 20) confidence += 0.03;
    return Math.min(1, confidence);
  }

  private shouldBlock(detections: Detection[], settings: UserSettings): boolean {
    if (!settings.autoBlock) return false;
    return detections.some((d) => d.riskLevel === 'CRITICAL');
  }

  private calculateOverallRisk(detections: Detection[]): number {
    if (!detections.length) return 0;
    const w: Record<string, number> = { CRITICAL: 1, HIGH: 0.7, MEDIUM: 0.4, LOW: 0.1 };
    const total = detections.reduce((s, d) => s + (w[d.riskLevel] || 0), 0);
    return Math.min(1, total / detections.length);
  }
}

export default PromptDetector;