# Agent Architecture, Responsibility Matrix, Workflows & State Machine

## 1. Agent model

Every agent is a typed module with:

- `agentId` — stable identifier recorded on every output artifact.
- `capability` — `generate` | `evaluate` | `export`. The orchestrator refuses
  to accept an `evaluate` verdict on an artifact whose lineage contains the
  same `agentId` (separation of duties, master prompt §2 and rule 52.8).
- Typed input/output contracts (see `src/features/*/agents`).
- Deterministic core where possible; model-backed content generation goes
  through the Model Gateway and is always post-validated by deterministic
  rules.
- A confidence value; below-threshold confidence yields
  `HUMAN_REVIEW_REQUIRED` instead of a guess (fail-safe, §46).

## 2. The Design Orchestrator

Responsibilities: interpret business requests; build an execution plan; select
and sequence agents; manage dependencies; track lifecycle state; resolve agent
conflicts; trigger rework via correction routing; request human escalation;
maintain auditability. It holds **no approval authority** — it can only advance
state when the responsible gate/agent/human has produced a passing verdict.

## 3. Agent Responsibility Matrix

| # | Agent | Capability | Generates | Evaluates | Blocks production on fail | Human gate downstream |
|---|---|---|---|---|---|---|
| 01 | Market Intelligence | generate | Opportunities, segments, price bands | — | No | No |
| 02 | Brand DNA | evaluate | — | Brand Fit Score 0–100 | Via readiness score | No |
| 03 | Creative Design | generate | 4 materially different concepts | — | No | No |
| 04 | Arabic Calligraphy | generate + evaluate (validation sub-module is separate code path) | Master artwork proposal, vector geometry | Exact text / RTL / spelling validation | **Yes (mandatory when Arabic present)** | **Yes — master artwork & religious text** |
| 05 | Manufacturing Engineering | evaluate | Recommended dimensions | Manufacturability score, failure points | Yes (Engineering Gate) | New workshop process |
| 06 | Product Safety | evaluate | — | PASS / PASS_WITH_CONDITIONS / FAIL | **Yes — FAIL is absolute** | **Yes — all child products** |
| 07 | Originality & IP | evaluate | Recommended modifications | Originality score, similarity risk | Via readiness score; escalates IP issues | Uncertain IP ownership |
| 08 | Cost Engineering | evaluate | Cost breakdown, reverse-cost ceiling | Cost feasibility | Yes (Cost Gate) | High production cost |
| 09 | Commercial Viability | evaluate | — | Commercial score 0–100 | Via readiness score | No |
| 10 | CAD & Vector | export | SVG/DXF/technical files (post-approval only) | File validity | Yes (invalid files block) | Final production files |
| 11 | Visualisation | generate | Renders (post-engineering-validation only; never alters approved geometry) | — | No | No |
| 12 | Marketing | generate | Bilingual copy (Arabic re-validated) | — | No | No |
| 13 | Independent QA | evaluate | — | Approved / Revision Required / Rejected / Human Review Required | **Yes** | Escalation target |
| 14 | Prototype Evaluation | evaluate | Predicted-vs-actual report | Prototype conformance | Yes (Production Gate) | Mass production |

Separation-of-duties invariants (enforced in code):

1. QA agent never evaluates an artifact it generated (it generates none).
2. The Creative Design agent's output cannot pass any gate by its own scores.
3. The orchestrator can route and block, never approve.
4. Rendering cannot mutate approved geometry (renders reference immutable
   artifact IDs).
5. Approved production files are immutable (content-addressed, write-once).

## 4. Workflow diagrams

### 4.1 Happy path (new personalised Arabic product)

