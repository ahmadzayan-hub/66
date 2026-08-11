import { describe, expect, it } from 'vitest';
import { ManufacturingAgent, RuleBook, DEFAULT_RULES } from '../manufacturing-agent.js';
import { makeArtifact } from '../../../platform/kernel.js';
import { DesignConcept } from '../../design-studio/models/concept.js';

const concept = (overrides: Partial<DesignConcept['dimensions']> = {}): DesignConcept => ({
  conceptName: 'Test',
  designStory: 'test',
  targetCustomer: 'test',
  visualLanguage: 'test',
  materialId: 'MAT-925',
  dimensions: {
    lengthMm: 200, widthMm: 8, thicknessMm: 1.6,
    minLineWidthMm: 0.4, minInternalGapMm: 0.4,
    hasIsolatedArabicDots: false, hasFragileBridges: false,
    ...overrides,
  },
  estimatedWeightG: 10,
  manufacturingMethod: 'cast + laser',
  personalisationOptions: [],
  complexity: 'LOW',
  estimatedCostBand: 'CORE',
  differentiation: 'x',
  risks: [],
  construction: 'plate',
  personalisationMechanic: 'engraving',
});

const art = (c: DesignConcept) => makeArtifact('c', ['agent-03-creative-design'], c);

describe('manufacturing agent (§10, §11)', () => {
  it('passes compliant geometry', () => {
    const agent = new ManufacturingAgent(new RuleBook());
    const review = agent.review(art(concept()));
    expect(review.verdict).toBe('PASS');
    expect(review.prototypeRequired).toBe(true);
  });

  it('fails engraving lines below the 0.30mm default threshold', () => {
    const agent = new ManufacturingAgent(new RuleBook());
    const review = agent.review(art(concept({ minLineWidthMm: 0.2 })));
    expect(review.verdict).toBe('FAIL');
    expect(review.requiredChanges.join(' ')).toContain('0.3');
  });

  it('fails internal gaps below threshold and recommends corrected dimensions', () => {
    const agent = new ManufacturingAgent(new RuleBook());
    const review = agent.review(art(concept({ minInternalGapMm: 0.2 })));
    expect(review.verdict).toBe('FAIL');
    expect(review.recommendedDimensions?.minInternalGapMm).toBeGreaterThanOrEqual(0.35);
  });

  it('fails isolated Arabic dots and fragile bridges', () => {
    const agent = new ManufacturingAgent(new RuleBook());
    expect(agent.review(art(concept({ hasIsolatedArabicDots: true }))).verdict).toBe('FAIL');
    expect(agent.review(art(concept({ hasFragileBridges: true }))).verdict).toBe('FAIL');
  });

  it('workshop-specific rules override defaults (§11: defaults, not universal rules)', () => {
    const book = new RuleBook();
    book.setWorkshopRules('WS-FINE', { ...DEFAULT_RULES, minEngravingLineWidthMm: 0.15, minInternalGapMm: 0.2 }, 'user-mfg-01');
    const agent = new ManufacturingAgent(book);
    const fine = art(concept({ minLineWidthMm: 0.2, minInternalGapMm: 0.25 }));
    expect(agent.review(fine, 'WS-FINE').verdict).toBe('PASS');
    expect(agent.review(art(concept({ minLineWidthMm: 0.2, minInternalGapMm: 0.25 }))).verdict).toBe('FAIL');
  });

  it('engineering rule changes require an authorised human approver (rule 52.11)', () => {
    const book = new RuleBook();
    expect(() => book.setWorkshopRules('WS-X', DEFAULT_RULES, '')).toThrow(/authorised human/);
  });
});
