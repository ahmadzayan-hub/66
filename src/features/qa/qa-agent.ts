import { AgentIdentity, Artifact, assertIndependentEvaluator, QaVerdict } from '../../platform/kernel.js';
import { DesignBrief, DesignConcept } from '../design-studio/models/concept.js';
import { MasterArtworkRegistry } from '../arabic-design/master-artwork.js';
import { SafetyReview } from '../safety/safety-agent.js';
import { ManufacturabilityReview } from '../manufacturing/manufacturing-agent.js';
import { CostReview } from '../costing/cost-engine.js';
import { BrandReview } from '../brand/brand-agent.js';
import { OriginalityReview } from '../originality/originality-agent.js';
import { SvgExport } from '../cad/exporters/svg-exporter.js';
import { RESTRICTED_CLAIMS } from '../materials/materials.js';

export interface QaReport {
  verdict: QaVerdict;
  checks: { name: string; pass: boolean; note?: string }[];
}

/**
 * Independent QA agent (§19). Structurally cannot be the generator: it
 * generates nothing, and assertIndependentEvaluator rejects any artifact
 * carrying its lineage. Re-validates everything with its own checks rather
 * than trusting upstream verdicts.
 */
export class QaAgent implements AgentIdentity {
  agentId = 'agent-13-qa';
  capability = 'evaluate' as const;

  constructor(private artworks: MasterArtworkRegistry) {}

  validate(input: {
    brief: DesignBrief;
    concept: Artifact<DesignConcept>;
    brand: BrandReview;
    manufacturing: ManufacturabilityReview;
    safety: SafetyReview;
    cost: CostReview;
    originality: OriginalityReview;
    arabicArtworkId?: string;
    svg?: SvgExport;
    marketingCopyEn?: string;
  }): QaReport {
    assertIndependentEvaluator(this, input.concept);
    const checks: QaReport['checks'] = [];
    const check = (name: string, pass: boolean, note?: string) => checks.push({ name, pass, note });

    // Arabic: artwork approved and geometry derived from locked spelling.
    if (input.brief.arabicText) {
      const hasArtwork = Boolean(input.arabicArtworkId);
      check('arabic: master artwork present', hasArtwork);
      if (input.arabicArtworkId) {
        const artwork = this.artworks.get(input.arabicArtworkId);
        check('arabic: artwork human-approved', artwork.status === 'APPROVED');
        check('arabic: artwork text matches customer spelling', artwork.approvedText === input.brief.arabicText.trim());
      }
    }

    // Geometry & dimensions
    const d = input.concept.payload.dimensions;
    check('geometry: positive dimensions', d.lengthMm > 0 && d.widthMm > 0 && d.thicknessMm > 0);
    check('engineering: manufacturability PASS', input.manufacturing.verdict === 'PASS');

    // Safety is mandatory
    check('safety: PASS or PASS_WITH_CONDITIONS', input.safety.verdict === 'PASS' || input.safety.verdict === 'PASS_WITH_CONDITIONS');

    // Costing consistency: recompute margin from raw numbers.
    const c = input.cost.cost;
    const recomputedMargin = Math.round(((input.brief.targetRetailPriceAed - c.landedCost) / input.brief.targetRetailPriceAed) * 10000) / 100;
    check('costing: margin arithmetic consistent', Math.abs(recomputedMargin - c.grossMarginPct) < 0.5);
    check('costing: within reverse-cost ceiling', input.cost.withinCeiling);

    // CAD consistency
    if (input.svg) {
      check('cad: svg mm units', /width="[\d.]+mm"/.test(input.svg.svg));
      check('cad: layer set present', ['ENGRAVE', 'CUT'].every((l) => input.svg!.svg.includes(`id="${l}"`)));
      check('cad: reversed version generated', input.svg.reversedSvg.length > 0);
    }

    // Brand & originality
    check('brand: score present', input.brand.brandFitScore >= 0 && input.brand.brandFitScore <= 100);
    check('originality: no unresolved IP issue', !input.originality.potentialIpIssue);

    // Commercial claims: marketing copy must not carry unevidenced restricted claims.
    if (input.marketingCopyEn) {
      const copy = input.marketingCopyEn.toLowerCase();
      const badClaim = RESTRICTED_CLAIMS.find((claim) => copy.includes(claim));
      check('claims: no unevidenced restricted claims in copy', !badClaim, badClaim && `found "${badClaim}"`);
    }

    const failed = checks.filter((c) => !c.pass);
    const safetyFailed = input.safety.verdict === 'FAIL';
    const humanNeeded =
      input.safety.verdict === 'HUMAN_REVIEW_REQUIRED' || input.originality.verdict === 'HUMAN_REVIEW_REQUIRED';

    let verdict: QaVerdict;
    if (safetyFailed) verdict = 'REJECTED';
    else if (humanNeeded) verdict = 'HUMAN_REVIEW_REQUIRED';
    else if (failed.length > 0) verdict = 'REVISION_REQUIRED';
    else verdict = 'APPROVED';

    return { verdict, checks };
  }
}