```
Business request
   │
   ▼
[Orchestrator] ── plan ──► [Market Intelligence] ─► Opportunity
   │                                                (optional if brief given)
   ▼
Design Brief (BRIEF_APPROVED)
   │
   ▼
[Creative Design] ─► 4 distinct concepts (CONCEPT_CREATED)
   │
   ▼
[Brand DNA] ─► Brand Fit Score ──────────────► BRAND_REVIEW
   │
   ▼ (Arabic present?)
[Arabic pipeline] exact text → RTL → spelling → style → MASTER ARTWORK
   │        └─ human approval: Arabic master artwork      ARABIC_REVIEW
   ▼
[Manufacturing] rules vs workshop profile ───► ENGINEERING_REVIEW
   │
   ▼
[Safety] PASS/PASS_WITH_CONDITIONS/FAIL ─────► SAFETY_REVIEW
   │  (FAIL ⇒ blocked, routed to correction)
   ▼
[Cost Engineering] forward + reverse costing ► COST_REVIEW
   │  (over ceiling ⇒ RevisionRequired → Design+Cost agents)
   ▼
[Commercial] + [Originality] scores ─────────► COMMERCIAL_REVIEW
   │
   ▼
Design Readiness Score ≥ 85 AND mandatory passes
   │
   ▼
[Independent QA] full re-validation ─────────► DESIGN_APPROVED
   │
   ▼
Human approval (final design)  ──────────────► VECTOR_PREPARED / CAD_PREPARED
   │            [CAD & Vector] SVG/DXF layers, positive+reversed
   ▼
[Visualisation] renders (front/rear/side/lifestyle…)
   │
   ▼
PROTOTYPE_REQUESTED → PROTOTYPE_RECEIVED → [Prototype Evaluation]
   │                                        predicted vs actual
   ▼
Human approval (mass production) ────────────► PRODUCTION_APPROVED
   │
   ▼
Digital Product Passport → CATALOGUE_READY → [Marketing] → MARKETING_READY → LIVE
```

### 4.2 Correction routing (§22)

```
Defect detected ──► Issue Log ──► route:
  incorrect Arabic            → Arabic Agent
  fragile geometry            → Manufacturing Agent
  cost too high               → Cost Agent + Design Agent
  unsafe baby product         → Safety Agent (+ mandatory human gate)
  copied appearance           → Originality Agent
  weak brand identity         → Brand Agent
  low margin                  → Commercial + Cost Agent
  poor render consistency     → Visualisation Agent
Design state → REVISION_REQUIRED; re-enters gate chain at the failed gate;
all downstream gates re-run (no stale passes).
```

## 5. Lifecycle state machine (§21)

States: `IDEA, RESEARCHING, BRIEF_APPROVED, CONCEPT_CREATED, BRAND_REVIEW,
ARABIC_REVIEW, ENGINEERING_REVIEW, SAFETY_REVIEW, COST_REVIEW,
COMMERCIAL_REVIEW, REVISION_REQUIRED, DESIGN_APPROVED, VECTOR_PREPARED,
CAD_PREPARED, PROTOTYPE_REQUESTED, PROTOTYPE_RECEIVED, PROTOTYPE_REVIEW,
PRODUCTION_APPROVED, CATALOGUE_READY, MARKETING_READY, LIVE, PAUSED, RETIRED`.

Rules enforced by `platform/orchestration/state-machine`:

- Transitions only along declared edges; any other transition throws
  (`IllegalTransition`) and is audited. **No silent skipping.**
- `ARABIC_REVIEW` is skipped *explicitly* (recorded skip-with-reason event)
  only when the design contains no Arabic.
- `REVISION_REQUIRED` is reachable from every review state; exit re-enters at
  the failed gate.
- `PAUSED` reachable from any post-approval state; resume returns to the exact
  prior state.
- `RETIRED` is terminal.
- Every transition record: `designId, versionId, from, to, actor (agentId or
  userId), reason, timestamp`.

## 6. Fail-safe behaviour (§46)

Any agent returns `HUMAN_REVIEW_REQUIRED` (never a guess) for: unknown
gemstone, uncertain Arabic phrase, unknown plating, unverified manufacturing
parameter, unusual children's product, uncertain IP ownership, complex
load-bearing geometry, or model-confidence below threshold. The orchestrator
parks the design and opens an approval task.
