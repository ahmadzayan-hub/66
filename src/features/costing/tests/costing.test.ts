import { describe, expect, it } from 'vitest';
import { computeCost, reverseCostCeiling, CostInputs } from '../cost-engine.js';

const inputs: CostInputs = {
  silverWeightG: 10,
  silverPricePerG: 4,
  stonesCost: 0,
  cadCost: 5,
  laserCost: 6,
  castingCost: 8,
  solderingCost: 3,
  handcraftCost: 8,
  platingCost: 0,
  polishingCost: 4,
  assemblyCost: 3,
  packagingCost: 5,
  qcCost: 2,
  scrapPct: 10,
  supplierMarginPct: 10,
  deliveryCost: 8,
  paymentFeePct: 3,
  advertisingAllowancePct: 8,
  returnsAllowancePct: 2,
};

describe('cost engine (§14)', () => {
  it('computes production and landed cost with scrap and supplier margin', () => {
    const result = computeCost(inputs, 249);
    // material 40 + process 44 = 84; ×1.10 scrap = 92.4; ×1.10 supplier = 101.64
    expect(result.totalProductionCost).toBeCloseTo(101.64, 2);
    expect(result.landedCost).toBeCloseTo(109.64, 2);
  });

  it('weight drives material cost linearly (weight calculation)', () => {
    const light = computeCost({ ...inputs, silverWeightG: 5 }, 249);
    const heavy = computeCost({ ...inputs, silverWeightG: 20 }, 249);
    const perGram = 1 * 1.1 * 1.1 * 4; // scrap × supplier × price
    expect(heavy.landedCost - light.landedCost).toBeCloseTo(15 * perGram, 2);
  });

  it('computes margins and profit against the retail price', () => {
    const r = computeCost(inputs, 249);
    expect(r.grossMarginPct).toBeCloseTo(((249 - 109.64) / 249) * 100, 1);
    const variable = 249 * 0.13;
    expect(r.expectedProfit).toBeCloseTo(249 - 109.64 - variable, 1);
    expect(r.minimumSellingPrice).toBeCloseTo(109.64 / 0.87, 1);
  });

  it('reverse costing: AED 249 at 60% margin gives a 99.60 ceiling (§14 example)', () => {
    expect(reverseCostCeiling(249, 60)).toBeCloseTo(99.6, 2);
  });

  it('reverse costing flags over-ceiling designs for redesign', () => {
    const r = computeCost(inputs, 249);
    const ceiling = reverseCostCeiling(249, 60);
    expect(r.landedCost).toBeGreaterThan(ceiling); // this stack must be routed back
  });
});
