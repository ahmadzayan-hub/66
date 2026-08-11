import { AuditLog } from '../audit/audit-log.js';
import { newId } from '../kernel.js';

/** Domain events (§37, Release 1 subset). */
export type DomainEventType =
  | 'DesignBriefCreated'
  | 'ConceptGenerated'
  | 'BrandReviewCompleted'
  | 'ArabicValidationFailed'
  | 'ArabicMasterArtworkApproved'
  | 'EngineeringReviewFailed'
  | 'SafetyRejected'
  | 'CostExceeded'
  | 'CommercialReviewCompleted'
  | 'RevisionRequired'
  | 'DesignApproved'
  | 'VectorPrepared'
  | 'ProductionApproved'
  | 'HumanReviewRequired'
  | 'PrototypeRequested'
  | 'ProductPublished';

export interface DomainEvent {
  eventId: string;
  type: DomainEventType;
  designId?: string;
  versionId?: string;
  emitterAgentId: string;
  payload: unknown;
}

type Handler = (event: DomainEvent) => void;

/**
 * In-process pub/sub. Every event is appended to the audit log BEFORE
 * delivery so a crash mid-delivery never loses the fact that it happened
 * (critical-review fix #2.3). Duplicate event ids are dropped (idempotency).
 */
export class EventBus {
  private handlers = new Map<DomainEventType, Handler[]>();
  private delivered = new Set<string>();

  constructor(private audit: AuditLog) {}

  subscribe(type: DomainEventType, handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  publish(event: Omit<DomainEvent, 'eventId'>): DomainEvent {
    const full: DomainEvent = { ...event, eventId: newId('evt') };
    this.audit.append({
      actorType: 'agent',
      actorId: event.emitterAgentId,
      action: `event:${event.type}`,
      subjectType: 'design',
      subjectId: event.designId ?? 'n/a',
      detail: event.payload,
    });
    if (this.delivered.has(full.eventId)) return full;
    this.delivered.add(full.eventId);
    for (const handler of this.handlers.get(full.type) ?? []) handler(full);
    return full;
  }
}
