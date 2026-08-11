/**
 * Shared kernel: the minimal cross-feature vocabulary of the OS.
 * Everything else lives inside its feature slice (Common Closure Principle).
 */

export type AgentCapability = 'generate' | 'evaluate' | 'export';

export interface AgentIdentity {
  agentId: string;
  capability: AgentCapability;
}

/** Verdicts an evaluating agent may return. */
export type GateVerdict =
  | 'PASS'
  | 'PASS_WITH_CONDITIONS'
  | 'FAIL'
  | 'HUMAN_REVIEW_REQUIRED';

/** Independent QA outcomes (§19). */
export type QaVerdict =
  | 'APPROVED'
  | 'REVISION_REQUIRED'
  | 'REJECTED'
  | 'HUMAN_REVIEW_REQUIRED';

/** Human approval outcomes (§45). */
export type ApprovalDecision =
  | 'APPROVED'
  | 'APPROVED_WITH_COMMENTS'
  | 'REVISION_REQUIRED'
  | 'REJECTED';

/** Data privacy classes (§41). */
export type DataClass =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'CUSTOMER_PII'
  | 'RESTRICTED_PRODUCTION';

let idCounter = 0;
/** Deterministic, monotonic ids — stable for tests and audit replay. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${String(idCounter).padStart(6, '0')}`;
}

/** Reset id counter (test isolation only). */
export function resetIds(): void {
  idCounter = 0;
}

export interface Artifact<T = unknown> {
  artifactId: string;
  kind: string;
  /** Agent ids that participated in generating this artifact (lineage). */
  generatedBy: string[];
  payload: T;
  /** Content immutability marker: once true, mutation attempts must throw. */
  immutable: boolean;
}

export function makeArtifact<T>(kind: string, generatedBy: string[], payload: T): Artifact<T> {
  return { artifactId: newId('art'), kind, generatedBy, payload, immutable: false };
}

export class SeparationOfDutiesError extends Error {}
export class ImmutabilityError extends Error {}

/**
 * Separation of duties (master prompt §2, rule 52.8): an evaluator may never
 * evaluate an artifact whose generation lineage contains itself.
 */
export function assertIndependentEvaluator(evaluator: AgentIdentity, artifact: Artifact): void {
  if (artifact.generatedBy.includes(evaluator.agentId)) {
    throw new SeparationOfDutiesError(
      `Agent ${evaluator.agentId} cannot evaluate artifact ${artifact.artifactId} it helped generate`,
    );
  }
}
