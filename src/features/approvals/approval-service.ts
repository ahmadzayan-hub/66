import { ApprovalDecision, newId } from '../../platform/kernel.js';
import { AuditLog } from '../../platform/audit/audit-log.js';
import { Principal, Permission, requirePermission } from '../../platform/security/rbac.js';

/** Human approval gates (§45). */
export type ApprovalGate =
  | 'ARABIC_MASTER_ARTWORK'
  | 'RELIGIOUS_TEXT'
  | 'CHILD_PRODUCT'
  | 'NEW_MATERIAL'
  | 'NEW_WORKSHOP_PROCESS'
  | 'HIGH_PRODUCTION_COST'
  | 'UNUSUAL_TECHNIQUE'
  | 'FINAL_PRODUCTION_FILES'
  | 'MASS_PRODUCTION'
  | 'FINAL_DESIGN';

const GATE_PERMISSION: Record<ApprovalGate, Permission> = {
  ARABIC_MASTER_ARTWORK: 'arabic.master.approve',
  RELIGIOUS_TEXT: 'religious.text.approve',
  CHILD_PRODUCT: 'child.product.approve',
  NEW_MATERIAL: 'material.manage',
  NEW_WORKSHOP_PROCESS: 'rules.engineering.change',
  HIGH_PRODUCTION_COST: 'cost.manage',
  UNUSUAL_TECHNIQUE: 'rules.engineering.change',
  FINAL_PRODUCTION_FILES: 'production.release',
  MASS_PRODUCTION: 'production.release',
  FINAL_DESIGN: 'design.approve',
};

export interface ApprovalRecord {
  approvalId: string;
  gate: ApprovalGate;
  subjectId: string;
  submittedBy: string;
  decision: ApprovalDecision;
  comments: string;
  decidedBy: string;
}

export class SelfApprovalError extends Error {}

/**
 * Approval workflow. Only authenticated human principals can decide — agents
 * hold no approval permissions at all. The submitter can never approve their
 * own item (separation of duties mirrored at the human layer).
 */
export class ApprovalService {
  private records: ApprovalRecord[] = [];

  constructor(private audit: AuditLog) {}

  decide(
    gate: ApprovalGate,
    subjectId: string,
    submittedBy: string,
    approver: Principal,
    decision: ApprovalDecision,
    comments = '',
  ): ApprovalRecord {
    requirePermission(approver, GATE_PERMISSION[gate]);
    if (approver.userId === submittedBy) {
      throw new SelfApprovalError(`User ${approver.userId} cannot approve item they submitted (${subjectId})`);
    }
    if (decision !== 'APPROVED' && comments.trim().length === 0) {
      throw new Error('Non-approval decisions require a comment');
    }
    const record: ApprovalRecord = {
      approvalId: newId('apr'),
      gate,
      subjectId,
      submittedBy,
      decision,
      comments,
      decidedBy: approver.userId,
    };
    this.records.push(record);
    this.audit.append({
      actorType: 'human',
      actorId: approver.userId,
      action: `approval:${gate}:${decision}`,
      subjectType: 'approval',
      subjectId,
      detail: record,
    });
    return record;
  }

  forSubject(subjectId: string): ApprovalRecord[] {
    return this.records.filter((r) => r.subjectId === subjectId);
  }
}
