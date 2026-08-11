import { AgentIdentity, Artifact, assertIndependentEvaluator } from '../../platform/kernel.js';
import { DesignConcept } from '../design-studio/models/concept.js';
import { MaterialRepository } from '../materials/materials.js';

/** Full cost input stack (§14). All amounts AED. */
export interface CostInputs {
  silverWeightG: number;
  silverPricePerG: number;
  stonesCost: number;
  cadCost: number;
  laserCost: number;
  castingCost: number;
  solderingCost: number;
  handcraftCost: number;
  platingCost: number;
  polishingCost: number;
  assemblyCost: number;
  packagingCost: number;
  qcCost: number;
  scrapPct: number;
  supplierMarginPct: number;
  deliveryCost: number;
  paymentFeePct: number;
  advertisingAllowancePct: number;
  returnsAllowancePct: number;
}

export interface CostResult {
  inputs: CostInputs;
  totalProductionCost: number;
  landedCost: number;
  minimumSellingPrice: number;
  recommendedRetailPrice: number;
  premiumRetailPrice: number;
  grossMarginPct: number;
  contributionMarginPct: number;
  expectedProfit: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCost(inputs: CostInputs, retailPriceAed: number): CostResult {
  const materialCost = inputs.silverWeightG * inputs.silverPricePerG + inputs.stonesCost;
  const processCost =
    inputs.cadCost + inputs.laserCost + inputs.castingCost + inputs.solderingCost +
    inputs.handcraftCost + inputs.platingCost + inputs.polishingCost +
    inputs.assemblyCost + inputs.packagingCost + inputs.qcCost;
  const baseCost = materialCost + processCost;
  const withScrap = baseCost * (1 + inputs.scrapPct / 100);
  const totalProductionCost = round2(withScrap * (1 + inputs.supplierMarginPct / 100));
  const landedCost = round2(totalProductionCost + inputs.deliveryCost);

  // Variable selling costs are a share of retail price.
  const variablePct = (inputs.paymentFeePct + inputs.advertisingAllowancePct + inputs.returnsAllowancePct) / 100;
  const minimumSellingPrice = round2(landedCost / (1 - variablePct));
  const recommendedRetailPrice = round2(Math.ceil((landedCost / (1 - variablePct) / 0.4) / 1) ); // 60% target gross margin
  const premiumRetailPrice = round2(recommendedRetailPrice * 1.25);

  const variableCosts = retailPriceAed * variablePct;
  const grossMarginPct = round2(((retailPriceAed - landedCost) / retailPriceAed) * 100);
  const contributionMarginPct = round2(((retailPriceAed - landedCost - variableCosts) / retailPriceAed) * 100);
  const expectedProfit = round2(retailPriceAed - landedCost - variableCosts);

  return {
    inputs,
    totalProductionCost,
    landedCost,
    minimumSellingPrice,
    recommendedRetailPrice,
    premiumRetailPrice,
    grossMarginPct,
    contributionMarginPct,
    expectedProfit,
  };
}

/**
 * Reverse costing (§14): target retail + required gross margin -> the maximum
 * acceptable landed production cost.
 */
export function reverseCostCeiling(targetRetailAed: number, requiredGrossMarginPct: number): number {
  return round2(targetRetailAed * (1 - requiredGrossMarginPct / 100));
}

export interface CostReview {
  cost: CostResult;
  ceilingAed: number;
  withinCeiling: boolean;
  /** Within ceiling but < 5% headroom (critical-review fix: headroom band). */
  headroomWarning: boolean;
  verdict: 'PASS' | 'FAIL';
}

/** Cost Engineering agent (§14). */
export class CostAgent implements AgentIdentity {
  agentId = 'agent-08-cost';
  capability = 'evaluate' as const;

  constructor(private materials: MaterialRepository) {}

  estimateInputs(concept: DesignConcept): CostInputs {
    const material = this.materials.get(concept.materialId);
    const isMetal = material.densityGCm3 > 5;
    const complexityFactor = concept.complexity === 'HIGH' ? 1.5 : concept.complexity === 'MEDIUM' ? 1.2 : 1.0;
    return {
      silverWeightG: isMetal ? concept.estimatedWeightG : concept.estimatedWeightG * 0.4,
      silverPricePerG: material.rawMaterialCostPerGramAed,
      stonesCost: 0,
      cadCost: 5, // amortised over the production run
      laserCost: 6 * complexityFactor,
      castingCost: material.castingCompatible ? 8 * complexityFactor : 0,
      solderingCost: 3,
      handcraftCost: 8 * complexityFactor,
      platingCost: material.materialId.includes('-GP') || material.materialId.includes('-RH') || material.materialId.includes('RGP') || material.materialId.includes('BRH') ? 12 : 0,
      polishingCost: 4,
      assemblyCost: 3,
      packagingCost: 5,
      qcCost: 2,
      scrapPct: material.estimatedWasteFactorPct,
      supplierMarginPct: 10,
      deliveryCost: 8,
      paymentFeePct: 3,
      advertisingAllowancePct: 8,
      returnsAllowancePct: 2,
    };
  }

  review(concept: Artifact<DesignConcept>, targetRetailAed: number, requiredGrossMarginPct: number): CostReview {
    assertIndependentEvaluator(this, concept);
    const inputs = this.estimateInputs(concept.payload);
    const cost = computeCost(inputs, targetRetailAed);
    const ceilingAed = reverseCostCeiling(targetRetailAed, requiredGrossMarginPct);
    const withinCeiling = cost.landedCost <= ceilingAed;
    const headroomWarning = withinCeiling && cost.landedCost > ceilingAed * 0.95;
    return { cost, ceilingAed, withinCeiling, headroomWarning, verdict: withinCeiling ? 'PASS' : 'FAIL' };
  }
}
