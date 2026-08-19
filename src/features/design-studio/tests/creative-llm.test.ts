import { describe, expect, it, vi, afterEach } from 'vitest';
import { CreativeDesignAgent } from '../agents/creative-agent.js';
import { ModelGateway, ModelProvider, ModelRequest, ModelResponse, TaskProfile } from '../../../platform/model-gateway/gateway.js';
import { AnthropicProvider } from '../../../platform/model-gateway/providers/anthropic-provider.js';
import { AuditLog } from '../../../platform/audit/audit-log.js';
import { DataClass } from '../../../platform/kernel.js';
import { DesignBrief } from '../models/concept.js';

const brief: DesignBrief = {
  briefId: 'b', title: 't', family: 'MEN', productType: 'bracelet',
  customerSegment: 's', customerPersona: 'p', customerProblem: 'c', marketRationale: 'm',
  targetRetailPriceAed: 249, requiredGrossMarginPct: 60, personalisation: true,
  arabicText: 'خالد', isChildProduct: false, isWearableChildProduct: false, isReligiousText: false,
};

const ALLOWED = ['MAT-925', 'MAT-925-BRH', 'MAT-LEATHER'];

function fakeConcept(overrides: Record<string, unknown> = {}) {
  return {
    conceptName: 'LLM Concept',
    designStory: 'story',
    targetCustomer: 'p',
    visualLanguage: 'v1',
    materialId: 'MAT-925',
    dimensions: { lengthMm: 200, widthMm: 8, thicknessMm: 1.6, minLineWidthMm: 0.4, minInternalGapMm: 0.4, hasIsolatedArabicDots: false, hasFragileBridges: false },
    estimatedWeightG: 8,
    manufacturingMethod: 'cast',
    personalisationOptions: ['arabic name'],
    complexity: 'LOW',
    estimatedCostBand: 'CORE',
    differentiation: 'd',
    risks: [],
    construction: 'c1',
    personalisationMechanic: 'p1',
    ...overrides,
  };
}

class FakeProvider implements ModelProvider {
  name = 'fake';
  allowedDataClasses: DataClass[] = ['INTERNAL'];
  constructor(private output: unknown, private shouldThrow = false) {}
  supports(task: TaskProfile) { return task === 'reasoning'; }
  healthy() { return true; }
  async invoke(_req: ModelRequest): Promise<ModelResponse> {
    if (this.shouldThrow) throw new Error('provider failure');
    return { output: this.output, provider: this.name, model: 'fake-1', confidence: 0.9, usage: { tokens: 10, costUsd: 0, latencyMs: 1 } };
  }
}

