import { Artifact, newId } from '../kernel.js';
import { AuditLog } from '../audit/audit-log.js';
import { EventBus } from '../event-bus/event-bus.js';
import { DesignLifecycle } from './state-machine.js';
import { IssueLog } from './issue-log.js';
import { DesignBrief, DesignConcept } from '../../features/design-studio/models/concept.js';
import { CreativeDesignAgent } from '../../features/design-studio/agents/creative-agent.js';
import { DesignVersionStore, DesignVersion } from '../../features/design-studio/versioning.js';
import { computeReadiness, ReadinessResult } from '../../features/design-studio/readiness-score.js';
import { BrandDnaAgent, BrandReview } from '../../features/brand/brand-agent.js';
import { MasterArtworkRegistry, MasterArabicArtwork, CalligraphyStyle } from '../../features/arabic-design/master-artwork.js';
import { containsArabic } from '../../features/arabic-design/validators/arabic-validator.js';
import { ManufacturingAgent, ManufacturabilityReview } from '../../features/manufacturing/manufacturing-agent.js';
import { SafetyAgent, SafetyReview } from '../../features/safety/safety-agent.js';
import { CostAgent, CostReview } from '../../features/costing/cost-engine.js';
import { CommercialAgent, CommercialReview } from '../../features/commercial/commercial-agent.js';
import { OriginalityAgent, OriginalityReview } from '../../features/originality/originality-agent.js';
import { QaAgent, QaReport } from '../../features/qa/qa-agent.js';
import { ApprovalService } from '../../features/approvals/approval-service.js';
import { Principal } from '../security/rbac.js';

export interface PipelineDependencies {
  audit: AuditLog;
  bus: EventBus;
  issues: IssueLog;
  versions: DesignVersionStore;
  artworks: MasterArtworkRegistry;
  approvals: ApprovalService;
  agents: {
    creative: CreativeDesignAgent;
    brand: BrandDnaAgent;
    manufacturing: ManufacturingAgent;
    safety: SafetyAgent;
    cost: CostAgent;
    commercial: CommercialAgent;
    originality: OriginalityAgent;
    qa: QaAgent;
  };
}

export interface PipelineResult {
  designId: string;
  version: DesignVersion;
  lifecycle: DesignLifecycle;
  selectedConcept: Artifact<DesignConcept>;
  allConcepts: Artifact<DesignConcept>[];
  brand: BrandReview;
  arabicArtwork?: MasterArabicArtwork;
  manufacturing: ManufacturabilityReview;
  safety: SafetyReview;
  cost: CostReview;
  commercial: CommercialReview;
  originality: OriginalityReview;
  readiness: ReadinessResult;
  qa: QaReport;
  blocked: boolean;
  blockReasons: string[];
}

const SYSTEM = { type: 'system' as const, id: 'design-orchestrator' };

/**
 * Design Orchestrator (§5): plans, sequences, routes and escalates — but holds
 * no approval authority. It can only advance state when the responsible
 * gate/agent/human produced a passing verdict; any failure blocks and routes.
 */
export class DesignOrchestrator {
  constructor(private deps: PipelineDependencies) {}

