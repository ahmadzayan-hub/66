# Data Architecture

Relational storage is the **system of record**. Vector embeddings are never
primary business truth (they may index/retrieve, Release 3).

## 1. Database schema (PostgreSQL target; Release 1 repositories are in-memory behind the same interfaces)

Conventions: `id` UUID PK; `created_at/updated_at` timestamptz; soft business
keys unique-indexed; all money `numeric(12,2)` AED; all dimensions mm, weights
grams. Append-only tables marked ⊕ (no UPDATE/DELETE grants).

### Identity & access
```
users(id, email, name, status, mfa_enrolled, created_at)
roles(id, name)                      -- §42 role list
permissions(id, code, description)
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)
```

### Design core
```
design_briefs(id, title, source, opportunity_id, target_segment, product_type,
  target_price_aed, target_margin_pct, personalisation, arabic_text,
  requirements_json, status, created_by)
designs(id, brief_id, family, category, is_child_product, current_version_id)
design_versions(id, design_id, version_no, parent_version_id, created_by,
  agent_id, change_reason, changed_fields_json, approval_status,
  prototype_status, production_status, concept_json, dimensions_json,
  material_id, estimated_weight_g, manufacturing_method, immutable, created_at) ⊕ once approved
design_state_transitions(id, design_id, version_id, from_state, to_state,
  actor_type, actor_id, reason, created_at) ⊕
collections(id, name, season, year, strategy_json, status)
collection_designs(collection_id, design_id, portfolio_role) -- hero/core/entry/…
```

### Arabic
```
arabic_master_artworks(id, artwork_code, input_text, normalized_text,
  calligraphy_style, letterform_json, vector_asset_id, validation_report_json,
  approval_id, approved_by, status, created_at) ⊕ once approved
design_arabic_links(design_version_id, master_artwork_id) -- every variant derives from one approved artwork
personalisation_requests(id, customer_id, design_id, input_type, raw_input,
  approved_spelling, approved_spelling_locked_at, master_artwork_id, status)
```

### Materials & manufacturing
```
materials(id, material_code, name, composition, density_g_cm3, supplier_id,
  raw_cost_per_g_aed, casting_ok, laser_ok, cnc_ok, plating_ok,
  min_thickness_mm, finishing_methods_json, polishing_json, waste_factor_pct,
  safety_restrictions_json, skin_contact_notes, target_categories_json,
  cost_band, certification_evidence_json)
material_claims(id, material_id, claim, evidence_asset_id, verified_by, verified_at)
  -- a claim row without evidence_asset_id cannot be published (DB check + service guard)
components(id, name, type, material_id, unit_cost_aed)
stones(id, name, type, origin, unit_cost_aed, security_rating, child_safe)
suppliers(id, name, country, lead_time_days, rating)
workshops(id, name, location, capabilities_json, defect_rate_pct)
manufacturing_rules(id, workshop_id NULLABLE, rule_code, value_num, unit,
  severity, active, changed_by, approved_by, created_at) ⊕ versioned
  -- NULL workshop_id = engineering default (e.g. min line width 0.30mm);
  -- workshop rows override defaults; changes require authorised approval.
```

### Costing
```
cost_models(id, design_version_id, silver_weight_g, silver_price_per_g,
  stones_cost, cad_cost, laser_cost, casting_cost, soldering_cost,
  handcraft_cost, plating_cost, polishing_cost, assembly_cost, packaging_cost,
  qc_cost, scrap_pct, supplier_margin_pct, delivery_cost, payment_fee_pct,
  advertising_allowance_pct, returns_allowance_pct,
  total_production_cost, landed_cost, min_selling_price,
  recommended_retail_price, premium_retail_price, gross_margin_pct,
  contribution_margin_pct, expected_profit, reverse_ceiling_aed, created_at) ⊕
```

