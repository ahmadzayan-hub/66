import { AgentIdentity, Artifact, makeArtifact } from '../../../platform/kernel.js';
import { DesignBrief, DesignConcept, DimensionsMm } from '../models/concept.js';
import { ModelGateway } from '../../../platform/model-gateway/gateway.js';
import { AnthropicToolRequest } from '../../../platform/model-gateway/providers/anthropic-provider.js';

export class ConceptDistinctnessError extends Error {}

/**
 * "Materially different" is enforceable, not a prompt hope (critical review
 * §1): every pair of concepts must differ on >= 2 of {visual language,
 * construction, material treatment, personalisation mechanic}.
 */
export function assertMateriallyDifferent(concepts: DesignConcept[]): void {
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const a = concepts[i]!;
      const b = concepts[j]!;
      let differences = 0;
      if (a.visualLanguage !== b.visualLanguage) differences++;
      if (a.construction !== b.construction) differences++;
      if (a.materialId !== b.materialId || a.estimatedCostBand !== b.estimatedCostBand) differences++;
      if (a.personalisationMechanic !== b.personalisationMechanic) differences++;
      if (differences < 2) {
        throw new ConceptDistinctnessError(
          `Concepts "${a.conceptName}" and "${b.conceptName}" are cosmetic variations (only ${differences} material difference)`,
        );
      }
    }
  }
}

const BRACELET_DIMS = (minLine: number, gap: number, extras?: Partial<DimensionsMm>): DimensionsMm => ({
  lengthMm: 200,
  widthMm: 8,
  thicknessMm: 1.6,
  minLineWidthMm: minLine,
  minInternalGapMm: gap,
  hasIsolatedArabicDots: false,
  hasFragileBridges: false,
  ...extras,
});

const CONCEPT_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        required: [
          'conceptName', 'designStory', 'targetCustomer', 'visualLanguage', 'materialId',
          'dimensions', 'estimatedWeightG', 'manufacturingMethod', 'personalisationOptions',
          'complexity', 'estimatedCostBand', 'differentiation', 'risks', 'construction',
          'personalisationMechanic',
        ],
        properties: {
          conceptName: { type: 'string' },
          designStory: { type: 'string' },
          targetCustomer: { type: 'string' },
          visualLanguage: { type: 'string' },
          materialId: { type: 'string' },
          dimensions: {
            type: 'object',
            required: ['lengthMm', 'widthMm', 'thicknessMm', 'minLineWidthMm', 'minInternalGapMm', 'hasIsolatedArabicDots', 'hasFragileBridges'],
            properties: {
              lengthMm: { type: 'number' }, widthMm: { type: 'number' }, thicknessMm: { type: 'number' },
              minLineWidthMm: { type: 'number' }, minInternalGapMm: { type: 'number' },
              hasIsolatedArabicDots: { type: 'boolean' }, hasFragileBridges: { type: 'boolean' },
            },
          },
          estimatedWeightG: { type: 'number' },
          manufacturingMethod: { type: 'string' },
          personalisationOptions: { type: 'array', items: { type: 'string' } },
          complexity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          estimatedCostBand: { type: 'string', enum: ['ENTRY', 'CORE', 'PREMIUM'] },
          differentiation: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } },
          construction: { type: 'string' },
          personalisationMechanic: { type: 'string' },
        },
      },
    },
  },
  required: ['concepts'],
} as const;

/** Structural + business-rule validation of an LLM concept proposal. Throws on any defect. */
function validateLlmConcepts(raw: unknown, allowedMaterialIds: string[]): DesignConcept[] {
  const obj = raw as { concepts?: unknown[] };
  if (!Array.isArray(obj?.concepts) || obj.concepts.length !== 4) {
    throw new Error('LLM did not return exactly 4 concepts');
  }
  return obj.concepts.map((c, i) => {
    const concept = c as DesignConcept;
    const d = concept?.dimensions;
    if (!concept?.materialId || !allowedMaterialIds.includes(concept.materialId)) {
      throw new Error(`concept[${i}] has unknown materialId "${concept?.materialId}"`);
    }
    if (!d || [d.lengthMm, d.widthMm, d.thicknessMm, d.minLineWidthMm, d.minInternalGapMm].some((n) => !(typeof n === 'number' && n > 0))) {
      throw new Error(`concept[${i}] has invalid or non-positive dimensions`);
    }
    if (!concept.estimatedWeightG || concept.estimatedWeightG <= 0) {
      throw new Error(`concept[${i}] has invalid estimatedWeightG`);
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(concept.complexity)) throw new Error(`concept[${i}] has invalid complexity`);
    if (!['ENTRY', 'CORE', 'PREMIUM'].includes(concept.estimatedCostBand)) throw new Error(`concept[${i}] has invalid estimatedCostBand`);
    if (!Array.isArray(concept.personalisationOptions) || !Array.isArray(concept.risks)) {
      throw new Error(`concept[${i}] has invalid array fields`);
    }
    return concept;
  });
}

