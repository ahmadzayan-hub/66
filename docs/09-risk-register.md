# Risk Register

Severity = Impact × Likelihood (H/M/L). Owner = accountable role.

| ID | Risk | Class | Sev | Mitigation (built) | Owner |
|----|------|-------|-----|--------------------|-------|
| R01 | Image model invents/distorts Arabic lettering; wrong text engraved | AI / brand / religious sensitivity | H | Arabic pipeline: deterministic exact-text validator; renders composite approved vector artwork only; rule 52.2 enforced in code (renderer receives artwork ID, not text) | Arabic Specialist |
| R02 | Unsafe child product reaches production | Safety / legal | H | Separate child category; hazard auto-reject list; Safety FAIL absolutely blocks approval; mandatory human gate for all child products | Manufacturing Engineer |
| R03 | Beautiful but unmanufacturable design approved | Manufacturing | H | Engineering gate with workshop-configurable thresholds (0.30mm line, 0.30–0.40mm gap); renders only after engineering validation | Manufacturing Engineer |
| R04 | Cost overrun vs target retail price | Commercial | M | Reverse costing ceiling; CostExceeded event routes to redesign; landed-cost model incl. scrap, fees, allowances | Finance |
| R05 | Design copies competitor / IP infringement | Legal | H | Originality agent screening; uncertain IP ⇒ HUMAN_REVIEW_REQUIRED; references inform but never enter production files | Brand Director |
| R06 | Unsupported material claims ("hypoallergenic", "certified") published | Legal / trust | H | Claim guard: claims require certification evidence rows; marketing agent strips unevidenced claims | Marketing |
| R07 | One model/agent self-approves (collusion-by-architecture) | Governance | H | Capability separation + lineage check: evaluator rejects artifacts it generated; orchestrator has no approval authority; tested invariant | Design Director |
| R08 | Approved production file overwritten/mutated | Ops | H | Content-addressed, write-once artifacts; immutable approved versions; tested invariant | CAD Engineer |
| R09 | Hallucinated "facts" poison memory/learning loop | AI | M | Learning-memory writes require evidence refs to real outcomes; brand-memory writes require human approval | Product Manager |
| R10 | Provider outage stalls pipeline | Availability | M | Gateway fallback chain; terminal failure degrades to HUMAN_REVIEW_REQUIRED, never silent guess | Operations |
| R11 | Prompt injection via customer input (names, phrases, uploads) | Security | H | Input treated as data (delimited fields), schema-validated outputs, SVG sanitisation, no execution of uploads | Security |
| R12 | PII leakage to AI providers | Privacy / legal | H | Redaction middleware, payload classification, minimum-necessary policy, outbound audit log | Security |
| R13 | Engineering/safety rules eroded by commercial pressure | Governance | M | Rule changes require authorised human approval; sales data can never auto-modify rules (rule 52.11 enforced: no code path exists) | Design Director |
| R14 | Customer-approved spelling altered downstream | Brand / legal | H | Spelling locked at approval; artwork derived from locked string; renderer/marketing re-validate against lock | Arabic Specialist |
| R15 | SKU sprawl / portfolio dilution | Commercial | L | Collection generator balance rules + duplication check (R2) | Product Manager |
| R16 | Scalability: monolith limits at Release 3 scale | Architecture | L | Feature-sliced modules + event bus with transport-agnostic interface allow extraction to services without rewrites | Architecture |
| R17 | Benchmark drift after model swap | AI quality | M | Gateway model changes trigger mandatory benchmark re-run before rollout | Product Manager |
| R18 | Predicted vs actual (weight/cost) divergence erodes margin | Commercial | M | Prototype evaluation captures actuals; learning loop recalibrates estimators from validated data only | Finance |