  /**
   * Run the Release 1 gate chain for a brief. `humanApprovers` provides the
   * human principals for the mandatory gates (Arabic artwork approval).
   */
  async runPipeline(
    brief: DesignBrief,
    options: {
      arabicStyle?: CalligraphyStyle;
      arabicApprover?: Principal;
      conceptSelector?: (concepts: Artifact<DesignConcept>[]) => Artifact<DesignConcept>;
    } = {},
  ): Promise<PipelineResult> {
    const { audit, bus, issues, versions, artworks, agents } = this.deps;
    const designId = newId('des');
    const lifecycle = new DesignLifecycle(designId, 'pending', audit);
    const blockReasons: string[] = [];

    lifecycle.transition('RESEARCHING', SYSTEM, 'brief intake');
    lifecycle.transition('BRIEF_APPROVED', SYSTEM, `brief ${brief.briefId} accepted`);
    bus.publish({ type: 'DesignBriefCreated', designId, emitterAgentId: SYSTEM.id, payload: brief });

    // ---- Concept Gate: 4 materially different concepts ----
    const concepts = agents.creative.generateConcepts(brief);
    const selected = options.conceptSelector ? options.conceptSelector(concepts) : concepts[0]!;
    const version = versions.createInitial(designId, selected.payload, 'system', agents.creative.agentId);
    lifecycle.versionId = version.versionId;
    lifecycle.transition('CONCEPT_CREATED', { type: 'agent', id: agents.creative.agentId }, '4 concepts generated');
    bus.publish({ type: 'ConceptGenerated', designId, versionId: version.versionId, emitterAgentId: agents.creative.agentId, payload: { count: concepts.length } });

    // ---- Brand Gate ----
    lifecycle.transition('BRAND_REVIEW', SYSTEM, 'entering brand gate');
    const brand = agents.brand.review(selected);
    bus.publish({ type: 'BrandReviewCompleted', designId, versionId: version.versionId, emitterAgentId: agents.brand.agentId, payload: brand });
    if (brand.brandFitScore < 40) {
      issues.raise(designId, version.versionId, 'WEAK_BRAND_IDENTITY', agents.brand.agentId, `brand fit ${brand.brandFitScore}`);
      blockReasons.push(`brand fit ${brand.brandFitScore} below floor`);
    }

    // ---- Arabic Gate (mandatory whenever Arabic appears) ----
    let arabicArtwork: MasterArabicArtwork | undefined;
    const hasArabic = Boolean(brief.arabicText && containsArabic(brief.arabicText));
    if (hasArabic) {
      lifecycle.transition('ARABIC_REVIEW', SYSTEM, 'entering arabic gate');
      try {
        arabicArtwork = artworks.createPending(brief.arabicText!, options.arabicStyle ?? 'DIWANI', 'customer');
        if (options.arabicApprover) {
          this.deps.approvals.decide('ARABIC_MASTER_ARTWORK', arabicArtwork.artworkId, 'customer', options.arabicApprover, 'APPROVED', 'calligraphy verified against exact spelling');
          artworks.approve(arabicArtwork.artworkId, options.arabicApprover.userId);
          bus.publish({ type: 'ArabicMasterArtworkApproved', designId, versionId: version.versionId, emitterAgentId: 'agent-04-arabic', payload: { artworkId: arabicArtwork.artworkId } });
        } else {
          blockReasons.push('Arabic master artwork awaiting mandatory human approval');
        }
      } catch (err) {
        issues.raise(designId, version.versionId, 'INCORRECT_ARABIC', 'agent-04-arabic', String(err));
        bus.publish({ type: 'ArabicValidationFailed', designId, versionId: version.versionId, emitterAgentId: 'agent-04-arabic', payload: { error: String(err) } });
        blockReasons.push(`Arabic validation failed: ${String(err)}`);
      }
      lifecycle.transition('ENGINEERING_REVIEW', SYSTEM, 'arabic gate processed');
    } else {
      lifecycle.skipArabicReview(SYSTEM);
    }

    // ---- Engineering Gate ----
    const manufacturing = agents.manufacturing.review(selected);
    if (manufacturing.verdict === 'FAIL') {
      issues.raise(designId, version.versionId, 'FRAGILE_GEOMETRY', agents.manufacturing.agentId, manufacturing.failurePoints.join('; '));
      bus.publish({ type: 'EngineeringReviewFailed', designId, versionId: version.versionId, emitterAgentId: agents.manufacturing.agentId, payload: manufacturing });
      blockReasons.push(`engineering: ${manufacturing.failurePoints.join('; ')}`);
    }
    lifecycle.transition('SAFETY_REVIEW', SYSTEM, 'engineering gate processed');

    // ---- Safety Gate (FAIL is absolute) ----
    const safety = agents.safety.review(brief, selected);
    if (safety.verdict === 'FAIL' || safety.verdict === 'HUMAN_REVIEW_REQUIRED') {
      if (brief.isChildProduct) issues.raise(designId, version.versionId, 'UNSAFE_BABY_PRODUCT', agents.safety.agentId, JSON.stringify(safety.hazards));
      bus.publish({ type: 'SafetyRejected', designId, versionId: version.versionId, emitterAgentId: agents.safety.agentId, payload: safety });
      blockReasons.push(`safety: ${safety.verdict}`);
    }
    lifecycle.transition('COST_REVIEW', SYSTEM, 'safety gate processed');

    // ---- Cost Gate (reverse costing ceiling) ----
    const cost = agents.cost.review(selected, brief.targetRetailPriceAed, brief.requiredGrossMarginPct);
    if (!cost.withinCeiling) {
      issues.raise(designId, version.versionId, 'COST_TOO_HIGH', agents.cost.agentId, `landed ${cost.cost.landedCost} > ceiling ${cost.ceilingAed}`);
      bus.publish({ type: 'CostExceeded', designId, versionId: version.versionId, emitterAgentId: agents.cost.agentId, payload: cost });
      blockReasons.push(`cost: landed ${cost.cost.landedCost} AED exceeds ceiling ${cost.ceilingAed} AED`);
    }
    lifecycle.transition('COMMERCIAL_REVIEW', SYSTEM, 'cost gate processed');

    // ---- Commercial + Originality ----
    const commercial = agents.commercial.review(selected, cost);
    const originality = agents.originality.review(selected);
    bus.publish({ type: 'CommercialReviewCompleted', designId, versionId: version.versionId, emitterAgentId: agents.commercial.agentId, payload: commercial });
    if (originality.verdict === 'HUMAN_REVIEW_REQUIRED') {
      issues.raise(designId, version.versionId, 'COPIED_APPEARANCE', agents.originality.agentId, 'IP risk');
      bus.publish({ type: 'HumanReviewRequired', designId, versionId: version.versionId, emitterAgentId: agents.originality.agentId, payload: originality });
      blockReasons.push('originality: human review required');
    }

    // ---- Readiness score (mandatory overrides included) ----
    const readiness = computeReadiness({
      scores: {
        brandFit: brand.brandFitScore,
        manufacturability: manufacturing.manufacturabilityScore,
        originality: originality.originalityScore,
        commercialViability: commercial.commercialViabilityScore,
        costFeasibility: cost.withinCeiling ? (cost.headroomWarning ? 70 : 95) : 20,
        aestheticQuality: brand.brandFitScore >= 60 ? 85 : 60, // R1 proxy; dedicated aesthetic model in R3
        marketRelevance: commercial.breakdown['marketAppeal'] ?? 60,
        personalisationPotential: commercial.breakdown['personalisationPotential'] ?? 0,
      },
      safetyPass: safety.verdict === 'PASS' || safety.verdict === 'PASS_WITH_CONDITIONS',
      arabicApplicable: hasArabic,
      arabicPass: !hasArabic || arabicArtwork?.status === 'APPROVED',
    });
    if (!readiness.releaseReady) blockReasons.push(...readiness.blockingReasons);

    // ---- Independent QA Gate ----
    const qa = agents.qa.validate({
      brief,
      concept: selected,
      brand,
      manufacturing,
      safety,
      cost,
      originality,
      arabicArtworkId: arabicArtwork?.artworkId,
    });
    if (qa.verdict !== 'APPROVED') blockReasons.push(`qa: ${qa.verdict}`);

    const blocked = blockReasons.length > 0;
    if (blocked) {
      lifecycle.transition('REVISION_REQUIRED', SYSTEM, blockReasons.join(' | '));
      bus.publish({ type: 'RevisionRequired', designId, versionId: version.versionId, emitterAgentId: SYSTEM.id, payload: blockReasons });
    } else {
      lifecycle.transition('DESIGN_APPROVED', SYSTEM, `readiness ${readiness.total}, QA approved`);
      versions.setApprovalStatus(version.versionId, 'DESIGN_APPROVED');
      bus.publish({ type: 'DesignApproved', designId, versionId: version.versionId, emitterAgentId: SYSTEM.id, payload: { readiness: readiness.total } });
    }

    return {
      designId,
      version,
      lifecycle,
      selectedConcept: selected,
      allConcepts: concepts,
      brand,
      arabicArtwork,
      manufacturing,
      safety,
      cost,
      commercial,
      originality,
      readiness,
      qa,
      blocked,
      blockReasons,
    };
  }
}
