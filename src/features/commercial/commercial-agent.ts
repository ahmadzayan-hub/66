import { AgentIdentity, Artifact, assertIndependentEvaluator } from '../../platform/kernel.js';
import { DesignConcept } from '../design-studio/models/concept.js';
import { CostReview } from '../costing/cost-engine.js';

export interface CommercialReview {
  commercialViabilityScore: number; // 0-100
  breakdown: Record<string, number>;
}

/** Commercial Viability agent (§15). Fixed rubric; evaluate-only. */
export class CommercialAgent implements AgentIdentity {
  agentId = 'agent-09-commercial';
  capability = 'evaluate' as const;

  review(concept: Artifact<DesignConcept>, cost: CostReview): CommercialReview {
    assertIndependentEvaluator(this, concept);
    const c = concept.payload;
    const dims: Record<string, number> = {
      marketAppeal: /uae|arabic|heritage|majlis|dune|falaj/i.test(c.designStory) ? 85 : 60,
      margin: Math.max(0, Math.min(100, Math.round(cost.cost.contributionMarginPct * 2))),
      personalisationPotential: Math.min(100, c.personalisationOptions.length * 45),
      giftPotential: /gift/i.test(c.designStory) ? 90 : 70,
      visualAttractiveness: c.differentiation ? 80 : 55,
      repeatability: c.complexity === 'LOW' ? 90 : c.complexity === 'MEDIUM' ? 75 : 55,
      productionComplexity: c.complexity === 'LOW' ? 90 : c.complexity === 'MEDIUM' ? 70 : 45,
      socialMediaAppeal: /negative-space|two-tone|sculptural|contrast/i.test(c.visualLanguage + c.differentiation) ? 85 : 65,
      crossSellingPotential: c.personalisationOptions.length > 1 ? 80 : 60,
      conversionPotential: cost.withinCeiling ? 80 : 40,
      marketDifferentiation: c.differentiation.length > 20 ? 85 : 60,
    };
    const values = Object.values(dims);
    const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return { commercialViabilityScore: score, breakdown: dims };
  }
}
