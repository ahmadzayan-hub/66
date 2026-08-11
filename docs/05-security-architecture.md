# Security, Privacy & File-Safety Architecture

## 1. Identity, access, roles (§39, §42)

- **RBAC** with the role set: Super Admin, Brand Director, Design Director,
  Jewellery Designer, Arabic Specialist, CAD Engineer, Manufacturing Engineer,
  Product Manager, Marketing, Finance, Operations, Workshop User, Customer
  Support, Read Only, Customer.
- Permissions are fine-grained codes (e.g. `design.approve`,
  `arabic.master.approve`, `rules.engineering.change`, `production.release`,
  `passport.read`). Roles map to permission sets; least privilege by default.
- **MFA mandatory** for privileged roles (Super Admin, Directors, Finance,
  anyone holding `production.release` or `rules.engineering.change`).
- Sessions: short-lived access tokens + rotating refresh tokens, secure
  HttpOnly SameSite cookies for the browser UI, full logout revocation.
- Separation of duties in authorisation, mirroring the agent layer: the same
  user cannot both submit and approve the same gate item (checked at approval
  write time).

## 2. Application security

- Strong input validation at every boundary (typed schemas; the Release 1 code
  validates all agent/gate inputs with explicit guards).
- Rate limiting per principal and per IP; stricter budgets on AI-invoking
  endpoints.
- CSRF tokens on all browser-originated mutations; CORS restricted to
  first-party origins.
- Idempotent processing: `Idempotency-Key` on mutating endpoints; event
  handlers are idempotent (event IDs deduplicated).
- Secrets in a vault (never in code/env files committed to VCS); per-service
  credentials; automatic rotation.
- Encryption in transit (TLS 1.2+) and at rest (DB + object storage).
- Signed, expiring URLs for all file access; no public buckets.
- Append-only audit logs for auth events, approvals, rule changes, exports.
- Backups with tested restoration; documented disaster-recovery runbook and
  data-retention policies.

## 3. File security (§40)

Customer uploads (photos, SVG, PDF, images, audio, video) pass a quarantine
pipeline before any use:

1. Extension allow-list → 2. Declared MIME check → 3. **Magic-byte
   verification** (content must match declared type) → 4. Size and pixel-
   dimension limits → 5. Malware scan → 6. Re-encode/sanitise (images are
   re-encoded; SVG is parsed and rebuilt from a whitelist of geometry elements
   — scripts, event handlers, external refs, foreignObject stripped) →
   7. Store content-addressed (sha256) in object storage.

Rules: suspicious files are quarantined, never executed; customer SVG/HTML/JS
is never rendered directly in the browser (sanitised copies only, served from
a cookie-less asset domain with a restrictive CSP); customer reference images
are never sent to production (they inform briefs only — enforced by the CAD
exporter which only accepts internally generated geometry).

## 4. Data privacy (§41)

Classification: Public / Internal / Confidential / Customer PII / Restricted
Production Data. Every table column is classified; `customers`, `orders`,
`personalisation_requests` carry PII class.

AI-provider data minimisation (enforced in the Model Gateway):

- Redaction middleware strips names, emails, phones, addresses and order IDs
  from prompts unless the task explicitly requires them (personalisation text
  is sent as isolated strings, never with customer identity attached).
- Restricted Production Data (workshop parameters, supplier pricing) never
  leaves the boundary; agents needing it receive derived, non-confidential
  summaries.
- Every outbound AI call is audit-logged with a redaction report.
- Retention: per-class retention schedules; customer deletion workflow erases
  PII and re-links orders to an anonymised customer record while preserving
  financial records as required by UAE law.

## 5. AI-specific security

- Prompt-injection defence: customer-provided text (names, phrases, co-design
  input) is treated as data, never instructions — passed to models in
  delimited data fields; agent outputs are schema-validated before use.
- Model outputs never execute: no generated code paths, no generated SQL.
- Hallucination containment: deterministic validators (Arabic, engineering,
  costing, claims) sit after every generative step; unverifiable outputs
  become `HUMAN_REVIEW_REQUIRED`.
- Approved production artifacts are content-addressed and write-once; the CAD
  export service refuses to overwrite an approved file hash (rule 52.7).
