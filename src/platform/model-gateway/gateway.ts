import { AuditLog } from '../audit/audit-log.js';
import { DataClass } from '../kernel.js';

export type TaskProfile =
  | 'reasoning'
  | 'arabic-validation'
  | 'vision'
  | 'image-generation'
  | 'embedding'
  | 'coding'
  | 'data-analysis';

export interface ModelRequest {
  task: TaskProfile;
  payloadClass: DataClass;
  input: unknown;
  budget?: { maxUsd?: number; maxLatencyMs?: number };
}

export interface ModelResponse {
  output: unknown;
  provider: string;
  model: string;
  confidence: number;
  usage: { tokens: number; costUsd: number; latencyMs: number };
}

export interface ModelProvider {
  name: string;
  supports(task: TaskProfile): boolean;
  /** Providers eligible per data class (privacy §41). */
  allowedDataClasses: DataClass[];
  invoke(request: ModelRequest): Promise<ModelResponse>;
  healthy(): boolean;
}

export class GatewayUnavailable extends Error {}

const PII_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[REDACTED_EMAIL]'],
  [/\+?\d[\d\s-]{7,}\d/g, '[REDACTED_PHONE]'],
  [/\border[_ ]?id[:= ]?\S+/gi, '[REDACTED_ORDER]'],
];

/** Minimum-necessary redaction before anything leaves the boundary (§41). */
export function redactForProvider(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PII_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Provider-agnostic model gateway with ranked fallback. Feature code never
 * names a provider. RESTRICTED_PRODUCTION payloads never leave the boundary
 * regardless of provider claims.
 */
export class ModelGateway {
  constructor(
    private providers: ModelProvider[],
    private audit: AuditLog,
  ) {}

  async run(request: ModelRequest): Promise<ModelResponse> {
    if (request.payloadClass === 'RESTRICTED_PRODUCTION') {
      throw new GatewayUnavailable('RESTRICTED_PRODUCTION data may not be sent to external models');
    }
    const sanitized: ModelRequest =
      typeof request.input === 'string'
        ? { ...request, input: redactForProvider(request.input) }
        : request;

    const eligible = this.providers.filter(
      (p) => p.supports(request.task) && p.healthy() && p.allowedDataClasses.includes(request.payloadClass),
    );
    let lastError: unknown = null;
    for (const provider of eligible) {
      try {
        const response = await provider.invoke(sanitized);
        this.audit.append({
          actorType: 'system',
          actorId: 'model-gateway',
          action: `model:${request.task}`,
          subjectType: 'provider',
          subjectId: provider.name,
          detail: { usage: response.usage, redacted: sanitized !== request },
        });
        return response;
      } catch (err) {
        lastError = err;
      }
    }
    // Exhausted fallbacks: typed failure, callers convert to HUMAN_REVIEW_REQUIRED.
    throw new GatewayUnavailable(`No provider available for task ${request.task}: ${String(lastError)}`);
  }
}

/**
 * Deterministic stub provider (Release 1): lets the entire control plane run
 * offline/CI. Safety and engineering guarantees must not depend on any
 * model's behaviour — this provider proves it.
 */
export class StubProvider implements ModelProvider {
  name = 'stub-deterministic';
  allowedDataClasses: DataClass[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'CUSTOMER_PII'];
  private up = true;

  supports(): boolean {
    return true;
  }

  setHealthy(up: boolean): void {
    this.up = up;
  }

  healthy(): boolean {
    return this.up;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    return {
      output: { echo: request.input },
      provider: this.name,
      model: 'stub-1',
      confidence: 0.95,
      usage: { tokens: 0, costUsd: 0, latencyMs: 1 },
    };
  }
}
