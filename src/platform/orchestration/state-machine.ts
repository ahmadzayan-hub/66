import { AuditLog } from '../audit/audit-log.js';

/** Design lifecycle states (§21). */
export const DESIGN_STATES = [
  'IDEA',
  'RESEARCHING',
  'BRIEF_APPROVED',
  'CONCEPT_CREATED',
  'BRAND_REVIEW',
  'ARABIC_REVIEW',
  'ENGINEERING_REVIEW',
  'SAFETY_REVIEW',
  'COST_REVIEW',
  'COMMERCIAL_REVIEW',
  'REVISION_REQUIRED',
  'DESIGN_APPROVED',
  'VECTOR_PREPARED',
  'CAD_PREPARED',
  'PROTOTYPE_REQUESTED',
  'PROTOTYPE_RECEIVED',
  'PROTOTYPE_REVIEW',
  'PRODUCTION_APPROVED',
  'CATALOGUE_READY',
  'MARKETING_READY',
  'LIVE',
  'PAUSED',
  'RETIRED',
] as const;

export type DesignState = (typeof DESIGN_STATES)[number];

const REVIEW_STATES: DesignState[] = [
  'BRAND_REVIEW',
  'ARABIC_REVIEW',
  'ENGINEERING_REVIEW',
  'SAFETY_REVIEW',
  'COST_REVIEW',
  'COMMERCIAL_REVIEW',
  'PROTOTYPE_REVIEW',
];

/** Declared legal edges. Anything not listed throws IllegalTransition. */
const EDGES: Record<DesignState, DesignState[]> = {
  IDEA: ['RESEARCHING', 'BRIEF_APPROVED', 'RETIRED'],
  RESEARCHING: ['BRIEF_APPROVED', 'RETIRED'],
  BRIEF_APPROVED: ['CONCEPT_CREATED'],
  CONCEPT_CREATED: ['BRAND_REVIEW'],
  BRAND_REVIEW: ['ARABIC_REVIEW', 'REVISION_REQUIRED'],
  // ENGINEERING_REVIEW is reachable from ARABIC_REVIEW normally, or from
  // BRAND_REVIEW only via the explicit recorded-skip API (skipArabicReview).
  ARABIC_REVIEW: ['ENGINEERING_REVIEW', 'REVISION_REQUIRED'],
  ENGINEERING_REVIEW: ['SAFETY_REVIEW', 'REVISION_REQUIRED'],
  SAFETY_REVIEW: ['COST_REVIEW', 'REVISION_REQUIRED'],
  COST_REVIEW: ['COMMERCIAL_REVIEW', 'REVISION_REQUIRED'],
  COMMERCIAL_REVIEW: ['DESIGN_APPROVED', 'REVISION_REQUIRED'],
  REVISION_REQUIRED: [...REVIEW_STATES, 'CONCEPT_CREATED', 'RETIRED'],
  DESIGN_APPROVED: ['VECTOR_PREPARED', 'REVISION_REQUIRED'],
  VECTOR_PREPARED: ['CAD_PREPARED'],
  CAD_PREPARED: ['PROTOTYPE_REQUESTED'],
  PROTOTYPE_REQUESTED: ['PROTOTYPE_RECEIVED', 'PAUSED'],
  PROTOTYPE_RECEIVED: ['PROTOTYPE_REVIEW'],
  PROTOTYPE_REVIEW: ['PRODUCTION_APPROVED', 'REVISION_REQUIRED'],
  PRODUCTION_APPROVED: ['CATALOGUE_READY', 'PAUSED'],
  CATALOGUE_READY: ['MARKETING_READY', 'PAUSED'],
  MARKETING_READY: ['LIVE', 'PAUSED'],
  LIVE: ['PAUSED', 'RETIRED'],
  PAUSED: ['RETIRED'], // plus dynamic resume to the exact prior state
  RETIRED: [],
};

export class IllegalTransition extends Error {}

export interface TransitionRecord {
  designId: string;
  versionId: string;
  from: DesignState;
  to: DesignState;
  actorType: 'agent' | 'human' | 'system';
  actorId: string;
  reason: string;
}

/**
 * Lifecycle state machine. No silent skipping: every change is an explicit,
 * audited transition along a declared edge; the only sanctioned skip
 * (ARABIC_REVIEW for designs without Arabic) is its own recorded API.
 */
export class DesignLifecycle {
  private state: DesignState = 'IDEA';
  private history: TransitionRecord[] = [];
  private pausedFrom: DesignState | null = null;

  constructor(
    public readonly designId: string,
    public versionId: string,
    private audit: AuditLog,
  ) {}

  get current(): DesignState {
    return this.state;
  }

  get transitions(): readonly TransitionRecord[] {
    return [...this.history];
  }

  transition(to: DesignState, actor: { type: 'agent' | 'human' | 'system'; id: string }, reason: string): void {
    const from = this.state;
    const legal =
      EDGES[from].includes(to) ||
      (from === 'PAUSED' && to === this.pausedFrom); // resume to exact prior state
    if (!legal) {
      this.audit.append({
        actorType: actor.type,
        actorId: actor.id,
        action: 'transition:REJECTED',
        subjectType: 'design',
        subjectId: this.designId,
        detail: { from, to, reason },
      });
      throw new IllegalTransition(`Illegal transition ${from} -> ${to} for ${this.designId}`);
    }
    if (to === 'PAUSED') this.pausedFrom = from;
    if (from === 'PAUSED') this.pausedFrom = null;
    const record: TransitionRecord = {
      designId: this.designId,
      versionId: this.versionId,
      from,
      to,
      actorType: actor.type,
      actorId: actor.id,
      reason,
    };
    this.history.push(record);
    this.audit.append({
      actorType: actor.type,
      actorId: actor.id,
      action: 'transition',
      subjectType: 'design',
      subjectId: this.designId,
      detail: record,
    });
    this.state = to;
  }

  /**
   * The single sanctioned skip: a design with no Arabic content bypasses
   * ARABIC_REVIEW via an explicit recorded skip event (critical-review fix).
   */
  skipArabicReview(actor: { type: 'agent' | 'human' | 'system'; id: string }): void {
    if (this.state !== 'BRAND_REVIEW') {
      throw new IllegalTransition(`ARABIC_REVIEW skip only valid from BRAND_REVIEW, was ${this.state}`);
    }
    this.transition('ARABIC_REVIEW', actor, 'entering arabic gate to record sanctioned skip');
    this.transition('ENGINEERING_REVIEW', actor, 'SKIPPED_ARABIC_REVIEW: design contains no Arabic content');
  }
}
