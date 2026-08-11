import { AgentIdentity, Artifact, makeArtifact } from '../../../platform/kernel.js';
import { DesignBrief, DesignConcept, DimensionsMm } from '../models/concept.js';

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

/**
 * Creative Design agent (§8): four materially different concepts per brief.
 * Release 1 uses a deterministic concept library keyed by brief attributes;
 * the Model Gateway slot is where generative concepting plugs in — its
 * output must still pass assertMateriallyDifferent and every downstream gate.
 */
export class CreativeDesignAgent implements AgentIdentity {
  agentId = 'agent-03-creative-design';
  capability = 'generate' as const;

  generateConcepts(brief: DesignBrief): Artifact<DesignConcept>[] {
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
