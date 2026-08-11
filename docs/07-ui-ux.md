# UI/UX — Sitemap & Wireframe Descriptions

Premium Beyond Style UAE interface: modern Arabic-luxury aesthetic — deep
charcoal + warm silver palette, generous whitespace, bilingual (Arabic RTL /
English LTR) throughout, elegant serif display type for headings with a clean
sans for data.

## 1. Sitemap (§32)

```
/                        Executive Dashboard
/design-studio           Design Studio (pipeline workbench)
/collections             Collections (portfolio strategy view)
/arabic-studio           Arabic Studio (text validation → master artwork)
/materials               Materials database
/manufacturing           Manufacturing (rules, workshop profiles)
/cad-studio              CAD Studio (exports, layers, file history)
/costing                 Costing (forward + reverse costing)
/suppliers               Suppliers
/workshop                Workshop portal (Workshop User role)
/prototypes              Prototype Management
/catalogue               Product Catalogue (passports)
/co-design               Customer Co-Design intake
/marketing-studio        Marketing Studio (bilingual assets)
/analytics               Analytics (executive questions, §43)
/agents                  Agent Command Center
/approvals               Approvals inbox
/knowledge               Knowledge Base
/settings                Settings (roles, rules, model gateway, weights)
```

## 2. Wireframe descriptions (§33–34 plus key screens)

### 2.1 Executive Dashboard
Top row: KPI tiles (concept-to-market days, gate pass-rate, avg margin, return
rate, predicted-vs-actual cost delta). Middle: portfolio funnel (IDEA → LIVE
counts by state). Bottom: "answers" panel rendering the twelve §43 executive
questions as saved queries with drill-down.

### 2.2 Design Studio (single-screen workbench)
Three-column layout.
- **Left**: Design Brief (target segment, price, personalisation, Arabic
  text), reference images (sanitised), version history timeline with diffs.
- **Center**: concept cards (the 4 distinct concepts) → selected design with
  3D/render preview tabs (Front/Rear/Side/45°/Macro/Lifestyle), dimensions and
  weight callouts, material chip, manufacturing method.
- **Right**: score stack — Brand Fit, Manufacturability, Originality,
  Commercial, Cost feasibility, Aesthetic, Market relevance, Personalisation;
  Design Readiness gauge with 85 threshold marker; mandatory badges (Safety
  PASS/FAIL, Arabic PASS/FAIL); agent recommendations feed; approval controls
  (visible per role, disabled until QA verdict present).

### 2.3 Arabic Studio
Input pane (exact customer text, locked after approval, shown with harakat
toggle) → validation checklist (letters, connections, dots, hamza, word order,
RTL, diacritics) each with pass/fail chips → calligraphy style gallery
(Diwani, Diwani Jali, Naskh, Ruqaa, Aref Ruqaa, Amiri, Thuluth-inspired) →
master artwork viewer (vector, zoom to node level) → manufacturability overlay
(bridge/dot/stroke-width warnings from the Manufacturing agent) → human
approval bar. Every derived product using this artwork is listed at bottom.

### 2.4 Agent Command Center (§34)
Live table: agent, current task, queue depth, dependencies, retries, latency,
API cost, confidence. Failure lane with retry/escalate actions. Execution
history with per-run **concise decision summaries** (structured verdicts and
reasons only — private chain-of-thought is never displayed or stored).
Human-escalation inbox pinned at top.

### 2.5 Approvals inbox
Grouped by gate type (Arabic master artwork, religious text, child products,
new materials, new workshop process, high cost, unusual technique, final
production files, mass production). Each item: evidence bundle (scores,
reports, files), decision buttons APPROVED / APPROVED_WITH_COMMENTS /
REVISION_REQUIRED / REJECTED, mandatory comment on non-approval. Decisions are
signed and audit-logged; submitter cannot approve own item.

### 2.6 CAD Studio
File list per design version: SVG/DXF/PDF with layer preview
(ENGRAVE/CUT/KEEP_CLEAR/STONE_SETTING/REFERENCE/DIMENSIONS toggles), positive/
reversed switch, node-count and path-closure validation report, immutable
hash badge for approved files, signed-URL download.

### 2.7 Costing
Forward mode: editable cost stack → computed totals, margins, price ladder
(minimum / recommended / premium). Reverse mode: target retail + required
margin → cost ceiling with red/green headroom bar against the current design's
estimated cost; "route back for redesign" action when over ceiling.

### 2.8 Customer Co-Design (Release 2)
Guided intake (text/voice/photo/sketch/reference), live sanitised preview,
structured brief output, price estimate, spelling confirmation step with
explicit "I approve this exact spelling" checkpoint (recorded verbatim).
