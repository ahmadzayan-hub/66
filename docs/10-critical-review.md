# Critical Architecture Review (pre-implementation, §50)

Findings from adversarial review of the proposed architecture, with the fixes
applied **before** implementation.

## 1. Missing requirements found

| Finding | Fix applied |
|---|---|
| The master prompt's gate chain omits *when* renders happen relative to marketing; a render could drift from approved geometry | Renders reference immutable artifact IDs; Visualisation runs only post-engineering-validation; marketing consumes render IDs, never regenerates |
| No explicit rule for skipping ARABIC_REVIEW on non-Arabic designs — risk of silent skip violating "no silent state skipping" | Explicit *recorded* skip-with-reason transition event; tested |
| Reverse costing defined, but no headroom policy when estimate ≈ ceiling | Added 5% headroom warning band; at/over ceiling ⇒ RevisionRequired |
| Customer-approved spelling immutability stated, but no lock timestamp/actor | `approved_spelling_locked_at` + lock actor recorded; validators compare against the locked string |
| Weighted readiness score could mask a near-zero manufacturability with high other scores | Added per-dimension floor (any dimension < 40 ⇒ REVISION_REQUIRED regardless of total) |
| "4 materially different concepts" had no enforceable definition | Distinctness check: concepts must differ on ≥2 of {visual language, construction, material treatment, personalisation mechanic}; enforced by validator, not prompt hope |

## 2. Architectural weaknesses found

| Weakness | Fix |
|---|---|
| Original plan let agents call each other directly → hidden coupling, unauditable flows | All inter-agent flow goes through the orchestrator + event bus; agents are pure request/response |
| Score weights configurable at runtime → could be tuned to pass a failing design | Weight changes are versioned, human-approved, and audited; mandatory overrides (safety, Arabic, floors) are non-configurable code |
| In-memory event bus loses events on crash mid-pipeline | Events append to audit log *before* delivery; pipeline is resumable from last recorded state; R2 moves to durable queue behind the same interface |
| QA "independence" by convention only | Enforced structurally: artifacts carry generator lineage; `evaluate` calls verify lineage ∌ evaluator agentId; tested invariant |

## 3. Security risks found

- SVG upload XSS/script vectors → sanitising re-builder, CSP, asset domain.
- Prompt injection through personalisation strings → data-field delimiting +
  output schema validation (a name like "ignore previous instructions" is
  just engraving text).
- Approval-forgery risk (agent writing approval rows) → approvals table
  accepts only authenticated human principals; agents lack the permission
  code entirely.
- Model provider data retention → payload classification + redaction +
  provider allow-list per data class.

## 4. AI failure modes addressed

- Hallucinated materials/claims → claims require evidence rows (hard guard).
- Confident-but-wrong Arabic → deterministic validators (RTL, letterforms,
  dots, connectivity) run *after* any model step; uncertainty ⇒ human gate.
- Model outage → fallback chain then HUMAN_REVIEW_REQUIRED; never silent.
- Reward hacking of scores → evaluators cannot see the 85 threshold in their
  inputs; scoring rubrics fixed in code.

## 5. Commercial & manufacturing risks addressed

- Margin erosion from landed-cost blind spots → cost model includes scrap,
  supplier margin, delivery, payment fees, advertising and returns
  allowances (all in the Release 1 calculator).
- Workshop variance → engineering thresholds are per-workshop overrides on
  documented defaults, not universal constants.
- Prototype divergence → predicted-vs-actual capture is a first-class table
  from Release 1 so the learning loop has data from day one.

## 6. Scalability risks

- Single-process monolith acceptable for R1 volumes (design throughput is
  human-gated anyway); the event-bus and repository interfaces are the seams
  for extraction. Object storage is content-addressed from day one, so file
  volume scales independently.

## Verdict

Architecture approved for implementation with the fixes above incorporated.
All fixes are reflected in the Release 1 code and its test suite.
