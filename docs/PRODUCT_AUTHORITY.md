# Product Authority — 66 · Beyond Style Design Engine

The single, non-negotiable statement of what this product owns. No other
product in the portfolio may claim these responsibilities, and this product
may not expand into anyone else's.

## Primary User

Two users, one system:

- **The customer** — a UAE buyer who wants a personalised 925-silver piece
  and can describe it in their own words (Arabic, English, or mixed).
- **The design/production team** — the Arabic specialist, design director
  and operations staff who approve what the customer chose.

## Job To Be Done

Turn a customer's idea into an **original, safe, manufacturable and
commercially viable** jewellery design — with production files a workshop
can actually cut — without a designer starting from a blank canvas.

## System of Record

- Customer design intent and the structured design brief
- Concepts, selected concept and design versions
- Arabic master artwork (approved text, style, letter geometry)
- Engineering geometry, manufacturing constraints and tolerances
- Cost model, margin and commercial viability per design
- Production artefacts: SVG, DXF, BOM, job card, design passport
- The approval chain and lifecycle transitions for every design

## System of Intelligence

- Multimodal understanding of the customer's request (perception and
  reasoning layer)
- Original concept proposal and design-story generation
- Manufacturability, safety, originality and commercial scoring
- Design memory: what sold, what failed QA, what the workshop struggled with

## Primary Workflow

```
Describe (text · voice · image)
  → Understood design brief (customer confirms or corrects)
  → Concept gallery (3–6 original proposals)
  → Customer selects
  → Deterministic gates: Arabic geometry · engineering · safety · cost ·
    originality · QA
  → Readiness score
  → Customer approves the design
  → Human approvals (design director → operations)
  → Production files (SVG / DXF / BOM / job card)
  → Prototype → QC → outcome learning
```

## Human Decision Boundary

- AI **proposes**; deterministic engines **judge**; humans **approve**.
- A generated image is **concept visualisation only**. It is never a
  manufacturing specification. Production geometry comes exclusively from
  the structured design model, Arabic outline geometry, engineering rules
  and tolerances.
- No design reaches production on an AI decision. Every release requires
  the Arabic specialist (for Arabic artwork), the design director (final
  design) and operations (production files).
- Wearable child products always require dedicated human safety approval —
  the interface cannot override that gate.
- Production rules never self-modify. Outcome → evaluation → lesson
  candidate → human review → assurance tests → versioned change.

## Measurable Outcome

**North star:** customer idea → manufacturable approved design, lead time.

Supporting: first-pass gate rate, rework rate, QA failure rate, margin
achieved versus target, prototype-to-production conversion.

## Explicit Non-Goals

- Not an image generator, and not a "text to pretty render" tool
- Does not sell, take payment, or manage orders → **Masaar**
- Does not run the business/product portfolio → **BSOS**
- Does not own prompt lifecycle → **PromptOps**
- Does not issue AI release verdicts → **AI Assurance Lab**
- Does not replace the workshop's own QC records

## External Systems

- Model Gateway (concept proposal; optional — the pipeline runs fully
  deterministic with no external dependency)
- Masaar (orders that originate from an approved design)
- BSOS (portfolio-level concept demand)
- AI Assurance Lab (evaluation of any model-backed step)
- Workshop / CAM tooling (consumes SVG, DXF, job card)

## Data Ownership

66 owns its own database. Other products receive design outcomes through
APIs and versioned domain events — never by reading these tables. Customer
identity beyond what a design needs stays with the product that owns the
customer relationship (Masaar). Uploaded reference images are customer
data: stored under the customer's design record, never used as training
input without explicit consent.
