# UI Generation Prompt

Copy-paste prompt for an AI design/UI generation tool (v0, Lovable, Figma
Make, Uizard, etc.) to generate the full Beyond Style UAE interface.

---

## PROMPT

Design a premium, bilingual (English + Arabic RTL) web application UI for
**Beyond Style UAE — an Agentic Product Design Operating System** for a
jewellery brand. This is NOT an e-commerce shop and NOT an AI image
generator. It is an internal operating system that a jewellery company's team
uses to turn market opportunities into original, safe, manufacturable
925-silver products. AI agents propose and evaluate designs; deterministic
"gates" (brand, Arabic accuracy, engineering, safety, cost, commercial,
originality, QA) approve or block them; humans give final approval. The UI's
job is to make that pipeline visible, controllable and trustworthy.

### Brand & visual language

- Mood: modern Arabic luxury — quiet, precise, confident. Think high-end
  atelier meets mission control.
- Dark theme is primary. Palette:
  - Background `#14141a`, panels `#1d1d26`, hairline borders `#2e2e3a`
  - Ink `#e8e9ee`, muted text `#8d90a0`, silver accents `#c9ccd6`
  - Signature gold `#c8a96a` (headings, accents, primary actions)
  - Status: pass/green `#5dbb7f`, fail/red `#e26d6d`, warning/amber `#d9a441`
- Typography: elegant serif display for headings and large numbers
  (Georgia-class; an Arabic-capable pairing such as Amiri for Arabic
  display text), clean geometric sans (11–13px, letter-spaced uppercase) for
  labels, table headers and metadata.
- Generous whitespace, 10px-radius cards, hairline borders, no drop-shadow
  noise. Large serif numerals for scores. Uppercase letter-spaced section
  labels in gold.
- Arabic text is a first-class citizen: RTL inputs and text blocks, large
  gold Arabic display type for names/calligraphy (e.g. "خالد"), bilingual
  labels where useful.

### Global layout

- Left icon+label sidebar navigation (collapsible), topbar with global
  search, environment badge ("Release 1"), notification bell (approvals
  pending count), and user avatar with role chip (e.g. "Design Director").
- Content area max-width ~1200px, card-based sections with uppercase gold
  section headers.
- Navigation items: Executive Dashboard, Design Studio, Collections, Arabic
  Studio, Materials, Manufacturing, CAD Studio, Costing, Suppliers,
  Workshop, Prototypes, Product Catalogue, Customer Co-Design, Marketing
  Studio, Analytics, Agent Command Center, Approvals, Knowledge Base,
  Settings.

### Key domain concepts to visualise (use these in components)

- **Design Readiness Score** 0–100 with release gate at 85 (radial gauge or
  large numeral with threshold marker).
- **Gate chain**: Concept → Brand → Arabic → Engineering → Safety → Cost →
  Commercial → QA → Human Approval. Each gate has a verdict: PASS /
  PASS_WITH_CONDITIONS / FAIL / HUMAN_REVIEW_REQUIRED / score out of 100.
  Safety FAIL always blocks — show it as absolute (red, lock icon).
- **Lifecycle states** (stepper/timeline): IDEA → RESEARCHING →
  BRIEF_APPROVED → CONCEPT_CREATED → BRAND_REVIEW → ARABIC_REVIEW →
  ENGINEERING_REVIEW → SAFETY_REVIEW → COST_REVIEW → COMMERCIAL_REVIEW →
  (REVISION_REQUIRED loops back) → DESIGN_APPROVED → VECTOR_PREPARED →
  CAD_PREPARED → PROTOTYPE_REQUESTED → PROTOTYPE_RECEIVED →
  PROTOTYPE_REVIEW → PRODUCTION_APPROVED → CATALOGUE_READY →
  MARKETING_READY → LIVE.
- **Reverse costing**: target retail (AED) + required margin % ⇒ a hard
  production-cost ceiling; show landed cost vs ceiling as a headroom bar
  (green under, amber within 5%, red over).
- **Issue log with correction routing**: each defect (e.g. COST_TOO_HIGH,
  INCORRECT_ARABIC, UNSAFE_BABY_PRODUCT) is routed to named agents.

### Screens to generate

