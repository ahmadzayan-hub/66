/**
 * Vercel serverless function: POST /api/pipeline
 * Runs the Release 1 gate chain live for a browser-supplied brief and returns
 * the full result (scores, gate verdicts, issues, production files).
 *
 * Each invocation composes a fresh in-memory system — runs are self-contained
 * demo executions; Release 2 persistence swaps repositories, not this handler.
 */
import { createSystem } from '../src/platform/orchestration/system-factory.js';
import { DesignBrief, ProductFamily } from '../src/features/design-studio/models/concept.js';
import { toDxf } from '../src/features/cad/exporters/dxf-exporter.js';
import { buildPassport } from '../src/features/products/passport.js';
import { CALLIGRAPHY_STYLES, CalligraphyStyle } from '../src/features/arabic-design/master-artwork.js';
import { Principal } from '../src/platform/security/rbac.js';
import { newId } from '../src/platform/kernel.js';

const FAMILIES: ProductFamily[] = [
  'MEN', 'WOMEN', 'BABIES_CHILDREN', 'COUPLES', 'GIFTS', 'PERSONALISED',
  'ARABIC_CALLIGRAPHY', 'CORPORATE', 'UAE_INSPIRED', 'SEASONAL',
];

export interface PipelineRequestBody {
  arabicText?: string;
  targetRetailPriceAed?: number;
  requiredGrossMarginPct?: number;
  family?: ProductFamily;
  productType?: string;
  isChildProduct?: boolean;
  isWearableChildProduct?: boolean;
  conceptName?: string;
  approveArabic?: boolean;
  calligraphyStyle?: CalligraphyStyle;
}

/** Strong input validation at the boundary (§39). Returns error text or null. */
export function validateBody(body: PipelineRequestBody): string | null {
  const price = body.targetRetailPriceAed ?? 249;
  const margin = body.requiredGrossMarginPct ?? 60;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 50 || price > 100000)
    return 'targetRetailPriceAed must be a number between 50 and 100000';
  if (typeof margin !== 'number' || !Number.isFinite(margin) || margin < 0 || margin > 90)
    return 'requiredGrossMarginPct must be a number between 0 and 90';
  if (body.family && !FAMILIES.includes(body.family)) return `family must be one of ${FAMILIES.join(', ')}`;
  if (body.arabicText !== undefined && typeof body.arabicText !== 'string') return 'arabicText must be a string';
  if (body.arabicText && body.arabicText.length > 60) return 'arabicText must be 60 characters or fewer';
  if (body.calligraphyStyle && !CALLIGRAPHY_STYLES.includes(body.calligraphyStyle))
    return `calligraphyStyle must be one of ${CALLIGRAPHY_STYLES.join(', ')}`;
  if (body.conceptName && typeof body.conceptName !== 'string') return 'conceptName must be a string';
  return null;
}

