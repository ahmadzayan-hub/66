import { AgentIdentity, Artifact, assertIndependentEvaluator } from '../../platform/kernel.js';
import { DesignConcept } from '../design-studio/models/concept.js';

/** Beyond Style UAE Brand DNA (§7). */
export const BRAND_DNA = {
  attributes: [
    'Modern Arabic luxury',
    'Accessible premium positioning',
    'Personalisation',
    'Meaningful gifting',
    'Contemporary UAE character',
    'Craftsmanship',
    'Elegant minimalism',
    'Strong product photography',
    'Distinctive details',
    'Manufacturable creativity',
  ],
} as const;

export interface BrandReview {
  brandFitScore: number; // 0-100
  matchedAttributes: string[];
  gaps: string[];
}

/**
 * Brand DNA agent (evaluate-only). Fixed rubric in code — evaluators never
 * see release thresholds in their inputs (critical review §4).
 */
export class BrandDnaAgent implements AgentIdentity {
  agentId = 'agent-02-brand-dna';
  capability = 'evaluate' as const;

  review(concept: Artifact<DesignConcept>): BrandReview {
    assertIndependentEvaluator(this, concept);
    const c = concept.payload;
    const matched: string[] = [];
    const gaps: string[] = [];

    const checks: [string, boolean][] = [
      ['Modern Arabic luxury', c.visualLanguage.toLowerCase().includes('arabic') || c.personalisationOptions.some((p) => p.includes('arabic'))],
      ['Personalisation', c.personalisationOptions.length > 0],
      ['Meaningful gifting', c.designStory.length > 40],
      ['Contemporary UAE character', /uae|emirat|dubai|falcon|dune|desert|palm|arabesque/i.test(c.designStory + c.visualLanguage)],
      ['Elegant minimalism', c.complexity !== 'HIGH'],
      ['Distinctive details', c.differentiation.length > 0],
      ['Manufacturable creativity', c.manufacturingMethod.length > 0],
      ['Accessible premium positioning', c.estimatedCostBand !== 'PREMIUM' || c.personalisationOptions.length > 0],
      ['Craftsmanship', /hand|craft|finish|polish/i.test(c.designStory + c.manufacturingMethod)],
    ];
    for (const [attribute, hit] of checks) (hit ? matched : gaps).push(attribute);

    const brandFitScore = Math.round((matched.length / checks.length) * 100);
    return { brandFitScore, matchedAttributes: matched, gaps };
  }
}
