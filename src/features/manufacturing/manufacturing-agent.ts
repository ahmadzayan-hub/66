import { AgentIdentity, Artifact, assertIndependentEvaluator } from '../../platform/kernel.js';
import { DesignConcept } from '../design-studio/models/concept.js';

/**
 * Engineering baseline (§11): configurable per workshop; these are defaults,
 * not immutable universal rules. Changing them requires authorised approval
 * (enforced in RuleBook.update).
 */
export interface EngineeringRules {
  minEngravingLineWidthMm: number;
  minInternalGapMm: number;
  allowIsolatedArabicDots: boolean;
  allowFragileBridges: boolean;
  maxUnsupportedDetailMm: number;
}

export const DEFAULT_RULES: EngineeringRules = {
  minEngravingLineWidthMm: 0.3,
  minInternalGapMm: 0.35, // middle of the 0.30-0.40 default band
  allowIsolatedArabicDots: false,
  allowFragileBridges: false,
  maxUnsupportedDetailMm: 0.25,
};

export class RuleBook {
  private workshopRules = new Map<string, EngineeringRules>();

  constructor(private defaults: EngineeringRules = DEFAULT_RULES) {}

  forWorkshop(workshopId?: string): EngineeringRules {
    if (workshopId && this.workshopRules.has(workshopId)) return this.workshopRules.get(workshopId)!;
    return this.defaults;
  }

  /**
   * Rule changes require an authorised human approver (rule 52.11 / §44:
   * never automatically changed, never from sales/marketing data).
   */
  setWorkshopRules(workshopId: string, rules: EngineeringRules, approvedByHuman: string): void {
    if (!approvedByHuman) throw new Error('Engineering rule changes require an authorised human approver');
    this.workshopRules.set(workshopId, rules);
  }
}

export interface ManufacturabilityReview {
  manufacturabilityScore: number; // 0-100
  manufacturingMethod: string;
  productionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  failurePoints: string[];
  requiredChanges: string[];
  recommendedDimensions?: Partial<DesignConcept['dimensions']>;
  prototypeRequired: boolean;
  verdict: 'PASS' | 'FAIL';
}

/** Manufacturing Engineering agent (§10): can the design actually be made? */
export class ManufacturingAgent implements AgentIdentity {
  agentId = 'agent-05-manufacturing';
  capability = 'evaluate' as const;

  constructor(private rules: RuleBook) {}

  review(concept: Artifact<DesignConcept>, workshopId?: string): ManufacturabilityReview {
    assertIndependentEvaluator(this, concept);
    const c = concept.payload;
    const r = this.rules.forWorkshop(workshopId);
    const failures: string[] = [];
    const changes: string[] = [];

    if (c.dimensions.minLineWidthMm < r.minEngravingLineWidthMm) {
      failures.push(`engraving line ${c.dimensions.minLineWidthMm}mm below minimum ${r.minEngravingLineWidthMm}mm`);
      changes.push(`increase minimum line width to >= ${r.minEngravingLineWidthMm}mm`);
    }
    if (c.dimensions.minInternalGapMm < r.minInternalGapMm) {
      failures.push(`internal gap ${c.dimensions.minInternalGapMm}mm below minimum ${r.minInternalGapMm}mm`);
      changes.push(`open internal gaps to >= ${r.minInternalGapMm}mm`);
    }
    if (c.dimensions.hasIsolatedArabicDots && !r.allowIsolatedArabicDots) {
      failures.push('isolated (loose) Arabic dots present');
      changes.push('anchor dots to the base plate or connect via micro-bridges within style rules');
    }
    if (c.dimensions.hasFragileBridges && !r.allowFragileBridges) {
      failures.push('fragile Arabic letter bridges present');
      changes.push('thicken bridges or redesign cutout to remove unsupported spans');
    }
    if (c.dimensions.thicknessMm < 0.8) {
      failures.push(`wall thickness ${c.dimensions.thicknessMm}mm below 0.8mm casting minimum`);
      changes.push('increase base thickness to >= 0.8mm');
    }

    const complexityPenalty = c.complexity === 'HIGH' ? 15 : c.complexity === 'MEDIUM' ? 7 : 0;
    const score = Math.max(0, 100 - failures.length * 30 - complexityPenalty);

    return {
      manufacturabilityScore: score,
      manufacturingMethod: c.manufacturingMethod,
      productionRisk: failures.length > 0 ? 'HIGH' : c.complexity === 'HIGH' ? 'MEDIUM' : 'LOW',
      failurePoints: failures,
      requiredChanges: changes,
      recommendedDimensions:
        failures.length > 0
          ? { minLineWidthMm: Math.max(c.dimensions.minLineWidthMm, r.minEngravingLineWidthMm), minInternalGapMm: Math.max(c.dimensions.minInternalGapMm, r.minInternalGapMm) }
          : undefined,
      prototypeRequired: true, // Release 1: every new design prototypes before production
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    };
  }
}