### Quality, approvals, lifecycle
```
approvals(id, subject_type, subject_id, gate, decision, comments, decided_by,
  decided_at, evidence_json) ⊕
evaluations(id, design_version_id, agent_id, agent_capability, score_type,
  score, verdict, report_json, confidence, created_at) ⊕
quality_issues(id, design_version_id, issue_type, detected_by_agent, routed_to,
  status, resolution_version_id, created_at)
prototypes(id, design_version_id, workshop_id, requested_at, received_at,
  actual_weight_g, actual_dimensions_json, actual_cost_aed, surface_quality,
  arabic_accuracy, issues_json, feedback, conformance_verdict)
```

### Commerce
```
products(id, sku, design_id, design_version_id, collection_id, status)
product_passports(product_id, passport_json, generated_at) ⊕ -- §25 full field set
customers(id, name, email, phone, consent_json, pii_class)
orders(id, customer_id, product_id, personalisation_request_id, price_aed,
  status, channel, created_at)
returns(id, order_id, reason_code, notes, created_at)
sales_metrics(id, product_id, period, units, revenue_aed, conversion_pct)
feedback(id, product_id, source, rating, text, created_at)
```

### Platform
```
media_assets(id, sha256, kind, mime, bytes, storage_url, immutable,
  scan_status, created_by) ⊕ once referenced by an approved version
agent_runs(id, agent_id, capability, design_version_id, input_hash,
  output_asset_id, model_used, tokens, cost_usd, latency_ms, confidence,
  status, error, created_at) ⊕
audit_logs(id, actor_type, actor_id, action, subject_type, subject_id,
  detail_json, ip, created_at) ⊕
```

Integrity rules enforced at both DB and service layer:

1. A `design_version` with `approval_status='PRODUCTION_APPROVED'` is
   immutable; new work forks a child version.
2. `products.design_version_id` must reference an approved, immutable version.
3. Arabic-bearing versions must join `design_arabic_links` to an **approved**
   master artwork.
4. `material_claims` without verified evidence are excluded from any generated
   copy (query-level guard + marketing agent guard).
5. Safety `evaluations.verdict='FAIL'` blocks any approval row for that
   version (service invariant + trigger).

## 2. Knowledge graph schema (Release 3; node/edge tables from day one)

Nodes: `Design, Product, Collection, Material, Stone, Supplier, Workshop,
CustomerSegment, Style, Calligraphy, Phrase, ManufacturingProcess, Cost,
Prototype, Order, ReturnReason, QualityIssue, MarketingCampaign`.

Edges (typed, directed, with provenance):
```
DESIGN  ─USES─────────────► MATERIAL
DESIGN  ─TARGETS──────────► CUSTOMER_SEGMENT
DESIGN  ─BELONGS_TO───────► COLLECTION
DESIGN  ─MANUFACTURED_BY──► MANUFACTURING_PROCESS
DESIGN  ─DERIVED_FROM─────► MASTER_ARTWORK
DESIGN  ─VARIANT_OF───────► DESIGN
PRODUCT ─PRODUCED_BY──────► WORKSHOP
PRODUCT ─GENERATED────────► SALES (Order)
PRODUCT ─CAUSED───────────► RETURN_REASON
PRODUCT ─FLAGGED──────────► QUALITY_ISSUE
CAMPAIGN─PROMOTES─────────► PRODUCT
```

Storage: `kg_nodes(id, node_type, ref_table, ref_id)` and
`kg_edges(id, from_node, to_node, edge_type, weight, provenance_json,
created_at)`. Edges are derived from relational facts by ETL — the graph never
contains facts absent from the system of record.

## 3. Memory architecture (§30)

| Layer | Backing | Write policy |
|---|---|---|
| Working | in-process per pipeline run | free |
| Product | relational tables above | via services only |
| Brand | `brand_rules` versioned table | human-approved changes only |
| Learning | `learning_facts(id, claim, evidence_refs_json, validated_by, created_at)` | requires evidence refs to real outcomes (sales/returns/prototypes); model output alone is rejected |
