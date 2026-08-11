# Release Roadmap, Testing Strategy, Agent Evaluation & Acceptance Criteria

## 1. Release roadmap (§47)

### Release 1 — Production MVP (this repository)
Design Orchestrator; Design Studio (programmatic + demo); Creative, Brand,
Arabic, Manufacturing, Safety, Cost, Commercial, QA agents; design versioning;
approval workflow; materials database; SVG/DXF export; basic product
catalogue/passport; basic rendering hooks. **No Release 2 development until
Release 1 passes the acceptance tests in §4 below.**

### Release 2
Customer Co-Design; advanced collections; supplier management; prototype
management (full); Marketing Studio; advanced catalogue; performance
analytics; PostgreSQL persistence; HTTP API + web UI.

### Release 3
Advanced 3D CAD (STL/STEP/3DM); demand forecasting; knowledge graph
activation; automated trend intelligence; production optimisation;
design-performance learning; advanced customer personalisation.

## 2. Testing strategy (§48)

Layers:
1. **Unit** — validators, calculators, exporters (pure functions).
2. **Invariant/property** — separation of duties, immutability, mandatory
   gate overrides, no-silent-skip.
3. **Pipeline integration** — full orchestrated runs incl. failure routing.
4. **Golden files** — SVG/DXF outputs diffed against approved fixtures.

Required automated coverage (all implemented in `src/**/tests`):
Arabic RTL; Arabic dots; Arabic connectivity; cost calculations; weight
calculations; design state transitions; safety rejection; child product
rejection; engineering thresholds; SVG path validation; DXF dimensions; role
permissions; version history; agent routing; retry handling; API
authentication (gateway/auth guard level in R1); customer data security
(redaction); production file immutability.

CI gate: `npm test` must pass with zero skipped mandatory suites before any
merge to main.

## 3. Agent evaluation strategy (§49)

Benchmark harness per critical agent (`src/platform/benchmarks` pattern,
seeded in Release 1 for Arabic, Manufacturing, Safety, Cost):

- Curated benchmark cases with ground-truth labels (e.g. Arabic strings with
  known defects; geometries with known thin walls; child products with known
  hazards; cost sheets with hand-computed answers).
- Metrics per agent: accuracy, consistency (same input → same verdict across
  N runs), false-positive rate, false-negative rate, latency, AI cost, human
  correction rate (from approvals data), failure recovery (behaviour under
  provider outage — must degrade to HUMAN_REVIEW_REQUIRED).
- Safety-critical agents (Safety, Arabic) are tuned to prefer false positives;
  their false-negative rate on the benchmark must be zero for the documented
  hazard classes before production readiness is declared.
- The system is not declared production-ready until benchmark results are
  documented and signed off.

## 4. Acceptance criteria — Definition of Done (§51)

Scenario: *"Create an original men's 925 sterling silver personalised Arabic
bracelet for UAE customers with a target retail price of AED 249."*

The system must produce, stored under one traceable Design ID + Version ID:
structured design brief; 4 genuinely different concepts; customer persona;
market rationale; Brand Fit Score; exact Arabic validation; approved Arabic
master artwork (human-gated); material selection; dimensions; estimated
weight; manufacturing method; engineering review; safety review; cost
estimate; maximum manufacturing cost (reverse costing); recommended retail
price; expected margin; Commercial Viability Score; Originality Score; Design
Readiness Score; SVG; DXF; technical production instructions; front/rear/
side/lifestyle render specs; product SKU; product description; Arabic
marketing copy; English marketing copy; QA report; human approval record;
prototype request.

Pass conditions:
- Every mandatory gate ran and passed (or the run stops with a blocking
  verdict — silent passage is a failure).
- QA agent is provably not the generator of anything it validated.
- Approved version and exported files are immutable afterwards.
- The full run is reproducible via `npm run demo` and asserted by the
  integration test suite.
