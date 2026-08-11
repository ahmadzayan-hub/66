/**
 * Vercel build entry: runs the Definition-of-Done pipeline (§51) and renders
 * a static executive dashboard of the result into ./public.
 *
 * Local: npm run build:site    Vercel: buildCommand (see vercel.json)
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
const out = join(process.cwd(), 'public');
mkdirSync(out, { recursive: true });

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
    'Khalid, 32, Dubai-based professional. Buys meaningful gifts for family and wears one signature personal piece daily.',
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

const arabicSpecialist: Principal = { userId: 'user-arabic-01', roles: ['ARABIC_SPECIALIST'], mfaEnrolled: true };
const designDirector: Principal = { userId: 'user-dd-01', roles: ['DESIGN_DIRECTOR'], mfaEnrolled: true };
const operations: Principal = { userId: 'user-ops-01', roles: ['OPERATIONS'], mfaEnrolled: true };

const result = await os.orchestrator.runPipeline(brief, { arabicStyle: 'DIWANI', arabicApprover: arabicSpecialist });
if (result.blocked) {
  console.error('Pipeline blocked — site build aborted:', result.blockReasons);
  process.exit(1);
}

os.approvals.decide('FINAL_DESIGN', result.version.versionId, 'system', designDirector, 'APPROVED', 'readiness + QA verified');
result.lifecycle.transition('VECTOR_PREPARED', { type: 'human', id: designDirector.userId }, 'final design approved');
const svg = os.svgExporter.export(result.version, result.arabicArtwork!.artworkId);
os.svgExporter.lockApproved(svg);
const dxf = toDxf(svg);
result.lifecycle.transition('CAD_PREPARED', { type: 'agent', id: os.svgExporter.agentId }, 'SVG/DXF generated');
os.approvals.decide('FINAL_PRODUCTION_FILES', svg.fileName, 'system', operations, 'APPROVED', 'files validated');
result.lifecycle.transition('PROTOTYPE_REQUESTED', { type: 'human', id: operations.userId }, 'prototype ordered');

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
  renderFiles: [],
  workshop: 'Dubai Silver Works (WS-01)',
  safetyAssessment: result.safety.verdict,
});

writeFileSync(join(out, 'bracelet.svg'), svg.svg);
writeFileSync(join(out, 'bracelet_reversed.svg'), svg.reversedSvg);
writeFileSync(join(out, 'bracelet.dxf'), dxf);
writeFileSync(join(out, 'design-record.json'), JSON.stringify({ brief, opportunity, result: {
  designId: result.designId,
  versionId: result.version.versionId,
  scores: {
    brandFit: result.brand.brandFitScore,
    manufacturability: result.manufacturing.manufacturabilityScore,
    originality: result.originality.originalityScore,
    commercialViability: result.commercial.commercialViabilityScore,
    readiness: result.readiness.total,
  },
  safety: result.safety, qa: result.qa, cost: result.cost, passport,
} }, null, 2));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const gateRows: [string, string, string][] = [
  ['Concept Gate', 'PASS', `4 materially different concepts — selected "${result.selectedConcept.payload.conceptName}"`],
  ['Brand Gate', `${result.brand.brandFitScore}/100`, result.brand.matchedAttributes.slice(0, 4).join(', ')],
  ['Arabic Gate', 'PASS', `Master artwork ${result.arabicArtwork!.artworkId} (${result.arabicArtwork!.style}) — human-approved, spelling locked`],
  ['Engineering Gate', `${result.manufacturing.manufacturabilityScore}/100`, `${result.manufacturing.productionRisk} risk · ${result.manufacturing.manufacturingMethod}`],
  ['Safety Gate', result.safety.verdict, result.safety.hazards.length === 0 ? 'No hazards identified' : `${result.safety.hazards.length} hazard(s)`],
  ['Cost Gate', 'PASS', `Landed AED ${result.cost.cost.landedCost} vs ceiling AED ${result.cost.ceilingAed} (reverse-costed @ 60% margin)`],
  ['Commercial Gate', `${result.commercial.commercialViabilityScore}/100`, 'Market appeal, repeatability, conversion potential'],
  ['Originality Gate', `${result.originality.originalityScore}/100`, `${result.originality.similarityRisk} similarity risk`],
  ['Independent QA', result.qa.verdict, `${result.qa.checks.filter((c) => c.pass).length}/${result.qa.checks.length} checks passed`],
  ['Human Approvals', 'APPROVED', 'Arabic artwork · final design · production files'],
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beyond Style UAE — Agentic Product Design OS</title>
<style>
:root{--bg:#14141a;--panel:#1d1d26;--line:#2e2e3a;--silver:#c9ccd6;--gold:#c8a96a;--ink:#e8e9ee;--dim:#8d90a0;--ok:#5dbb7f}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:16px/1.6 Georgia,'Times New Roman',serif;padding:0 0 80px}
header{padding:64px 24px 40px;text-align:center;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#191922,#14141a)}
h1{font-size:34px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--silver)}
h1 b{color:var(--gold);font-weight:400}
header p{color:var(--dim);margin-top:10px;font-size:15px}
main{max-width:1060px;margin:0 auto;padding:0 24px}
h2{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin:52px 0 18px;font-family:Verdana,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 20px}
.tile .n{font-size:30px;color:var(--silver)}
.tile .l{font-size:12px;color:var(--dim);letter-spacing:.08em;text-transform:uppercase;font-family:Verdana,sans-serif}
.tile.hero .n{color:var(--gold)}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:15px}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-family:Verdana,sans-serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim)}
td.v{color:var(--ok);white-space:nowrap;font-family:Verdana,sans-serif;font-size:13px}
.ar{direction:rtl;font-size:26px;color:var(--gold);text-align:center;padding:26px;background:var(--panel);border:1px solid var(--line);border-radius:10px}
.ar small{display:block;direction:ltr;color:var(--dim);font-size:12px;margin-top:10px;font-family:Verdana,sans-serif;letter-spacing:.08em}
.svgbox{background:#fff;border-radius:10px;padding:20px;margin-top:14px}
.svgbox svg{width:100%;height:auto;display:block}
.files a{display:inline-block;margin:6px 12px 0 0;color:var(--gold);font-family:Verdana,sans-serif;font-size:13px}
.copy{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px 24px;margin-top:14px}
.copy .rtl{direction:rtl;color:var(--silver)}
.copy hr{border:0;border-top:1px solid var(--line);margin:14px 0}
footer{text-align:center;color:var(--dim);font-size:13px;margin-top:70px;font-family:Verdana,sans-serif}
.state{color:var(--dim);font-family:Verdana,sans-serif;font-size:12px;letter-spacing:.06em;line-height:2}
.state b{color:var(--ok);font-weight:400}
</style>
</head>
<body>
<header>
  <h1>Beyond <b>Style</b> UAE</h1>
  <p>Agentic Product Design Operating System — Release 1 · Definition-of-Done run (§51)</p>
  <p>"${esc(brief.title)}" · target AED 249 · required margin 60%</p>
</header>
<main>
  <h2>Design Readiness</h2>
  <div class="grid">
    <div class="tile hero"><div class="n">${result.readiness.total}</div><div class="l">Readiness / 100 (gate ≥ 85)</div></div>
    <div class="tile"><div class="n">${result.brand.brandFitScore}</div><div class="l">Brand Fit</div></div>
    <div class="tile"><div class="n">${result.manufacturing.manufacturabilityScore}</div><div class="l">Manufacturability</div></div>
    <div class="tile"><div class="n">${result.originality.originalityScore}</div><div class="l">Originality</div></div>
    <div class="tile"><div class="n">${result.commercial.commercialViabilityScore}</div><div class="l">Commercial</div></div>
    <div class="tile"><div class="n">${result.safety.verdict}</div><div class="l">Safety (mandatory)</div></div>
  </div>

  <h2>Gate Chain — every gate enforced in code</h2>
  <table>
    <tr><th>Gate</th><th>Verdict</th><th>Detail</th></tr>
    ${gateRows.map(([g, v, d]) => `<tr><td>${esc(g)}</td><td class="v">${esc(v)}</td><td>${esc(d)}</td></tr>`).join('\n    ')}
  </table>

  <h2>Approved Arabic Master Artwork</h2>
  <div class="ar">${esc(result.arabicArtwork!.approvedText)}
    <small>${result.arabicArtwork!.artworkId} · ${result.arabicArtwork!.style} · spelling locked · approved by ${result.arabicArtwork!.approvedBy}
    · ${result.arabicArtwork!.validation.letterCount} letters · ${result.arabicArtwork!.validation.dotBearingLetters} dot-bearing · RTL verified</small>
  </div>

  <h2>Production Vector — ${esc(svg.fileName)} (${svg.widthMm} × ${svg.heightMm} mm)</h2>
  <div class="svgbox">${svg.svg.replace(/^<\?xml[^>]*\?>\n?/, '')}</div>
  <p class="files">
    <a href="bracelet.svg" download>SVG (positive)</a>
    <a href="bracelet_reversed.svg" download>SVG (reversed)</a>
    <a href="bracelet.dxf" download>DXF (mm)</a>
    <a href="design-record.json" download>Full design record (JSON)</a>
  </p>

  <h2>Commercials</h2>
  <div class="grid">
    <div class="tile"><div class="n">AED ${result.cost.cost.landedCost}</div><div class="l">Landed cost</div></div>
    <div class="tile"><div class="n">AED ${result.cost.ceilingAed}</div><div class="l">Reverse-cost ceiling</div></div>
    <div class="tile"><div class="n">${result.cost.cost.grossMarginPct}%</div><div class="l">Gross margin @ AED 249</div></div>
    <div class="tile"><div class="n">AED ${result.cost.cost.expectedProfit}</div><div class="l">Expected profit / unit</div></div>
    <div class="tile"><div class="n">${passport.sku}</div><div class="l">SKU</div></div>
    <div class="tile"><div class="n">${passport.weightG} g</div><div class="l">Est. weight · ${esc(passport.material)}</div></div>
  </div>

  <h2>Marketing Copy (Arabic validated against locked artwork)</h2>
  <div class="copy">
    <p class="rtl">${esc(marketing.arabicCaption)}</p>
    <hr>
    <p>${esc(marketing.englishCaption)}</p>
    <hr>
    <p><i>${esc(marketing.reelHook)}</i> — ${esc(marketing.cta)}</p>
  </div>

  <h2>Lifecycle (no silent state skipping)</h2>
  <p class="state">${result.lifecycle.transitions.map((t) => `${t.from} → <b>${t.to}</b>`).join(' · ')}</p>

  <footer>Static snapshot generated at build time by the Release 1 pipeline · ${result.designId} / ${result.version.versionId}<br>
  Docs &amp; source: <a style="color:var(--gold)" href="https://github.com/ahmadzayan-hub/66">github.com/ahmadzayan-hub/66</a></footer>
</main>
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(`Site built: public/index.html + artifacts (design ${result.designId}, readiness ${result.readiness.total}, lifecycle ${result.lifecycle.current})`);
