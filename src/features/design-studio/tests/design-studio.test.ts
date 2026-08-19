import { describe, expect, it } from 'vitest';
import { DesignVersionStore } from '../versioning.js';
import { assertMateriallyDifferent, ConceptDistinctnessError, CreativeDesignAgent } from '../agents/creative-agent.js';
import { computeReadiness } from '../readiness-score.js';
import { ImmutabilityError } from '../../../platform/kernel.js';
import { DesignBrief, DesignConcept } from '../models/concept.js';

const concept: DesignConcept = {
  conceptName: 'A',
  designStory: 's',
  targetCustomer: 't',
  visualLanguage: 'v1',
  materialId: 'MAT-925',
  dimensions: { lengthMm: 1, widthMm: 1, thicknessMm: 1, minLineWidthMm: 0.4, minInternalGapMm: 0.4, hasIsolatedArabicDots: false, hasFragileBridges: false },
  estimatedWeightG: 1,
  manufacturingMethod: 'cast',
  personalisationOptions: [],
  complexity: 'LOW',
  estimatedCostBand: 'CORE',
  differentiation: 'd',
  risks: [],
  construction: 'c1',
  personalisationMechanic: 'p1',
};

describe('design versioning (§24)', () => {
  it('keeps full version history with lineage', () => {
    const store = new DesignVersionStore();
    const v1 = store.createInitial('des_1', concept, 'system', 'agent-03');
    const v2 = store.revise(v1, { ...concept, estimatedWeightG: 2 }, 'designer', 'weight reduction', ['estimatedWeightG']);
    const history = store.history('des_1');
    expect(history.map((v) => v.versionNo)).toEqual([1, 2]);
    expect(v2.parentVersion).toBe(v1.versionId);
    expect(v2.changeReason).toBe('weight reduction');
  });

  it('approved versions are immutable; revisions fork children (rule 52.7)', () => {
    const store = new DesignVersionStore();
    const v1 = store.createInitial('des_1', concept, 'system');
    store.setApprovalStatus(v1.versionId, 'DESIGN_APPROVED');
    expect(() => store.updateConcept(v1.versionId, { ...concept, estimatedWeightG: 9 })).toThrow(ImmutabilityError);
    store.setApprovalStatus(v1.versionId, 'PRODUCTION_APPROVED');
    expect(() => store.setApprovalStatus(v1.versionId, 'REJECTED')).toThrow(ImmutabilityError);
    const v2 = store.revise(v1, { ...concept, estimatedWeightG: 9 }, 'designer', 'fix', ['estimatedWeightG']);
    expect(v2.versionNo).toBe(2);
  });
});

describe('concept distinctness (§8)', () => {
  it('the creative agent produces 4 materially different concepts (no gateway: deterministic path)', async () => {
    const brief: DesignBrief = {
      briefId: 'b', title: 't', family: 'MEN', productType: 'bracelet',
      customerSegment: 's', customerPersona: 'p', customerProblem: 'c', marketRationale: 'm',
      targetRetailPriceAed: 249, requiredGrossMarginPct: 60, personalisation: true,
      arabicText: 'خالد', isChildProduct: false, isWearableChildProduct: false, isReligiousText: false,
    };
    const concepts = await new CreativeDesignAgent().generateConcepts(brief);
    expect(concepts).toHaveLength(4);
    expect(() => assertMateriallyDifferent(concepts.map((c) => c.payload))).not.toThrow();
  });

  it('rejects cosmetic variations of the same idea', () => {
    const clone = { ...concept, conceptName: 'B', differentiation: 'slightly different words' };
    expect(() => assertMateriallyDifferent([concept, clone])).toThrow(ConceptDistinctnessError);
  });
});

describe('design readiness score (§23)', () => {
  const goodScores = {
    brandFit: 90, manufacturability: 95, originality: 90, commercialViability: 88,
    costFeasibility: 90, aestheticQuality: 85, marketRelevance: 85, personalisationPotential: 80,
  };

  it('releases above 85 with all mandatory passes', () => {
    const r = computeReadiness({ scores: goodScores, safetyPass: true, arabicApplicable: true, arabicPass: true });
    expect(r.releaseReady).toBe(true);
    expect(r.total).toBeGreaterThanOrEqual(85);
  });

  it('safety failure overrides any total (rule 52.10)', () => {
    const r = computeReadiness({ scores: goodScores, safetyPass: false, arabicApplicable: false, arabicPass: true });
    expect(r.releaseReady).toBe(false);
    expect(r.blockingReasons.join(' ')).toContain('safety');
  });

  it('Arabic failure overrides when Arabic is applicable', () => {
    const r = computeReadiness({ scores: goodScores, safetyPass: true, arabicApplicable: true, arabicPass: false });
    expect(r.releaseReady).toBe(false);
  });

  it('per-dimension floor blocks a masked weak dimension', () => {
    const r = computeReadiness({
      scores: { ...goodScores, manufacturability: 30, brandFit: 100, originality: 100, commercialViability: 100 },
      safetyPass: true, arabicApplicable: false, arabicPass: true,
    });
    expect(r.releaseReady).toBe(false);
    expect(r.blockingReasons.join(' ')).toContain('dimension floor');
  });
});
