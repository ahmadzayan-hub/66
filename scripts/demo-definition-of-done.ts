/**
 * Definition of Done (§51): end-to-end demo.
 *
 *   "Create an original men's 925 sterling silver personalised Arabic
 *    bracelet for UAE customers with a target retail price of AED 249."
 *
 * Run: npm run demo   (artifacts written to ./output)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSystem } from '../src/platform/orchestration/system-factory.js';
import { DesignBrief } from '../src/features/design-studio/models/concept.js';
import { toDxf } from '../src/features/cad/exporters/dxf-exporter.js';
import { buildPassport } from '../src/features/products/passport.js';
import { Principal } from '../src/platform/security/rbac.js';
import { newId } from '../src/platform/kernel.js';

const os = createSystem();
const out = join(process.cwd(), 'output');
mkdirSync(out, { recursive: true });

// ---- 1. Market intelligence + structured design brief ----
const opportunity = os.marketIntelligence.identifyOpportunity({
  family: 'MEN',
  productType: 'personalised Arabic bracelet',
  targetPriceAed: 249,
});

const brief: DesignBrief = {
  briefId: newId('brf'),
  title: "Men's 925 personalised Arabic bracelet — UAE",
  family: 'MEN',
  productType: 'bracelet',
  customerSegment: opportunity.customerSegment,
  customerPersona:
    'Khalid, 32, Dubai-based professional. Buys meaningful gifts for family and wears one signature personal piece daily. Values authentic Arabic identity with a modern finish.',
  customerProblem: opportunity.customerProblem,
  marketRationale: opportunity.marketRationale,
  targetRetailPriceAed: 249,
  requiredGrossMarginPct: 60,
  personalisation: true,
  arabicText: 'خالد',
  isChildProduct: false,
  isWearableChildProduct: false,
  isReligiousText: false,
};

// ---- 2. Human approvers (mandatory gates) ----
const arabicSpecialist: Principal = { userId: 'user-arabic-01', roles: ['ARABIC_SPECIALIST'], mfaEnrolled: true };
const designDirector: Principal = { userId: 'user-dd-01', roles: ['DESIGN_DIRECTOR'], mfaEnrolled: true };
const operations: Principal = { userId: 'user-ops-01', roles: ['OPERATIONS'], mfaEnrolled: true };

// ---- 3. Run the full gate chain ----
const result = await os.orchestrator.runPipeline(brief, {
  arabicStyle: 'DIWANI',
  arabicApprover: arabicSpecialist,
});

if (result.blocked) {
  console.error('PIPELINE BLOCKED:', result.blockReasons);
  process.exit(1);
}

// ---- 4. Human final-design approval, then production files ----
os.approvals.decide('FINAL_DESIGN', result.version.versionId, 'system', designDirector, 'APPROVED', 'readiness + QA verified');
result.lifecycle.transition('VECTOR_PREPARED', { type: 'human', id: designDirector.userId }, 'final design approved');

const svg = os.svgExporter.export(result.version, result.arabicArtwork!.artworkId);
os.svgExporter.lockApproved(svg);
const dxf = toDxf(svg);
result.lifecycle.transition('CAD_PREPARED', { type: 'agent', id: os.svgExporter.agentId }, 'SVG/DXF generated');

os.approvals.decide('FINAL_PRODUCTION_FILES', svg.fileName, 'system', operations, 'APPROVED', 'files validated');
result.lifecycle.transition('PROTOTYPE_REQUESTED', { type: 'human', id: operations.userId }, 'prototype ordered from workshop');

// ---- 5. Marketing + passport ----
const material = os.materials.get(result.selectedConcept.payload.materialId);
const marketing = os.marketing.generate(brief, result.selectedConcept.payload, material, result.arabicArtwork!.artworkId);

const passport = buildPassport({
  brief,
  version: result.version,
  material,
  cost: result.cost.cost,
  qa: result.qa,
  approvals: os.approvals.forSubject(result.version.versionId).concat(os.approvals.forSubject(svg.fileName)),
  marketing,
  vectorFiles: [svg.fileName, svg.fileName.replace('.svg', '.dxf')],
  renderFiles: ['render_front.png', 'render_rear.png', 'render_side.png', 'render_lifestyle.png'],
  workshop: 'Dubai Silver Works (WS-01)',
  safetyAssessment: result.safety.verdict,
});

// ---- 6. Write artifacts ----
writeFileSync(join(out, svg.fileName), svg.svg);
writeFileSync(join(out, svg.fileName.replace('.svg', '_reversed.svg')), svg.reversedSvg);
writeFileSync(join(out, svg.fileName.replace('.svg', '.dxf')), dxf);
writeFileSync(
  join(out, 'production-instructions.md'),
  [
    `# Technical Production Instructions — ${passport.sku}`,
    '',
    `Design ${result.designId} / Version ${result.version.versionId}`,
    `Material: ${material.materialName} (${material.composition})`,
    `Dimensions: ${passport.dimensions} | Estimated weight: ${passport.weightG} g`,
    `Method: ${passport.manufacturingMethod}`,
    `Arabic artwork: ${result.arabicArtwork!.artworkId} — text locked as "${result.arabicArtwork!.approvedText}" (${result.arabicArtwork!.style})`,
    `Engraving: min line 0.40 mm, min gap 0.45 mm (validated against workshop defaults 0.30/0.35)`,
    `Files: ${svg.fileName} (positive), reversed variant, DXF in mm ($INSUNITS=4)`,
    `Layers: ENGRAVE / CUT / KEEP_CLEAR / STONE_SETTING / REFERENCE / DIMENSIONS`,
    `QC: verify Arabic against locked artwork before plating/polish; prototype required before mass production.`,
  ].join('\n'),
);
writeFileSync(
  join(out, 'design-record.json'),
  JSON.stringify(
    {
      designId: result.designId,
      versionId: result.version.versionId,
      brief,
      opportunity,
      concepts: result.allConcepts.map((c) => c.payload.conceptName),
      selectedConcept: result.selectedConcept.payload,
      scores: {
        brandFit: result.brand.brandFitScore,
        manufacturability: result.manufacturing.manufacturabilityScore,
        originality: result.originality.originalityScore,
        commercialViability: result.commercial.commercialViabilityScore,
        designReadiness: result.readiness.total,
      },
      arabic: {
        artworkId: result.arabicArtwork!.artworkId,
        approvedText: result.arabicArtwork!.approvedText,
        validation: result.arabicArtwork!.validation,
      },
      safety: result.safety,
      engineering: result.manufacturing,
      cost: {
        landedCost: result.cost.cost.landedCost,
        ceiling: result.cost.ceilingAed,
        recommendedRetail: result.cost.cost.recommendedRetailPrice,
        grossMarginPct: result.cost.cost.grossMarginPct,
        expectedProfit: result.cost.cost.expectedProfit,
      },
      qa: result.qa,
      passport,
      stateHistory: result.lifecycle.transitions.map((t) => `${t.from} -> ${t.to} (${t.actorId})`),
    },
    null,
    2,
  ),
);

console.log('=== Beyond Style UAE OS — Definition of Done demo ===');
console.log(`Design: ${result.designId}  Version: ${result.version.versionId}  SKU: ${passport.sku}`);
console.log(`Concepts: ${result.allConcepts.map((c) => c.payload.conceptName).join(' | ')}`);
console.log(`Selected: ${result.selectedConcept.payload.conceptName}`);
console.log(`Arabic artwork: ${result.arabicArtwork!.artworkId} "${result.arabicArtwork!.approvedText}" [APPROVED by ${result.arabicArtwork!.approvedBy}]`);
console.log(`Scores — brand ${result.brand.brandFitScore}, mfg ${result.manufacturing.manufacturabilityScore}, orig ${result.originality.originalityScore}, comm ${result.commercial.commercialViabilityScore}, readiness ${result.readiness.total}`);
console.log(`Safety: ${result.safety.verdict}  QA: ${result.qa.verdict}`);
console.log(`Cost: landed ${result.cost.cost.landedCost} AED vs ceiling ${result.cost.ceilingAed} AED (margin ${result.cost.cost.grossMarginPct}%)`);
console.log(`Lifecycle: ${result.lifecycle.current}`);
console.log(`Artifacts written to ./output (SVG, reversed SVG, DXF, instructions, design-record.json)`);
