import { AgentIdentity, Artifact, assertIndependentEvaluator } from '../../platform/kernel.js';
import { DesignConcept } from '../design-studio/models/concept.js';

export interface OriginalityReview {
  originalityScore: number; // 0-100
  similarityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialIpIssue: boolean;
  recommendedModification?: string;
  verdict: 'PASS' | 'HUMAN_REVIEW_REQUIRED';
}

/** Known protected motifs/marks the catalogue must never reproduce (seed list). */
const PROTECTED_MOTIFS = [/cartier/i, /van\s?cleef/i, /alhambra/i, /tiffany/i, /pandora\s?charm/i, /love\s?bracelet/i, /disney|mickey|marvel/i];

/**
 * Originality & IP agent (§13). Reference images may inform, never be copied;
 * uncertain IP ownership escalates to human review (§46) rather than guessing.
 */
export class OriginalityAgent implements AgentIdentity {
  agentId = 'agent-07-originality';
  capability = 'evaluate' as const;

  review(concept: Artifact<DesignConcept>, referenceNotes: string[] = []): OriginalityReview {
    assertIndependentEvaluator(this, concept);
    const c = concept.payload;
    const text = `${c.conceptName} ${c.designStory} ${c.visualLanguage} ${referenceNotes.join(' ')}`;

    const protectedHit = PROTECTED_MOTIFS.some((m) => m.test(text));
    if (protectedHit) {
      return {
        originalityScore: 10,
        similarityRisk: 'HIGH',
        potentialIpIssue: true,
        recommendedModification: 'Remove protected motif/mark references and redesign the signature element',
        verdict: 'HUMAN_REVIEW_REQUIRED',
      };
    }

    const derivedFromReference = referenceNotes.some((n) => /copy|replica|same as|identical/i.test(n));
    if (derivedFromReference) {
      return {
        originalityScore: 25,
        similarityRisk: 'HIGH',
        potentialIpIssue: true,
        recommendedModification: 'Reference may inform mood only; rebuild geometry from brand DNA elements',
        verdict: 'HUMAN_REVIEW_REQUIRED',
      };
    }

    const distinctiveSignals = [c.differentiation.length > 20, /uae|majlis|falaj|dune|arabic/i.test(text), c.construction.length > 0];
    const score = 60 + distinctiveSignals.filter(Boolean).length * 12;
    return {
      originalityScore: Math.min(100, score),
      similarityRisk: score > 80 ? 'LOW' : 'MEDIUM',
      potentialIpIssue: false,
      verdict: 'PASS',
    };
  }
}