export async function runPipelineRequest(body: PipelineRequestBody) {
  const os = createSystem();
  const arabicText = body.arabicText?.trim() || undefined;
  const approveArabic = body.approveArabic !== false;

  const brief: DesignBrief = {
    briefId: newId('brf'),
    title: `${body.family ?? 'MEN'} ${body.productType ?? 'bracelet'} — live run`,
    family: body.family ?? 'MEN',
    productType: body.productType ?? 'bracelet',
    customerSegment: 'UAE residents 25-45, gift buyers and self-purchasers',
    customerPersona: 'Live demo customer, Dubai',
    customerProblem: 'authentic Arabic personalisation gap at accessible-premium prices',
    marketRationale: 'UAE gifting seasons drive recurring personalised-silver demand',
    targetRetailPriceAed: body.targetRetailPriceAed ?? 249,
    requiredGrossMarginPct: body.requiredGrossMarginPct ?? 60,
    personalisation: Boolean(arabicText),
    arabicText,
    isChildProduct: Boolean(body.isChildProduct),
    isWearableChildProduct: Boolean(body.isWearableChildProduct),
    isReligiousText: false,
  };

  const arabicSpecialist: Principal = { userId: 'user-arabic-01', roles: ['ARABIC_SPECIALIST'], mfaEnrolled: true };
  const designDirector: Principal = { userId: 'user-dd-01', roles: ['DESIGN_DIRECTOR'], mfaEnrolled: true };
  const operations: Principal = { userId: 'user-ops-01', roles: ['OPERATIONS'], mfaEnrolled: true };

  const result = await os.orchestrator.runPipeline(brief, {
    arabicStyle: body.calligraphyStyle ?? 'DIWANI',
    arabicApprover: approveArabic ? arabicSpecialist : undefined,
    conceptSelector: body.conceptName
      ? (concepts) => concepts.find((c) => c.payload.conceptName === body.conceptName) ?? concepts[0]!
      : undefined,
  });

  let production: null | {
    sku: string;
    svg: string;
    reversedSvg: string;
    dxf: string;
    fileName: string;
    marketing: unknown;
    approvals: unknown[];
  } = null;

  if (!result.blocked) {
    os.approvals.decide('FINAL_DESIGN', result.version.versionId, 'system', designDirector, 'APPROVED', 'readiness + QA verified');
    result.lifecycle.transition('VECTOR_PREPARED', { type: 'human', id: designDirector.userId }, 'final design approved');
    const svg = os.svgExporter.export(result.version, result.arabicArtwork?.artworkId);
    os.svgExporter.lockApproved(svg);
    const dxf = toDxf(svg);
    result.lifecycle.transition('CAD_PREPARED', { type: 'agent', id: os.svgExporter.agentId }, 'SVG/DXF generated');
    os.approvals.decide('FINAL_PRODUCTION_FILES', svg.fileName, 'system', operations, 'APPROVED', 'files validated');
    result.lifecycle.transition('PROTOTYPE_REQUESTED', { type: 'human', id: operations.userId }, 'prototype ordered');

    const material = os.materials.get(result.selectedConcept.payload.materialId);
    const marketing = os.marketing.generate(brief, result.selectedConcept.payload, material, result.arabicArtwork?.artworkId);
    const passport = buildPassport({
      brief,
      version: result.version,
      material,
      cost: result.cost.cost,
      qa: result.qa,
      approvals: os.approvals.forSubject(result.version.versionId).concat(os.approvals.forSubject(svg.fileName)),
      marketing,
      vectorFiles: [svg.fileName, svg.fileName.replace('.svg', '.dxf')],
      renderFiles: [],
      workshop: 'Dubai Silver Works (WS-01)',
      safetyAssessment: result.safety.verdict,
    });
    production = {
      sku: passport.sku,
      svg: svg.svg,
      reversedSvg: svg.reversedSvg,
      dxf,
      fileName: svg.fileName,
      marketing,
      approvals: os.approvals.forSubject(result.version.versionId).concat(os.approvals.forSubject(svg.fileName)),
    };
  }

  return {
    designId: result.designId,
    versionId: result.version.versionId,
    blocked: result.blocked,
    blockReasons: result.blockReasons,
    lifecycle: result.lifecycle.transitions.map((t) => ({ from: t.from, to: t.to, actor: t.actorId, reason: t.reason })),
    currentState: result.lifecycle.current,
    concepts: result.allConcepts.map((c) => ({
      conceptName: c.payload.conceptName,
      designStory: c.payload.designStory,
      materialId: c.payload.materialId,
      estimatedWeightG: c.payload.estimatedWeightG,
      complexity: c.payload.complexity,
      estimatedCostBand: c.payload.estimatedCostBand,
    })),
    selectedConcept: result.selectedConcept.payload,
    arabic: result.arabicArtwork
      ? {
          artworkId: result.arabicArtwork.artworkId,
          approvedText: result.arabicArtwork.approvedText,
          style: result.arabicArtwork.style,
          status: result.arabicArtwork.status,
          approvedBy: result.arabicArtwork.approvedBy ?? null,
          letterCount: result.arabicArtwork.validation.letterCount,
          dotBearingLetters: result.arabicArtwork.validation.dotBearingLetters,
        }
      : null,
    scores: {
      brandFit: result.brand.brandFitScore,
      manufacturability: result.manufacturing.manufacturabilityScore,
      originality: result.originality.originalityScore,
      commercialViability: result.commercial.commercialViabilityScore,
      readiness: result.readiness.total,
      releaseReady: result.readiness.releaseReady,
    },
    gates: {
      brand: { matched: result.brand.matchedAttributes, gaps: result.brand.gaps },
      engineering: {
        verdict: result.manufacturing.verdict,
        risk: result.manufacturing.productionRisk,
        failurePoints: result.manufacturing.failurePoints,
        requiredChanges: result.manufacturing.requiredChanges,
      },
      safety: { verdict: result.safety.verdict, hazards: result.safety.hazards, conditions: result.safety.conditions },
      cost: {
        verdict: result.cost.verdict,
        landedCost: result.cost.cost.landedCost,
        ceiling: result.cost.ceilingAed,
        grossMarginPct: result.cost.cost.grossMarginPct,
        expectedProfit: result.cost.cost.expectedProfit,
        recommendedRetail: result.cost.cost.recommendedRetailPrice,
        headroomWarning: result.cost.headroomWarning,
      },
      originality: { verdict: result.originality.verdict, similarityRisk: result.originality.similarityRisk },
      qa: { verdict: result.qa.verdict, checks: result.qa.checks },
    },
    issues: os.issues.all().map((i) => ({ type: i.type, detail: i.detail, routedTo: i.routedTo })),
    production,
  };
}

export default async function handler(req: { method?: string; body?: unknown }, res: {
  status: (code: number) => { json: (data: unknown) => void };
  setHeader: (k: string, v: string) => void;
}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed; POST a pipeline request' });
    return;
  }
  const body: PipelineRequestBody = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as PipelineRequestBody;
  const invalid = validateBody(body);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  try {
    const data = await runPipelineRequest(body);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: `pipeline error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