describe('CreativeDesignAgent LLM integration', () => {
  it('uses a valid, materially-different LLM proposal when the gateway succeeds', async () => {
    const concepts = [
      fakeConcept({ conceptName: 'A', visualLanguage: 'v1', construction: 'c1', materialId: 'MAT-925', personalisationMechanic: 'p1' }),
      fakeConcept({ conceptName: 'B', visualLanguage: 'v2', construction: 'c2', materialId: 'MAT-925-BRH', personalisationMechanic: 'p2' }),
      fakeConcept({ conceptName: 'C', visualLanguage: 'v3', construction: 'c3', materialId: 'MAT-LEATHER', personalisationMechanic: 'p3' }),
      fakeConcept({ conceptName: 'D', visualLanguage: 'v4', construction: 'c4', materialId: 'MAT-925', personalisationMechanic: 'p4' }),
    ];
    const gateway = new ModelGateway([new FakeProvider({ concepts })], new AuditLog());
    const agent = new CreativeDesignAgent(gateway, ALLOWED);
    const result = await agent.generateConcepts(brief);
    expect(result.map((r) => r.payload.conceptName)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('falls back to the deterministic library when the LLM proposes an unknown material', async () => {
    const bad = [
      fakeConcept({ conceptName: 'A', materialId: 'MAT-NOT-REAL' }),
      fakeConcept({ conceptName: 'B', visualLanguage: 'v2', construction: 'c2', personalisationMechanic: 'p2' }),
      fakeConcept({ conceptName: 'C', visualLanguage: 'v3', construction: 'c3', personalisationMechanic: 'p3' }),
      fakeConcept({ conceptName: 'D', visualLanguage: 'v4', construction: 'c4', personalisationMechanic: 'p4' }),
    ];
    const gateway = new ModelGateway([new FakeProvider({ concepts: bad })], new AuditLog());
    const agent = new CreativeDesignAgent(gateway, ALLOWED);
    const result = await agent.generateConcepts(brief);
    // Deterministic fallback library's known first concept name.
    expect(result.map((r) => r.payload.conceptName)).toContain('Meem ID Bar');
  });

  it('falls back to the deterministic library when the LLM proposes cosmetic-only variations', async () => {
    const cosmetic = Array.from({ length: 4 }, (_, i) => fakeConcept({ conceptName: `V${i}` }));
    const gateway = new ModelGateway([new FakeProvider({ concepts: cosmetic })], new AuditLog());
    const agent = new CreativeDesignAgent(gateway, ALLOWED);
    const result = await agent.generateConcepts(brief);
    expect(result.map((r) => r.payload.conceptName)).toContain('Meem ID Bar');
  });

  it('falls back to the deterministic library when the gateway throws (no provider available)', async () => {
    const gateway = new ModelGateway([new FakeProvider(null, true)], new AuditLog());
    const agent = new CreativeDesignAgent(gateway, ALLOWED);
    const result = await agent.generateConcepts(brief);
    expect(result.map((r) => r.payload.conceptName)).toContain('Meem ID Bar');
  });

  it('ignores the offline stub echo and uses the deterministic library instead of treating it as a real proposal', async () => {
    const { StubProvider } = await import('../../../platform/model-gateway/gateway.js');
    const gateway = new ModelGateway([new StubProvider()], new AuditLog());
    const agent = new CreativeDesignAgent(gateway, ALLOWED);
    const result = await agent.generateConcepts(brief);
    expect(result.map((r) => r.payload.conceptName)).toContain('Meem ID Bar');
  });

  it('with no gateway configured, behaves exactly as the deterministic-only Release 1 agent', async () => {
    const agent = new CreativeDesignAgent();
    const result = await agent.generateConcepts(brief);
    expect(result.map((r) => r.payload.conceptName)).toEqual(['Meem ID Bar', 'Dune Cutout Cuff', 'Falaj Braid', 'Majlis Link']);
  });
});

describe('AnthropicProvider', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks(); });

  it('reports unhealthy without an API key and healthy with one', () => {
    expect(new AnthropicProvider('').healthy()).toBe(false);
    expect(new AnthropicProvider('sk-test').healthy()).toBe(true);
  });

  it('only supports the reasoning task profile', () => {
    const p = new AnthropicProvider('sk-test');
    expect(p.supports('reasoning')).toBe(true);
    expect(p.supports('image-generation')).toBe(false);
    expect(p.supports('vision')).toBe(false);
  });

  it('sends a forced tool call and parses the tool_use response', async () => {
    const mockFetch = vi.fn(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      expect(body.tool_choice).toEqual({ type: 'tool', name: 'propose_concepts' });
      expect(opts.headers['x-api-key']).toBe('sk-test');
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'tool_use', name: 'propose_concepts', input: { concepts: [] } }],
          usage: { input_tokens: 5, output_tokens: 7 },
          model: 'claude-sonnet-5',
        }),
      };
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new AnthropicProvider('sk-test');
    const response = await provider.invoke({
      task: 'reasoning',
      payloadClass: 'INTERNAL',
      input: {
        system: 'sys', userPrompt: 'hello',
        tool: { name: 'propose_concepts', description: 'd', input_schema: {} },
      },
    });
    expect(response.output).toEqual({ concepts: [] });
    expect(response.provider).toBe('anthropic-claude');
    expect(response.usage.tokens).toBe(12);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-OK response, letting the gateway fall back', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'server error' })) as unknown as typeof fetch;
    const provider = new AnthropicProvider('sk-test');
    await expect(
      provider.invoke({
        task: 'reasoning', payloadClass: 'INTERNAL',
        input: { system: 's', userPrompt: 'u', tool: { name: 'x', description: 'd', input_schema: {} } },
      }),
    ).rejects.toThrow(/Anthropic API 500/);
  });
});
