import { describe, expect, it } from 'vitest';
import { SafetyAgent } from '../safety-agent.js';
import { MaterialRepository, seedMaterials } from '../../materials/materials.js';
import { makeArtifact } from '../../../platform/kernel.js';
import { DesignBrief, DesignConcept } from '../../design-studio/models/concept.js';

function repo() {
  const materials = new MaterialRepository();
  seedMaterials(materials);
  return materials;
}

const baseConcept: DesignConcept = {
  conceptName: 'Test piece',
  designStory: 'A commemorative keepsake plaque for newborn gifts, hand finished.',
  targetCustomer: 'parents',
  visualLanguage: 'minimal',
  materialId: 'MAT-925',
  dimensions: { lengthMm: 60, widthMm: 40, thicknessMm: 2, minLineWidthMm: 0.4, minInternalGapMm: 0.4, hasIsolatedArabicDots: false, hasFragileBridges: false },
  estimatedWeightG: 20,
  manufacturingMethod: 'cast + laser engraving',
  personalisationOptions: ['name'],
  complexity: 'LOW',
  estimatedCostBand: 'CORE',
  differentiation: 'birth-date constellation etching',
  risks: [],
  construction: 'solid plaque',
  personalisationMechanic: 'engraving',
};

const childBrief: DesignBrief = {
  briefId: 'brf_t',
  title: 'baby keepsake',
  family: 'BABIES_CHILDREN',
  productType: 'keepsake',
  customerSegment: 'parents',
  customerPersona: 'parent',
  customerProblem: 'meaningful newborn gift',
  marketRationale: 'gifting',
  targetRetailPriceAed: 199,
  requiredGrossMarginPct: 55,
  personalisation: true,
  isChildProduct: true,
  isWearableChildProduct: false,
  isReligiousText: false,
};

describe('safety agent (§12, §3)', () => {
  it('passes a safe non-wearable child keepsake', () => {
    const agent = new SafetyAgent(repo());
    const verdict = agent.review(childBrief, makeArtifact('c', ['agent-03-creative-design'], baseConcept));
    expect(verdict.verdict).toBe('PASS');
    expect(verdict.childCategoryRulesApplied).toBe(true);
  });

  it('FAILs a child product with detachable small parts (choking hazard class)', () => {
    const agent = new SafetyAgent(repo());
    const risky = { ...baseConcept, construction: 'braid with silver slider bead' };
    const verdict = agent.review(childBrief, makeArtifact('c', ['agent-03-creative-design'], risky));
    expect(verdict.verdict).toBe('FAIL');
    expect(verdict.hazards.some((h) => h.severity === 'CRITICAL')).toBe(true);
  });

  it('FAILs magnets on child products', () => {
    const agent = new SafetyAgent(repo());
    const magnetic = { ...baseConcept, construction: 'plaque with magnet mount' };
    const verdict = agent.review(childBrief, makeArtifact('c', ['x'], magnetic));
    expect(verdict.verdict).toBe('FAIL');
  });

  it('FAILs restricted materials for the child category', () => {
    const agent = new SafetyAgent(repo());
    const leather = { ...baseConcept, materialId: 'MAT-LEATHER' };
    const verdict = agent.review(childBrief, makeArtifact('c', ['x'], leather));
    expect(verdict.verdict).toBe('FAIL');
  });

  it('wearable child products always require dedicated human safety approval', () => {
    const agent = new SafetyAgent(repo());
    const wearableBrief = { ...childBrief, isWearableChildProduct: true };
    const verdict = agent.review(wearableBrief, makeArtifact('c', ['x'], baseConcept));
    expect(verdict.verdict).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('flags structural weakness below material minimum thickness', () => {
    const agent = new SafetyAgent(repo());
    const thin = { ...baseConcept, dimensions: { ...baseConcept.dimensions, thicknessMm: 0.5 } };
    const adultBrief = { ...childBrief, isChildProduct: false, family: 'MEN' as const };
    const verdict = agent.review(adultBrief, makeArtifact('c', ['x'], thin));
    expect(verdict.verdict).toBe('FAIL');
  });
});