function buildConceptPrompt(brief: DesignBrief, allowedMaterialIds: string[]): AnthropicToolRequest {
  return {
    system:
      'You are the Creative Design agent inside Beyond Style UAE\'s product design pipeline. ' +
      'You propose jewellery concepts only — you never approve, evaluate, or make manufacturability, ' +
      'safety or cost decisions; deterministic downstream gates do that. Every concept you propose will ' +
      'be independently checked for brand fit, engineering feasibility, safety, cost ceiling, originality ' +
      'and QA before anything is produced. Do not invent Arabic lettering or claim any material has properties ' +
      '(hypoallergenic, certified, etc.) beyond what is stated. Propose real jewellery construction techniques only.',
    userPrompt:
      `Design brief:\n` +
      `- Family: ${brief.family}, product type: ${brief.productType}\n` +
      `- Target customer: ${brief.customerPersona} (${brief.customerSegment})\n` +
      `- Problem: ${brief.customerProblem}\n` +
      `- Target retail price: AED ${brief.targetRetailPriceAed}, required gross margin: ${brief.requiredGrossMarginPct}%\n` +
      `- Personalisation requested: ${brief.personalisation}${brief.arabicText ? ` (Arabic text element present — do not invent the letters, just note that an Arabic engraving area is needed)` : ''}\n` +
      `- Allowed materialId values (use one EXACTLY as given per concept): ${allowedMaterialIds.join(', ')}\n\n` +
      'Propose exactly 4 concepts for a bracelet in this brief\'s family that are materially different from ' +
      'each other — each pair must differ in at least 2 of: visual language, construction technique, ' +
      'material/cost band, personalisation mechanic. Do not produce 4 cosmetic variations of one idea. ' +
      'All dimensions are in millimetres; minLineWidthMm and minInternalGapMm should reflect realistic laser ' +
      'engraving/cutting tolerances for the material and complexity you choose.',
    tool: {
      name: 'propose_concepts',
      description: 'Return exactly 4 materially different jewellery design concepts matching the schema.',
      input_schema: CONCEPT_TOOL_SCHEMA,
    },
    maxTokens: 4096,
  };
}

/**
 * Creative Design agent (§8): four materially different concepts per brief.
 * When a live Model Gateway is supplied (ANTHROPIC_API_KEY configured), the
 * agent asks Claude to propose concepts, validates the response structurally
 * and against business rules, and falls back to the deterministic library on
 * any failure — the pipeline's behaviour never depends on the LLM succeeding.
 * The LLM's output must still pass assertMateriallyDifferent and every
 * downstream gate exactly like the deterministic path.
 */
export class CreativeDesignAgent implements AgentIdentity {
  agentId = 'agent-03-creative-design';
  capability = 'generate' as const;

  /**
   * Which path produced the most recent generateConcepts() result — surfaced
   * to the UI/API so users can see, per run, whether a real model was used
   * or the pipeline fell back to the deterministic library (never silently
   * misrepresented as "AI-generated" when it wasn't).
   */
  lastGenerationSource: 'llm' | 'deterministic' = 'deterministic';

  constructor(
    private gateway?: ModelGateway,
    private allowedMaterialIds: string[] = ['MAT-925', 'MAT-999', 'MAT-SS316', 'MAT-925-GP', 'MAT-925-RGP', 'MAT-925-RH', 'MAT-925-BRH', 'MAT-LEATHER', 'MAT-ONYX', 'MAT-MOP'],
  ) {}

  async generateConcepts(brief: DesignBrief): Promise<Artifact<DesignConcept>[]> {
    if (this.gateway) {
      try {
        const response = await this.gateway.run({
          task: 'reasoning',
          payloadClass: 'INTERNAL',
          input: buildConceptPrompt(brief, this.allowedMaterialIds),
        });
        // Only trust a genuinely live provider's output, never the offline stub's echo.
        if (response.provider !== 'stub-deterministic') {
          const concepts = validateLlmConcepts(response.output, this.allowedMaterialIds);
          assertMateriallyDifferent(concepts);
          this.lastGenerationSource = 'llm';
          return concepts.map((c) => makeArtifact('design-concept', [this.agentId], c));
        }
      } catch {
        // Any LLM/validation failure: fall through to the deterministic library below.
      }
    }
    this.lastGenerationSource = 'deterministic';
    return this.generateDeterministicConcepts(brief);
  }

