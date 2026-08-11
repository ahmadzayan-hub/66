import { AgentIdentity, Artifact, assertIndependentEvaluator, GateVerdict } from '../../platform/kernel.js';
import { DesignBrief, DesignConcept } from '../design-studio/models/concept.js';
import { MaterialRepository } from '../materials/materials.js';

export interface SafetyHazard {
  hazard: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

export interface SafetyReview {
  verdict: GateVerdict; // PASS | PASS_WITH_CONDITIONS | FAIL | HUMAN_REVIEW_REQUIRED
  hazards: SafetyHazard[];
  conditions: string[];
  childCategoryRulesApplied: boolean;
}

/** Hazard classes that auto-reject/escalate for babies & children (§3). */
const CHILD_AUTO_REJECT = [
  'choking hazard',
  'small detachable component',
  'unsafe chain length',
  'strangulation hazard',
  'sharp edge',
  'weak clasp',
  'unsafe stone',
  'magnet',
  'unverified coating',
  'toxic material',
  'fragile attachment',
];

/**
 * Product Safety agent (§12). FAIL is absolute: no approval path exists past
 * a FAIL verdict (rule 52.10 — commercial optimisation never overrides safety).
 */
export class SafetyAgent implements AgentIdentity {
  agentId = 'agent-06-safety';
  capability = 'evaluate' as const;

  constructor(private materials: MaterialRepository) {}

  review(brief: DesignBrief, concept: Artifact<DesignConcept>): SafetyReview {
    assertIndependentEvaluator(this, concept);
    const c = concept.payload;
    const hazards: SafetyHazard[] = [];
    const conditions: string[] = [];
    const material = this.materials.get(c.materialId);

    // General wearable checks
    if (c.dimensions.thicknessMm < material.minimumThicknessMm) {
      hazards.push({ hazard: 'structural weakness: below material minimum thickness', severity: 'MAJOR' });
    }
    if (c.risks.some((r) => /sharp/i.test(r))) {
      hazards.push({ hazard: 'sharp edge risk flagged by design', severity: 'MAJOR' });
    }
    if (/magnet/i.test(c.manufacturingMethod + c.construction)) {
      hazards.push({ hazard: 'magnet component', severity: brief.isChildProduct ? 'CRITICAL' : 'MINOR' });
    }

    // Child category (§3): separate safety-controlled category.
    if (brief.isChildProduct) {
      if (material.safetyRestrictions.some((r) => /babies-children/i.test(r))) {
        hazards.push({ hazard: `toxic material / restricted material for children: ${material.materialName}`, severity: 'CRITICAL' });
      }
      const text = `${c.designStory} ${c.construction} ${c.risks.join(' ')}`.toLowerCase();
      for (const hazard of CHILD_AUTO_REJECT) {
        if (text.includes(hazard.split(' ')[0]!)) {
          hazards.push({ hazard: `child category: ${hazard}`, severity: 'CRITICAL' });
        }
      }
      // Small parts on a child product are detachable-component hazards.
      if (/bead|charm|slider/i.test(c.construction)) {
        hazards.push({ hazard: 'child category: small detachable component (bead/charm/slider)', severity: 'CRITICAL' });
      }
      // Wearable child products always require dedicated human safety approval.
      if (brief.isWearableChildProduct && !hazards.some((h) => h.severity === 'CRITICAL')) {
        conditions.push('Wearable child product: dedicated human safety approval required before any release');
        return { verdict: 'HUMAN_REVIEW_REQUIRED', hazards, conditions, childCategoryRulesApplied: true };
      }
    }

    const critical = hazards.filter((h) => h.severity === 'CRITICAL');
    const major = hazards.filter((h) => h.severity === 'MAJOR');

    if (critical.length > 0) {
      return { verdict: 'FAIL', hazards, conditions, childCategoryRulesApplied: brief.isChildProduct };
    }
    if (major.length > 0) {
      conditions.push(...major.map((h) => `resolve before production: ${h.hazard}`));
      return { verdict: 'FAIL', hazards, conditions, childCategoryRulesApplied: brief.isChildProduct };
    }
    if (hazards.length > 0) {
      conditions.push('minor hazards documented; QC check at prototype stage');
      return { verdict: 'PASS_WITH_CONDITIONS', hazards, conditions, childCategoryRulesApplied: brief.isChildProduct };
    }
    return { verdict: 'PASS', hazards, conditions, childCategoryRulesApplied: brief.isChildProduct };
  }
}
