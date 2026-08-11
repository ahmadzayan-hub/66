import { describe, expect, it } from 'vitest';
import { DesignLifecycle, IllegalTransition } from '../state-machine.js';
import { AuditLog } from '../../audit/audit-log.js';

const sys = { type: 'system' as const, id: 'test' };

function lifecycle() {
  return new DesignLifecycle('des_test', 'ver_test', new AuditLog());
}

describe('design lifecycle state machine (§21)', () => {
  it('walks the full happy path in order', () => {
    const lc = lifecycle();
    const path = [
      'RESEARCHING', 'BRIEF_APPROVED', 'CONCEPT_CREATED', 'BRAND_REVIEW', 'ARABIC_REVIEW',
      'ENGINEERING_REVIEW', 'SAFETY_REVIEW', 'COST_REVIEW', 'COMMERCIAL_REVIEW',
      'DESIGN_APPROVED', 'VECTOR_PREPARED', 'CAD_PREPARED', 'PROTOTYPE_REQUESTED',
      'PROTOTYPE_RECEIVED', 'PROTOTYPE_REVIEW', 'PRODUCTION_APPROVED', 'CATALOGUE_READY',
      'MARKETING_READY', 'LIVE',
    ] as const;
    for (const state of path) lc.transition(state, sys, 'test');
    expect(lc.current).toBe('LIVE');
    expect(lc.transitions).toHaveLength(path.length);
  });

  it('rejects silent state skipping', () => {
    const lc = lifecycle();
    lc.transition('RESEARCHING', sys, 't');
    lc.transition('BRIEF_APPROVED', sys, 't');
    // Cannot jump straight to production approval
    expect(() => lc.transition('PRODUCTION_APPROVED', sys, 't')).toThrow(IllegalTransition);
    // Cannot skip safety review
    lc.transition('CONCEPT_CREATED', sys, 't');
    lc.transition('BRAND_REVIEW', sys, 't');
    lc.transition('ARABIC_REVIEW', sys, 't');
    lc.transition('ENGINEERING_REVIEW', sys, 't');
    expect(() => lc.transition('COST_REVIEW', sys, 't')).toThrow(IllegalTransition);
  });

  it('allows skipping ARABIC_REVIEW only via the explicit recorded skip', () => {
    const lc = lifecycle();
    lc.transition('RESEARCHING', sys, 't');
    lc.transition('BRIEF_APPROVED', sys, 't');
    lc.transition('CONCEPT_CREATED', sys, 't');
    lc.transition('BRAND_REVIEW', sys, 't');
    // Direct BRAND_REVIEW -> ENGINEERING_REVIEW is illegal
    expect(() => lc.transition('ENGINEERING_REVIEW', sys, 't')).toThrow(IllegalTransition);
    lc.skipArabicReview(sys);
    expect(lc.current).toBe('ENGINEERING_REVIEW');
    // The skip is recorded, not silent
    const reasons = lc.transitions.map((t) => t.reason);
    expect(reasons.some((r) => r.includes('SKIPPED_ARABIC_REVIEW'))).toBe(true);
  });

  it('REVISION_REQUIRED is reachable from review states and re-enters the failed gate', () => {
    const lc = lifecycle();
    lc.transition('RESEARCHING', sys, 't');
    lc.transition('BRIEF_APPROVED', sys, 't');
    lc.transition('CONCEPT_CREATED', sys, 't');
    lc.transition('BRAND_REVIEW', sys, 't');
    lc.transition('ARABIC_REVIEW', sys, 't');
    lc.transition('ENGINEERING_REVIEW', sys, 't');
    lc.transition('REVISION_REQUIRED', sys, 'thin walls');
    lc.transition('ENGINEERING_REVIEW', sys, 'revised geometry');
    expect(lc.current).toBe('ENGINEERING_REVIEW');
  });

  it('resumes from PAUSED to the exact prior state only', () => {
    const lc = lifecycle();
    for (const s of ['RESEARCHING', 'BRIEF_APPROVED', 'CONCEPT_CREATED', 'BRAND_REVIEW', 'ARABIC_REVIEW', 'ENGINEERING_REVIEW', 'SAFETY_REVIEW', 'COST_REVIEW', 'COMMERCIAL_REVIEW', 'DESIGN_APPROVED', 'VECTOR_PREPARED', 'CAD_PREPARED', 'PROTOTYPE_REQUESTED'] as const) {
      lc.transition(s, sys, 't');
    }
    lc.transition('PAUSED', sys, 'supplier delay');
    expect(() => lc.transition('LIVE', sys, 't')).toThrow(IllegalTransition);
    lc.transition('PROTOTYPE_REQUESTED', sys, 'resume');
    expect(lc.current).toBe('PROTOTYPE_REQUESTED');
  });

  it('RETIRED is terminal', () => {
    const lc = lifecycle();
    lc.transition('RETIRED', sys, 'abandoned idea');
    expect(() => lc.transition('RESEARCHING', sys, 't')).toThrow(IllegalTransition);
  });
});
