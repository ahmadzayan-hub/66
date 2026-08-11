# System Architecture

## 1. Overview

The OS is a modular monolith (Release 1) organised by the Common Closure
Principle: code is grouped by feature/use case, not by technical layer. The
platform layer provides orchestration, model gateway, eventing, audit, memory
and security primitives shared by all features.

```
┌────────────────────────────────────────────────────────────────┐
│                          UI (Release 1: CLI/demo + API)        │
├────────────────────────────────────────────────────────────────┤
│  Feature slices (each owns models, services, agents, tests)    │
│  design-studio │ arabic-design │ manufacturing │ safety        │
│  costing │ commercial │ brand │ originality │ cad │ materials  │
│  products │ approvals │ qa │ marketing │ prototypes │ ...      │
├────────────────────────────────────────────────────────────────┤
│  Platform                                                       │
│  orchestration (state machine, gates, routing)                  │
│  model-gateway (provider-agnostic AI access + fallback)         │
│  event-bus │ audit │ memory │ knowledge-graph │ security        │
├────────────────────────────────────────────────────────────────┤
│  Storage: relational DB (system of record) │ object storage     │
│  (CAD/render/media files, content-addressed, immutable)         │
└────────────────────────────────────────────────────────────────┘
```

Key rule: the **control plane is deterministic code** (gates, state machine,
scoring, routing); AI models only produce *content* (concepts, copy, artwork
proposals) which is then validated by deterministic rules and independent
agents.

## 2. Runtime components

- **Design Orchestrator** — interprets requests, plans, sequences agents,
  enforces the gate chain, resolves conflicts, triggers rework and human
  escalation. It cannot approve outputs (approval lives in QA + human gates).
- **Agent runtime** — each specialist agent is a module with a typed input,
  typed output, a declared `agentId`, and a declared capability (`generate`,
  `evaluate`, `export`). QA independence is enforced by comparing `agentId`
  lineage on artifacts.
- **Event bus** — in-process pub/sub (Release 1) emitting the domain events of
  §37 (DesignBriefCreated, ArabicValidationFailed, CostExceeded, SafetyRejected,
  DesignApproved, …). Agents subscribe to relevant events; every event is also
  persisted to the audit log. The bus interface is transport-agnostic so
  Release 2+ can move to a durable queue without feature changes.
- **Memory** — four layers (Working / Product / Brand / Learning). Writes to
  Brand and Learning memory pass a validation gate: only human-approved or
  ground-truth-verified facts are persisted (never raw model output).

## 3. Technology choices (Release 1)

- TypeScript on Node.js ≥ 20 — one language across domain logic, validators and
  exporters; strong typing for gate contracts.
- No runtime dependencies in the core domain (validators, costing, state
  machine, SVG/DXF writers are pure code) — maximises testability and removes
  supply-chain surface from the production-critical path.
- Vitest for the automated test suite.
- Persistence behind repository interfaces; Release 1 ships an in-memory/JSON
  implementation, Release 2 swaps in PostgreSQL using the schema in
  04-data-architecture.md without touching feature logic.

## 4. Folder structure

```
src/
  features/
    design-studio/        # briefs, concepts, versions, readiness score
      models/ services/ agents/ tests/
    arabic-design/        # exact-text pipeline, master artwork registry
      models/ validators/ agents/ tests/
    brand/                # brand DNA definition + scoring agent
    manufacturing/        # rules engine, workshop profiles, engineering agent
      models/ rules/ agents/ tests/
    safety/               # safety rules, child category controls
      rules/ agents/ tests/
    costing/              # cost model, reverse costing
      models/ calculators/ agents/ tests/
    commercial/           # commercial viability scoring
    originality/          # originality / IP screening
    cad/                  # SVG/DXF exporters + validators
      exporters/ validators/ tests/
    materials/            # material database + claim guard
    products/             # SKU, digital product passport, catalogue
    approvals/            # human approval gates and records
    qa/                   # independent QA agent
    marketing/            # bilingual copy generation (validated Arabic)
    prototypes/           # prototype evaluation (Release 2 full)
    collections/ suppliers/ workshops/ customers/ personalisation/ analytics/
  platform/
    orchestration/        # state machine, orchestrator, correction routing
    model-gateway/        # provider-agnostic model access, fallback, redaction
    event-bus/
    memory/
    audit/
    security/
    knowledge-graph/      # Release 3
    storage/
scripts/
  demo-definition-of-done.ts
```

Each feature owns its models, logic, services and tests. There is no shared
"utils" dumping ground; genuinely cross-cutting concerns live in `platform/`.

## 5. API architecture

Release 1 exposes the orchestrator programmatically (used by the demo runner and
tests). Release 2 adds an HTTP API with this shape:

- Style: JSON REST, versioned under `/api/v1`, OpenAPI-documented.
- Auth: OAuth2/OIDC bearer tokens; API keys for service-to-service; MFA
  enforced for privileged roles at the identity provider.
- Idempotency: all mutating endpoints accept an `Idempotency-Key`.
- Rate limiting per principal; CORS restricted to first-party origins; CSRF
  tokens on browser sessions.

Core resource groups:

```
POST   /api/v1/design-briefs                 create brief (or from opportunity)
POST   /api/v1/designs/{id}/run-pipeline     run gate chain (async job)
GET    /api/v1/designs/{id}                  design + current version + scores
GET    /api/v1/designs/{id}/versions         version history
POST   /api/v1/designs/{id}/approvals        record human approval decision
POST   /api/v1/arabic/validate               exact-text validation
POST   /api/v1/arabic/master-artworks        create master artwork (pending approval)
GET    /api/v1/materials                     material database
POST   /api/v1/costing/reverse               reverse costing calculation
GET    /api/v1/designs/{id}/exports/{fmt}    signed URL to SVG/DXF/PDF
GET    /api/v1/products/{sku}/passport       digital product passport
GET    /api/v1/agents/runs                   agent command center feed
GET    /api/v1/analytics/executive           executive dashboard queries
```

Async work (pipeline runs, exports, renders) returns a job resource; clients
poll or subscribe to server-sent events. File downloads are signed, expiring
URLs only.

## 6. Event catalogue (Release 1 subset)

`DesignBriefCreated`, `ConceptGenerated`, `BrandReviewCompleted`,
`ArabicValidationFailed`, `ArabicMasterArtworkApproved`,
`EngineeringReviewFailed`, `SafetyRejected`, `CostExceeded`,
`CommercialReviewCompleted`, `RevisionRequired`, `DesignApproved`,
`VectorPrepared`, `ProductionApproved`, `HumanReviewRequired`,
`PrototypeRequested`.

Every event carries: `eventId`, `designId`, `versionId`, `agentId` (emitter),
`timestamp`, `payload`, and is appended to the audit log before delivery.
