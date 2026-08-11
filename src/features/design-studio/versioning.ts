import { ImmutabilityError, newId } from '../../platform/kernel.js';
import { DesignConcept } from './models/concept.js';

/** Design version control (§24). Approved production versions are immutable. */
export interface DesignVersion {
  designId: string;
  versionId: string;
  versionNo: number;
  parentVersion?: string;
  createdBy: string;
  agentId?: string;
  changeReason: string;
  changedFields: string[];
  approvalStatus: 'DRAFT' | 'DESIGN_APPROVED' | 'PRODUCTION_APPROVED' | 'REJECTED';
  prototypeStatus: 'NONE' | 'REQUESTED' | 'RECEIVED' | 'EVALUATED';
  productionStatus: 'NONE' | 'APPROVED' | 'IN_PRODUCTION';
  concept: DesignConcept;
}

export class DesignVersionStore {
  private versions = new Map<string, DesignVersion>();
  private byDesign = new Map<string, string[]>();

  createInitial(designId: string, concept: DesignConcept, createdBy: string, agentId?: string): DesignVersion {
    return this.put({
      designId,
      versionId: newId('ver'),
      versionNo: 1,
      createdBy,
      agentId,
      changeReason: 'initial concept',
      changedFields: ['*'],
      approvalStatus: 'DRAFT',
      prototypeStatus: 'NONE',
      productionStatus: 'NONE',
      concept,
    });
  }

  /** Every revision is a child version — approved versions are never edited (rule 52.7). */
  revise(parent: DesignVersion, concept: DesignConcept, createdBy: string, changeReason: string, changedFields: string[]): DesignVersion {
    return this.put({
      designId: parent.designId,
      versionId: newId('ver'),
      versionNo: parent.versionNo + 1,
      parentVersion: parent.versionId,
      createdBy,
      changeReason,
      changedFields,
      approvalStatus: 'DRAFT',
      prototypeStatus: 'NONE',
      productionStatus: 'NONE',
      concept,
    });
  }

  setApprovalStatus(versionId: string, status: DesignVersion['approvalStatus']): DesignVersion {
    const version = this.get(versionId);
    if (version.approvalStatus === 'PRODUCTION_APPROVED') {
      throw new ImmutabilityError(`Version ${versionId} is production-approved and immutable`);
    }
    version.approvalStatus = status;
    return version;
  }

  /** Any mutation of a production-approved version throws. */
  updateConcept(versionId: string, concept: DesignConcept): void {
    const version = this.get(versionId);
    if (version.approvalStatus === 'PRODUCTION_APPROVED' || version.approvalStatus === 'DESIGN_APPROVED') {
      throw new ImmutabilityError(`Version ${versionId} is approved; create a child revision instead`);
    }
    version.concept = concept;
  }

  get(versionId: string): DesignVersion {
    const v = this.versions.get(versionId);
    if (!v) throw new Error(`Unknown version ${versionId}`);
    return v;
  }

  history(designId: string): DesignVersion[] {
    return (this.byDesign.get(designId) ?? []).map((id) => this.get(id));
  }

  private put(version: DesignVersion): DesignVersion {
    this.versions.set(version.versionId, version);
    const list = this.byDesign.get(version.designId) ?? [];
    list.push(version.versionId);
    this.byDesign.set(version.designId, list);
    return version;
  }
}