1. **Executive Dashboard** — KPI tiles (concept-to-market days, gate
   pass-rate, average margin, return rate, predicted-vs-actual cost delta);
   a pipeline funnel showing design counts per lifecycle state; an
   "executive questions" panel of saved analytics cards ("Which designs
   produce the highest profit?", "Which workshop has the lowest defect
   rate?", "Predicted vs actual weight?") each with a sparkline/mini-chart.

2. **Design Studio** (the flagship screen; three columns):
   - Left: Design Brief card (title, product family chip, target segment,
     persona, target price AED 249, required margin 60%, personalisation
     toggle, Arabic text field shown RTL in gold), reference images strip,
     version-history timeline (v1 → v2 with change reasons).
   - Center: 4 concept cards ("Meem ID Bar", "Dune Cutout Cuff", "Falaj
     Braid", "Majlis Link") each with a thumbnail, story excerpt, material
     chip, weight, complexity and cost-band badges; the selected concept
     expands into a large preview with tabs Front / Rear / Side / 45° /
     Macro / Lifestyle, dimension callouts (200 × 8 × 1.6 mm) and estimated
     weight (7.5 g).
   - Right: score stack — Brand Fit 100, Manufacturability 100, Originality
     96, Commercial 85 as thin horizontal bars; Design Readiness gauge
     89.35 with the 85 threshold tick; mandatory badges "SAFETY: PASS"
     (green) and "ARABIC: APPROVED" (gold); agent recommendations feed;
     approval buttons (Approve / Approve with comments / Request revision /
     Reject) — disabled state until QA verdict exists.

3. **Arabic Studio** — RTL text input with large gold preview of the exact
   customer text (sample: خالد); validation checklist chips (letters ✓,
   connections ✓, dots ✓, hamza ✓, word order ✓, RTL ✓, diacritics ✓);
   calligraphy style gallery (Diwani, Diwani Jali, Naskh, Ruqaa, Aref
   Ruqaa, Amiri, Thuluth-inspired) as selectable cards; master artwork
   viewer with zoom and a manufacturability overlay (warnings on thin
   strokes/isolated dots); "spelling locked" banner after approval; list of
   products derived from this artwork; human approval bar at bottom.

4. **Approvals Inbox** — queue grouped by gate type (Arabic master artwork,
   religious text, child products, new materials, high production cost,
   final production files, mass production); each item opens an evidence
   drawer (scores, reports, files) with decision buttons APPROVED /
   APPROVED_WITH_COMMENTS / REVISION_REQUIRED / REJECTED and a mandatory
   comment field on non-approval; "submitted by / decided by" identity rows
   (the same person can never do both — show as disabled with tooltip).

5. **Agent Command Center** — live table of 14 agents (Market
   Intelligence, Brand DNA, Creative Design, Arabic Calligraphy,
   Manufacturing, Safety, Originality & IP, Cost, Commercial, CAD & Vector,
   Visualisation, Marketing, Independent QA, Prototype Evaluation) with
   status dot, current task, queue depth, retries, latency, API cost and
   confidence; a failures lane with retry/escalate actions; execution
   history showing concise structured decision summaries (never raw
   chain-of-thought); pinned human-escalation inbox.

6. **CAD Studio** — file list per design version (SVG positive, SVG
   reversed, DXF, technical PDF) with an engineering-style vector preview
   on white, layer toggles (ENGRAVE, CUT, KEEP_CLEAR, STONE_SETTING,
   REFERENCE, DIMENSIONS), mm-unit dimension annotations, validation report
   (closed paths ✓, no raster ✓, mm units ✓), an "immutable — hash locked"
   badge on approved files, and signed download buttons.

7. **Costing** — two modes in tabs. Forward: editable cost stack (silver
   weight/price, stones, CAD, laser, casting, soldering, handcraft,
   plating, polishing, assembly, packaging, QC, scrap %, supplier margin,
   delivery, payment fees, advertising & returns allowances) with computed
   totals and price ladder (minimum AED 112 / recommended AED 251 / premium
   AED 314). Reverse: target retail AED 249 + margin 60% ⇒ ceiling AED
   99.60, with a headroom bar against landed cost AED 97.69 and a "route
   back for redesign" action when over.

8. **Product Catalogue / Digital Product Passport** — product grid with
   SKU badges (e.g. BS-ME-BRAC-000042-V1); detail view as a passport:
   material, dimensions, weight, finish, manufacturing method, workshop,
   supplier, cost, retail, margin, linked CAD/vector/render files, safety
   assessment, QA report, prototype and production history, marketing
   assets, sales performance and return rate.

9. **Materials** — table/cards of materials (925 Sterling Silver, Fine
   Silver, Stainless Steel 316L, Gold-Plated 925, Rose-Gold-Plated 925,
   Rhodium & Black Rhodium 925, Leather, Onyx, Mother of Pearl) with
   composition, density, cost/gram AED, process compatibility icons
   (casting/laser/CNC/plating), minimum thickness, waste factor, cost band;
   a "claims" panel where restricted claims (hypoallergenic, nickel-free,
   certified…) show a red "evidence required" state unless a certification
   document is attached.

10. **Prototype Management** — predicted-vs-actual comparison cards
    (weight 7.5 g predicted / 7.9 g actual; cost; dimensions), surface and
    Arabic-accuracy quality ratings, workshop feedback notes, conformance
    verdict, and a decision bar for production approval.

### Components to include in the design system

Score gauge with threshold tick; verdict chip (pass/fail/warn/human-review);
lifecycle stepper with loop-back state; headroom/ceiling bar; RTL Arabic
input + large Arabic display card; gate-chain table; issue-routing table;
evidence drawer; approval action bar with mandatory-comment state;
immutable/hash-locked badge; agent status row; KPI tile; version timeline.

### States to show

Populate with realistic sample data (the AED 249 men's personalised Arabic
bracelet "خالد", readiness 89.35, landed cost 97.69 vs ceiling 99.60). Also
design the blocked state: a red "Production blocked — 3 reasons" panel
(e.g. "safety: FAIL", "cost: landed 155.31 AED exceeds ceiling 99.60 AED",
"qa: REVISION_REQUIRED") with the issue log routing each defect to its
agent. Show empty, loading (skeleton), and human-review-required states for
key panels.

### Accessibility & localisation

WCAG AA contrast on the dark palette; full RTL mirroring for an Arabic UI
mode; all status conveyed by icon + text, never colour alone; keyboard
navigable approval flows.

Deliver: desktop-first responsive layouts (1440px primary, tablet
secondary), a cohesive component library, and the ten screens above.

---

## Usage notes (not part of the prompt)

- Paste everything between the horizontal rules into the target tool.
- If the tool has a hard prompt-length limit, keep sections "Brand & visual
  language", "Key domain concepts" and screens 2, 3, 4, 5 — these define
  the product; the rest can be added iteratively.
- The palette and type choices match the already-deployed Design Studio at
  the Vercel site, so generated screens will be visually consistent with
  the live Release 1 UI.
