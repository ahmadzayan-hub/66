# Product Requirements Document (PRD)

Beyond Style UAE — Agentic Product Design Operating System (the "OS").

## A. Product Requirements

### A1. Vision

An AI-native product development platform that converts customer needs and UAE
market opportunities into **original, safe, manufacturable, commercially viable**
925-silver jewellery and accessories. It is *not* an image generator: it is a
controlled pipeline from market signal to production-approved product with full
traceability.

### A2. Primary business goal

Execute the full chain:

Market opportunity → Design brief → Concepts → Engineering → Safety → Costing →
Commercial evaluation → CAD/vector preparation → Prototype → Production approval
→ Product catalogue → Marketing → Sales feedback → Learning.

Optimisation targets (simultaneous): brand fit, originality, UAE market appeal,
manufacturability, product safety, commercial margin, aesthetic quality,
personalisation potential, manufacturing repeatability, time to market, and
customer conversion potential. The objective is **fewer, stronger, safer,
original, manufacturable and profitable products** — not maximum design volume.

### A3. Core operating principle (non-negotiable)

No single AI model may generate a design, approve it, declare it manufacturable,
generate production files, and release it to manufacturing. Critical
responsibilities are separated across agents, and every product passes the gate
chain:

Concept Gate → Brand Gate → Arabic Gate (if applicable) → Engineering Gate →
Safety Gate → Cost Gate → Commercial Gate → Production Gate → Independent QA
Gate → Human Approval.

Failure of any mandatory gate **blocks production**. This is enforced in code
(orchestrator + state machine), not by convention.

### A4. Product families in scope

1. Men — bracelets, silver chains, necklaces, pendants, rings, signet rings,
   cufflinks, tie accessories, lapel pins, leather+silver, black stone
   accessories, beaded bracelets, Arabic calligraphy, names/initials, corporate
   gifts, religious/inspirational products where appropriate.
2. Women — name necklaces, Arabic calligraphy necklaces, pendants, bracelets,
   bangles, rings, earrings, brooches, charms, anklets, gift sets, birthstone,
   initial jewellery, family jewellery, couple collections, mother collections,
   personalised phrases.
3. Babies & children — a **separate safety-controlled category**. Preferred:
   keepsakes, birth-name products, commemorative gifts, parent-held jewellery,
   gift plaques, non-wearable silver pieces. Any wearable child product requires
   dedicated safety approval. Automatic reject/escalate for: choking hazards,
   small detachable components, unsafe chain lengths, strangulation hazards,
   sharp edges, weak clasps, unsafe stones, magnets, unverified coatings, toxic
   materials, fragile attachments.
4. Couples, 5. Gifts, 6. Personalised jewellery, 7. Arabic calligraphy
   jewellery, 8. Corporate gifts, 9. UAE-inspired collections, 10. Seasonal
   collections.

### A5. Functional requirements (Release 1 scope in bold)

- **FR-01 Design Orchestrator**: interprets business requests, creates execution
  plans, sequences specialist agents, tracks lifecycle state, routes rework,
  escalates to humans, never approves its own outputs.
- **FR-02 Specialist agents** (14): Market Intelligence, Brand DNA, Creative
  Design, Arabic Calligraphy, Manufacturing Engineering, Product Safety,
  Originality & IP, Cost Engineering, Commercial Viability, CAD & Vector,
  Visualisation, Marketing, Independent QA, Prototype Evaluation.
- **FR-03 Materials engine**: extensible material database with cost,
  compatibility, safety and certification-evidence fields. Unsupported claims
  ("hypoallergenic", "nickel-free", "medical grade", "non-toxic", "certified")
  are rejected unless certification evidence exists.
- **FR-04 Arabic pipeline**: exact-text validation → RTL validation → spelling
  validation → calligraphy selection → master artwork → vector geometry →
  manufacturability validation → rendering. The image model never invents
  Arabic lettering. One approved Master Arabic Artwork ID per text; all variants
  derive from it. Customer-approved spelling is immutable.
- **FR-05 Lifecycle state machine** (23 states, §21 of master prompt) with no
  silent state skipping.
- **FR-06 Design Readiness Score**: configurable weighted score (Brand 15%,
  Manufacturability 20%, Originality 10%, Commercial 15%, Cost 15%, Aesthetic
  10%, Market Relevance 10%, Personalisation 5%), release threshold 85/100.
  Safety PASS and Arabic PASS (when applicable) are mandatory overrides.
