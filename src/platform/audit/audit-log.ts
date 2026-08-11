import { newId } from '../kernel.js';

export interface AuditEntry {
  id: string;
  actorType: 'agent' | 'human' | 'system';
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  detail: unknown;
  at: number;
}

/**
 * Append-only audit log. Release 1 keeps it in memory behind this interface;
 * Release 2 persists to the `audit_logs` table. There is deliberately no
 * update or delete surface.
 */
export class AuditLog {
  private entries: AuditEntry[] = [];
  private seq = 0;

  append(entry: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
    this.seq += 1;
    const full: AuditEntry = { ...entry, id: newId('aud'), at: this.seq };
    this.entries.push(full);
    return full;
  }

  /** Read-only snapshot. */
  all(): readonly AuditEntry[] {
    return [...this.entries];
  }

  bySubject(subjectId: string): readonly AuditEntry[] {
    return this.entries.filter((e) => e.subjectId === subjectId);
  }
}
