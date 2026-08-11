import { newId } from '../kernel.js';

/** Automatic correction routing (§22). */
export type IssueType =
  | 'INCORRECT_ARABIC'
  | 'FRAGILE_GEOMETRY'
  | 'COST_TOO_HIGH'
  | 'UNSAFE_BABY_PRODUCT'
  | 'COPIED_APPEARANCE'
  | 'WEAK_BRAND_IDENTITY'
  | 'LOW_MARGIN'
  | 'POOR_RENDER_CONSISTENCY';

export const CORRECTION_ROUTES: Record<IssueType, string[]> = {
  INCORRECT_ARABIC: ['agent-04-arabic'],
  FRAGILE_GEOMETRY: ['agent-05-manufacturing'],
  COST_TOO_HIGH: ['agent-08-cost', 'agent-03-creative-design'],
  UNSAFE_BABY_PRODUCT: ['agent-06-safety'],
  COPIED_APPEARANCE: ['agent-07-originality'],
  WEAK_BRAND_IDENTITY: ['agent-02-brand-dna'],
  LOW_MARGIN: ['agent-09-commercial', 'agent-08-cost'],
  POOR_RENDER_CONSISTENCY: ['agent-11-visualisation'],
};

export interface Issue {
  issueId: string;
  designId: string;
  versionId: string;
  type: IssueType;
  detectedBy: string;
  routedTo: string[];
  detail: string;
  status: 'OPEN' | 'RESOLVED';
}

export class IssueLog {
  private issues: Issue[] = [];

  raise(designId: string, versionId: string, type: IssueType, detectedBy: string, detail: string): Issue {
    const issue: Issue = {
      issueId: newId('iss'),
      designId,
      versionId,
      type,
      detectedBy,
      routedTo: CORRECTION_ROUTES[type],
      detail,
      status: 'OPEN',
    };
    this.issues.push(issue);
    return issue;
  }

  resolve(issueId: string): void {
    const issue = this.issues.find((i) => i.issueId === issueId);
    if (issue) issue.status = 'RESOLVED';
  }

  open(designId?: string): Issue[] {
    return this.issues.filter((i) => i.status === 'OPEN' && (!designId || i.designId === designId));
  }

  all(): readonly Issue[] {
    return [...this.issues];
  }
}