- **FR-07 Design version control**: immutable approved production versions,
  full version lineage.
- **FR-08 Digital Product Passport** per approved product.
- **FR-09 CAD/vector export**: SVG + DXF (Release 1), outlined text, closed
  paths, mm units, layer separation (ENGRAVE/CUT/KEEP_CLEAR/STONE_SETTING/
  REFERENCE/DIMENSIONS), positive + reversed versions.
- **FR-10 Reverse costing**: given target retail price and required margin,
  compute maximum acceptable production cost; over-ceiling designs route back
  to redesign.
- **FR-11 Approval workflow**: human gates for Arabic master artwork, religious
  text, child products, new materials, new workshop process, high production
  cost, unusual manufacturing technique, final production files, mass
  production. Outcomes: APPROVED / APPROVED_WITH_COMMENTS / REVISION_REQUIRED /
  REJECTED.
- **FR-12 Automatic correction routing** (§22) with persistent issue log.
- FR-13 Collection generator (Release 2/3 strategy balancing, Release 1 stub).
- FR-14 Variant engine: child design versions from an approved master.
- FR-15 Personalisation engine with recorded customer-approved spelling.
- FR-16 Customer co-design intake (Release 2).
- FR-17 Memory architecture: Working / Product / Brand / Learning memory;
  hallucinated content never becomes permanent memory (validation gate on
  writes to Learning/Brand memory).
- FR-18 Knowledge graph (Release 3).
- FR-19 Executive analytics & learning loop (Release 2/3); engineering rule
  changes always require authorised human approval, never sales data alone.
- **FR-20 Fail-safe behaviour**: when evidence is insufficient the system
  returns `HUMAN_REVIEW_REQUIRED` instead of inventing.

### A6. Non-functional requirements

- Auditability: every agent run, gate result, approval and state transition is
  written to an append-only audit log.
- Determinism at the control plane: gates, scores and state transitions are
  deterministic code; only content generation is model-driven.
- Model independence: all AI calls go through the Model Gateway (§06 doc).
- Security & privacy: see 05-security-architecture.md.
- Localisation: Arabic (RTL) + English throughout UI and marketing outputs.
- Units: millimetres and grams everywhere; AED as base currency.

### A7. Out of scope (all releases)

- Direct manufacturing-machine control.
- Automatic release to production without human approval.
- Auto-modification of safety or engineering rules from sales/marketing data.

## B. Business Architecture

### B1. Value chain

| Stage | Owner (role) | Supported by (agents) |
|---|---|---|
| Opportunity identification | Product Manager | Market Intelligence |
| Brief & concepting | Design Director | Creative Design, Brand DNA |
| Arabic artwork | Arabic Specialist | Arabic Calligraphy |
| Engineering & safety | Manufacturing Engineer | Manufacturing, Safety |
| Costing & pricing | Finance | Cost Engineering |
| Commercial decision | Brand Director | Commercial Viability, Originality/IP |
| Production files | CAD Engineer | CAD & Vector |
| Prototype & production | Operations / Workshop | Prototype Evaluation |
| Go-to-market | Marketing | Marketing, Visualisation |
| Learning | All | QA, Prototype Evaluation, analytics |

### B2. Commercial model

- Reverse-costed products: retail target and margin floor drive an enforced
  production-cost ceiling (e.g. AED 249 retail at 60% gross margin ⇒ max
  production cost ≈ AED 99.6 before landed adjustments).
- Portfolio strategy per collection: hero / core / entry / premium /
  personalised / gift / experimental, with SKU-duplication control.
- Seasonal calendar: Ramadan, Eid al-Fitr, Eid al-Adha, UAE National Day,
  Mother's Day, Father's Day, Valentine's Day, weddings, graduation, birthdays,
  corporate gifting, tourism gifts.

### B3. Decision rights

- AI agents: propose, score, flag. **Never final-approve.**
- Independent QA agent: verifies, but cannot approve production.
- Humans: final approval at every mandatory human gate (§45). Roles and
  permissions in 05-security-architecture.md.

### B4. KPIs

Concept-to-market time, design pass-rate per gate, prototype first-pass yield,
predicted-vs-actual cost/weight/margin deltas, return rate by material and
workshop, conversion by price point, margin by collection, human correction
rate per agent.