  generateDeterministicConcepts(brief: DesignBrief): Artifact<DesignConcept>[] {
    const persona = brief.customerPersona;
    const arabic = Boolean(brief.arabicText);
    const concepts: DesignConcept[] = [
      {
        conceptName: 'Meem ID Bar',
        designStory:
          'A slim engraved ID-bar bracelet: a clean rectangular 925 silver plate carrying the customer name in Diwani calligraphy, hand-finished edges, adjustable curb chain. A contemporary UAE take on the classic identity bracelet, made for daily wear and meaningful gifting.',
        targetCustomer: persona,
        visualLanguage: 'engraved plate / elegant minimalism with arabic calligraphy focus',
        materialId: 'MAT-925',
        dimensions: BRACELET_DIMS(0.4, 0.45),
        estimatedWeightG: 7.5,
        manufacturingMethod: 'cast plate + laser engraving + hand polish',
        personalisationOptions: ['arabic name', 'date'],
        complexity: 'LOW',
        estimatedCostBand: 'CORE',
        differentiation: 'Diwani composition engineered for engraving depth consistency',
        risks: ['engraving contrast on high-polish finish'],
        construction: 'solid plate on curb chain',
        personalisationMechanic: 'engraved calligraphy',
      },
      {
        conceptName: 'Dune Cutout Cuff',
        designStory:
          'An open cuff where the name is pierced through the metal as negative space, inspired by dune ridgelines. Light passes through the calligraphy; brushed outer, polished inner face, crafted for a sculptural silhouette.',
        targetCustomer: persona,
        visualLanguage: 'pierced negative-space silhouette / sculptural',
        materialId: 'MAT-925',
        dimensions: BRACELET_DIMS(0.5, 0.5, { widthMm: 12, thicknessMm: 1.8 }),
        estimatedWeightG: 18,
        manufacturingMethod: 'laser cut + hand forming + brushed finish',
        personalisationOptions: ['arabic name'],
        complexity: 'MEDIUM',
        estimatedCostBand: 'CORE',
        differentiation: 'negative-space calligraphy reads from both sides',
        risks: ['cutout bridges need engineering validation'],
        construction: 'formed open cuff',
        personalisationMechanic: 'pierced negative space',
      },
      {
        conceptName: 'Falaj Braid',
        designStory:
          'Black leather braid meets a 925 silver channel bead carrying an engraved initial, referencing falaj water channels. Masculine, layered look; magnetic-free fold-over clasp, hand-assembled.',
        targetCustomer: persona,
        visualLanguage: 'mixed-material braid / heritage-textural',
        materialId: 'MAT-LEATHER',
        dimensions: BRACELET_DIMS(0.6, 0.6, { widthMm: 6, thicknessMm: 4 }),
        estimatedWeightG: 11,
        manufacturingMethod: 'cast bead + laser engraving + hand assembly',
        personalisationOptions: ['arabic initial'],
        complexity: 'MEDIUM',
        estimatedCostBand: 'ENTRY',
        differentiation: 'silver-on-leather channel bead with hidden engraving',
        risks: ['leather supplier consistency'],
        construction: 'braided leather with silver slider bead',
        personalisationMechanic: 'engraved bead initial',
      },
      {
        conceptName: 'Majlis Link',
        designStory:
          'A chain of geometric octagonal links drawn from majlis lattice screens; one central link is black-rhodium plated and carries the name in Ruqaa script. Premium contrast piece for gifting occasions, hand polished.',
        targetCustomer: persona,
        visualLanguage: 'geometric lattice links / premium contrast',
        materialId: 'MAT-925-BRH',
        dimensions: BRACELET_DIMS(0.35, 0.4, { widthMm: 9 }),
        estimatedWeightG: 21,
        manufacturingMethod: 'cast links + black rhodium plating + laser engraving',
        personalisationOptions: ['arabic name', 'short message'],
        complexity: 'HIGH',
        estimatedCostBand: 'PREMIUM',
        differentiation: 'two-tone lattice construction unique to the brand',
        risks: ['plating wear on contact surfaces', 'higher cost'],
        construction: 'articulated cast links',
        personalisationMechanic: 'engraved feature link',
      },
    ];

    if (!arabic) {
      for (const c of concepts) {
        c.personalisationOptions = c.personalisationOptions.map((p) => p.replace('arabic ', ''));
      }
    }

    assertMateriallyDifferent(concepts);
    return concepts.map((c) => makeArtifact('design-concept', [this.agentId], c));
  }
}
