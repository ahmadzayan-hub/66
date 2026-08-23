import { DataClass } from '../../kernel.js';
import { ModelProvider, ModelRequest, ModelResponse, TaskProfile } from '../gateway.js';

/**
 * Structured-output contract this provider accepts as `request.input` for
 * the 'reasoning' task: a forced tool call, so the response is always valid
 * JSON matching the caller's schema — never free text to be parsed.
 */
export interface AnthropicToolRequest {
  system: string;
  userPrompt: string;
  tool: {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  };
  maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-5';
const API_VERSION = '2023-06-01';

/**
 * Real Anthropic-backed provider (§36). Supports only the task profiles it
 * has actually been validated for; unsupported tasks fall through the
 * gateway's ranked-fallback loop to other providers (Release 1: the
 * deterministic stub). Structured output is enforced via a forced tool
 * call — the model cannot return anything but the caller's declared shape.
 */
export class AnthropicProvider implements ModelProvider {
  name = 'anthropic-claude';
  allowedDataClasses: DataClass[] = ['PUBLIC', 'INTERNAL'];

  constructor(
    private apiKey: string,
    private model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  ) {}

  supports(task: TaskProfile): boolean {
    return task === 'reasoning';
  }

  healthy(): boolean {
    return Boolean(this.apiKey);
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const input = request.input as AnthropicToolRequest;
    if (!input?.tool?.name || !input.userPrompt) {
      throw new Error('AnthropicProvider requires an AnthropicToolRequest input (system, userPrompt, tool)');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.budget?.maxLatencyMs ?? 25_000);
    const started = Date.now();

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: input.maxTokens ?? 2048,
          system: input.system,
          messages: [{ role: 'user', content: input.userPrompt }],
          tools: [{ name: input.tool.name, description: input.tool.description, input_schema: input.tool.input_schema }],
          tool_choice: { type: 'tool', name: input.tool.name },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        content: { type: string; name?: string; input?: unknown }[];
        usage?: { input_tokens: number; output_tokens: number };
        model: string;
      };
      const toolUse = data.content.find((b) => b.type === 'tool_use' && b.name === input.tool.name);
      if (!toolUse) throw new Error('Anthropic response did not include the forced tool call');

      const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
      return {
        output: toolUse.input,
        provider: this.name,
        model: data.model ?? this.model,
        // Illustrative calibration only — not derived from a benchmark (see docs §49).
        confidence: 0.8,
        usage: { tokens, costUsd: 0, latencyMs: Date.now() - started },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
