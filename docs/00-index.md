# Beyond Style UAE — Agentic Product Design Operating System

## Documentation Index

This documentation set is the required first output of the build (Master Prompt §50).
Each of the 20 required deliverables maps to a document below.

| # | Required deliverable | Document |
|---|---|---|
| 1 | Product Requirements Document | [01-product-requirements.md](01-product-requirements.md) |
| 2 | Business architecture | [01-product-requirements.md](01-product-requirements.md) §B |
| 3 | System architecture | [02-system-architecture.md](02-system-architecture.md) |
| 4 | Agent architecture | [03-agent-architecture.md](03-agent-architecture.md) |
| 5 | Agent Responsibility Matrix | [03-agent-architecture.md](03-agent-architecture.md) §3 |
| 6 | Workflow diagrams | [03-agent-architecture.md](03-agent-architecture.md) §4 |
| 7 | State machine | [03-agent-architecture.md](03-agent-architecture.md) §5 |
| 8 | Database schema | [04-data-architecture.md](04-data-architecture.md) §1 |
| 9 | Knowledge graph schema | [04-data-architecture.md](04-data-architecture.md) §2 |
| 10 | Security architecture | [05-security-architecture.md](05-security-architecture.md) |
| 11 | API architecture | [02-system-architecture.md](02-system-architecture.md) §5 |
| 12 | Model Gateway design | [06-model-gateway.md](06-model-gateway.md) |
| 13 | Folder structure | [02-system-architecture.md](02-system-architecture.md) §4 |
| 14 | UI sitemap | [07-ui-ux.md](07-ui-ux.md) §1 |
| 15 | Wireframe descriptions | [07-ui-ux.md](07-ui-ux.md) §2 |
| 16 | Release roadmap | [08-delivery.md](08-delivery.md) §1 |
| 17 | Testing strategy | [08-delivery.md](08-delivery.md) §2 |
| 18 | Agent evaluation strategy | [08-delivery.md](08-delivery.md) §3 |
| 19 | Acceptance criteria | [08-delivery.md](08-delivery.md) §4 |
| 20 | Risk register | [09-risk-register.md](09-risk-register.md) |
| — | Critical architecture review (mandated before coding) | [10-critical-review.md](10-critical-review.md) |

## Repository layout

```
docs/         This documentation set
src/          Release 1 implementation (TypeScript, feature-sliced)
scripts/      Demo runner for the Definition-of-Done scenario
output/       Generated artifacts from the demo scenario (git-ignored)
```

## Quick start

```
npm install
npm test          # full automated test suite (§48 coverage)
npm run demo      # Definition-of-Done scenario (§51): AED 249 men's Arabic bracelet
```
