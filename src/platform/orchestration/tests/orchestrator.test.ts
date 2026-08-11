import { describe, expect, it } from 'vitest';
import { createSystem } from '../system-factory.js';
import { DesignBrief } from '../../../features/design-studio/models/concept.js';
import { Principal } from '../../security/rbac.js';
import { newId } from '../../kernel.js';

const arabicSpecialist: Principal = { userId: 'user-arabic-01', roles: ['ARABIC_SPECIALIST'], mfaEnrolled: true };

function brief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    briefId: newId('brf'),
    title: "Men's personalised Arabic bracelet",
    family: 'MEN',
    productType: 'bracelet',
    customerSegment: 'UAE residents 25-45',
    customerPersona: 'Khalid, 32, Dubai professional',
    customerProblem: 'authentic Arabic personalisation gap',
    marketRationale: 'gifting seasons',
    targetRetailPriceAed: 249,
    requiredGrossMarginPct: 60,
    personalisation: true,
    arabicText: 'خالد',
    isChildProduct: false,
    isWearableChildProduct: false,
    isReligiousText: false,
    ...overrides,
  };
}

describe('design orchestrator (§5, §51 end-to-end)', () => {
  it('runs the full gate chain to DESIGN_APPROVED for the DoD scenario', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(brief(), { arabicStyle: 'DIWANI', arabicApprover: arabicSpecialist });
    expect(result.blocked).toBe(false);
    expect(result.lifecycle.current).toBe('DESIGN_APPROVED');
    expect(result.allConcepts).toHaveLength(4);
    expect(result.arabicArtwork?.status).toBe('APPROVED');
    expect(result.safety.verdict).toBe('PASS');
    expect(result.qa.verdict).toBe('APPROVED');
    expect(result.readiness.total).toBeGreaterThanOrEqual(85);
    expect(result.cost.withinCeiling).toBe(true);
    // The full chain is audited.
    expect(os.audit.bySubject(result.designId).length).toBeGreaterThan(10);
  });

  it('blocks when the Arabic master artwork lacks human approval (§45)', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(brief()); // no approver supplied
    expect(result.blocked).toBe(true);
    expect(result.blockReasons.join(' ')).toContain('human approval');
    expect(result.lifecycle.current).toBe('REVISION_REQUIRED');
  });

  it('routes invalid Arabic to the Arabic agent via the issue log (§22)', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(brief({ arabicText: 'خالد X' }), { arabicApprover: arabicSpecialist });
    expect(result.blocked).toBe(true);
    const issues = os.issues.open(result.designId);
    expect(issues.some((i) => i.type === 'INCORRECT_ARABIC' && i.routedTo.includes('agent-04-arabic'))).toBe(true);
  });

  it('cost-exceeding designs raise COST_TOO_HIGH routed to cost + design agents', async () => {
    const os = createSystem();
    // Premium concept at an impossible price/margin target.
    const result = await os.orchestrator.runPipeline(
      brief({ targetRetailPriceAed: 99, requiredGrossMarginPct: 70 }),
      { arabicApprover: arabicSpecialist },
    );
    expect(result.blocked).toBe(true);
    const issue = os.issues.open(result.designId).find((i) => i.type === 'COST_TOO_HIGH');
    expect(issue?.routedTo).toEqual(['agent-08-cost', 'agent-03-creative-design']);
  });

  it('unsafe child products are rejected and routed to the safety agent', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(
      brief({ family: 'BABIES_CHILDREN', isChildProduct: true }),
      {
        arabicApprover: arabicSpecialist,
        // Select the leather braid with slider bead: detachable-part hazard for children.
        conceptSelector: (concepts) => concepts.find((c) => c.payload.conceptName === 'Falaj Braid')!,
      },
    );
    expect(result.blocked).toBe(true);
    expect(result.safety.verdict).toBe('FAIL');
    expect(result.lifecycle.current).toBe('REVISION_REQUIRED');
    expect(os.issues.open(result.designId).some((i) => i.type === 'UNSAFE_BABY_PRODUCT')).toBe(true);
  });

  it('records the explicit Arabic skip for non-Arabic designs (no silent skipping)', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(brief({ arabicText: undefined }), {});
    const reasons = result.lifecycle.transitions.map((t) => t.reason);
    expect(reasons.some((r) => r.includes('SKIPPED_ARABIC_REVIEW'))).toBe(true);
  });

  it('the orchestrator never approves: DESIGN_APPROVED requires QA APPROVED', async () => {
    const os = createSystem();
    const result = await os.orchestrator.runPipeline(brief({ targetRetailPriceAed: 99, requiredGrossMarginPct: 70 }), { arabicApprover: arabicSpecialist });
    // QA did not approve, so the orchestrator could not advance to DESIGN_APPROVED.
    expect(result.qa.verdict).not.toBe('APPROVED');
    expect(result.lifecycle.current).toBe('REVISION_REQUIRED');
  });
});
