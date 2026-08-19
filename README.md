# Beyond Style UAE — Agentic Product Design Operating System

An AI-native product development platform that converts UAE market
opportunities and customer needs into **original, safe, manufacturable,
commercially viable** 925-silver jewellery — with a controlled, audited
pipeline from idea to production approval. This is not an image generator:
the control plane (gates, validators, scoring, state machine) is
deterministic code, and no single agent can create, approve and release the
same design.

## Release 1 (this repository)

```
npm install
npm test          # 66 automated tests covering §48 of the master spec
npm run demo      # Definition-of-Done scenario (§51), CLI output
npm run build:site && npm run dev   # local Design Studio at http://localhost:3000
```

## Live Design Studio (Vercel)

The deployed site is an interactive Design Studio: set an Arabic name,
calligraphy style, product family, concept, target price and margin, toggle
the mandatory human gates, and run the real gate chain server-side
(`api/pipeline.ts`, a Vercel serverless function). Results render live —
scores, per-gate verdicts, block reasons, the issue log with correction
routing, the approved master artwork, the production SVG preview and
SVG/DXF/record downloads. `/snapshot.html` is the build-time verification
run: if the pipeline ever regressed, the deployment itself would fail.

### Optional: real LLM (Claude) for concept generation

By default every agent — including Creative Design — runs on deterministic
code, so the whole pipeline works with zero external dependencies. Set the
`ANTHROPIC_API_KEY` environment variable (Vercel: Project Settings →
Environment Variables; local: `export ANTHROPIC_API_KEY=...` before
`npm run dev`) to let the Creative Design agent ask Claude for concept
proposals instead. The LLM only *proposes* — every gate that matters (Brand,
Arabic, Engineering, Safety, Cost, Commercial, Originality, QA) stays
deterministic and unchanged, and any invalid or non-distinct LLM proposal
falls back to the built-in concept library automatically. The Design
Studio's Concept Gate row shows which path actually produced the run's
concepts. See `docs/06-model-gateway.md` for the full design.

The demo executes the acceptance scenario end-to-end — *"Create an original
men's 925 sterling silver personalised Arabic bracelet for UAE customers with
a target retail price of AED 249"* — producing the structured brief, 4
materially different concepts, exact Arabic validation with a human-approved
master artwork (خالد, Diwani), engineering/safety/cost/commercial/originality
reviews, the Design Readiness Score, production SVG + reversed SVG + DXF
(mm units, layered), technical production instructions, marketing copy, QA
report, human approval records and a prototype request — all under one
traceable Design ID + Version ID in `output/design-record.json`.

## What is enforced in code (not by convention)

- **Gate chain**: Concept → Brand → Arabic → Engineering → Safety → Cost →
  Commercial → QA → Human approval; any mandatory failure blocks production.
- **Separation of duties**: evaluators reject artifacts carrying their own
  lineage; the orchestrator holds no approval authority; humans cannot
  approve their own submissions; agents hold no approval permissions.
- **Arabic integrity**: image models never determine Arabic text; artwork
  derives from a locked, human-approved spelling; any derivation that alters
  letters, dots, hamza, diacritics or word order throws.
- **Safety supremacy**: safety FAIL is absolute; child products have a
  separate hazard-class rulebook; wearable child products always require
  dedicated human approval.
- **Reverse costing**: target retail + required margin ⇒ enforced production
  cost ceiling (AED 249 @ 60% ⇒ 99.60 ceiling).
- **Immutability**: approved design versions and production files are
  write-once; revisions fork child versions.
- **No silent state skipping**: 23-state lifecycle with declared edges; the
  only sanctioned skip (Arabic gate for non-Arabic designs) is itself a
  recorded transition.
- **Claim guard**: "hypoallergenic / nickel-free / certified / …" never
  appears without certification evidence.
- **Fail-safe**: provider outages and low-confidence outputs degrade to
  `HUMAN_REVIEW_REQUIRED`, never to a guess.

## Documentation

The full architecture set (PRD, system/agent/data/security architecture,
model gateway, UI, roadmap, testing & agent-evaluation strategy, risk
register, and the pre-implementation critical review) lives in
[`docs/`](docs/00-index.md).

## Layout

```
docs/       Architecture documentation (master prompt §50 deliverables)
src/
  features/   Feature slices (design-studio, arabic-design, manufacturing,
              safety, costing, commercial, originality, cad, materials,
              approvals, qa, marketing, products, analytics, brand)
  platform/   Orchestration (state machine, orchestrator, issue routing),
              model gateway, event bus, audit log, RBAC
scripts/    Definition-of-Done demo runner
```

Release 2 adds customer co-design, supplier/prototype management, the
Marketing Studio, PostgreSQL persistence and the HTTP API; Release 3 adds
3D CAD, forecasting, the knowledge graph and the learning loop — per the
[release roadmap](docs/08-delivery.md).
