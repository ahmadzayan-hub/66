# Model Gateway Design (§36)

## Purpose

No feature code ever names an AI provider. All model access goes through the
Model Gateway, which routes by **task profile**, applies privacy redaction,
enforces budgets, and fails over.

## Task profiles

| Task | Needs | Primary tier | Fallback |
|---|---|---|---|
| reasoning / planning | high quality, large context | frontier reasoning model | second-vendor frontier |
| arabic-validation | Arabic linguistic accuracy | Arabic-strong frontier model | second Arabic-capable model → HUMAN_REVIEW_REQUIRED |
| vision (reference analysis) | multimodal | frontier vision model | second vision model |
| image-generation (renders) | quality; *never* generates Arabic glyphs (composited from approved vector artwork) | image model A | image model B |
| embedding | cheap, stable | embedding model | second vendor |
| coding (internal tooling) | code quality | frontier code model | — |
| data-analysis | structured reasoning | mid-tier model | frontier |

## Routing inputs

Selection considers: quality requirement, task type, cost budget, latency
target, privacy class of the payload, context-window need, and current
availability (health checks + circuit breaker).

## Interface (implemented in `src/platform/model-gateway`)

```ts
interface ModelGateway {
  run(request: ModelRequest): Promise<ModelResponse>;
}
interface ModelRequest {
  task: TaskProfile;            // 'reasoning' | 'arabic-validation' | ...
  payloadClass: DataClass;      // drives redaction + provider eligibility
  input: unknown;               // typed per task
  budget?: { maxUsd?: number; maxLatencyMs?: number };
}
interface ModelResponse {
  output: unknown;
  provider: string; model: string;
  confidence: number;           // provider/task-calibrated
  usage: { tokens: number; costUsd: number; latencyMs: number };
}
```

## Pipeline per call

1. Redaction middleware (per payload class — see security doc §4).
2. Provider selection (task profile → ranked provider list → health filter →
   budget filter).
3. Invocation with timeout; on failure/timeout, next provider in the ranked
   list; after list exhaustion, return a typed `GatewayUnavailable` which
   agents convert to `HUMAN_REVIEW_REQUIRED` (never a silent guess).
4. Post-call: usage metering, cost accounting per agent run, audit log entry,
   schema validation of the output (invalid output = retry once, then treated
   as failure).

## Release 1 note

Release 1 ships the gateway with a **deterministic stub provider** so the
entire control plane (gates, validators, scoring, exports, state machine) is
fully testable offline and in CI. Real providers are added by implementing the
`ModelProvider` interface and registering it in the routing table — zero
changes to feature code. This also demonstrates the required property that the
system's safety and engineering guarantees do not depend on any model's
behaviour.
