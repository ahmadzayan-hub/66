/** Design Readiness Score (§23): configurable weights, mandatory overrides. */

export interface ReadinessWeights {
  brandFit: number;
  manufacturability: number;
  originality: number;
  commercialViability: number;
  costFeasibility: number;
  aestheticQuality: number;
  marketRelevance: number;
  personalisationPotential: number;
}

export const DEFAULT_WEIGHTS: ReadinessWeights = {
  brandFit: 0.15,
  manufacturability: 0.2,
  originality: 0.1,
  commercialViability: 0.15,
  costFeasibility: 0.15,
  aestheticQuality: 0.1,
  marketRelevance: 0.1,
  personalisationPotential: 0.05,
};

export const RELEASE_THRESHOLD = 85;
/** Per-dimension floor (critical-review fix): any dimension below this fails. */
export const DIMENSION_FLOOR = 40;

export interface ReadinessInputs {
  scores: Record<keyof ReadinessWeights, number>; // each 0-100
  safetyPass: boolean;
  arabicApplicable: boolean;
  arabicPass: boolean;
}

export interface ReadinessResult {
  total: number;
  releaseReady: boolean;
  blockingReasons: string[];
}

export function computeReadiness(inputs: ReadinessInputs, weights: ReadinessWeights = DEFAULT_WEIGHTS): ReadinessResult {
  const blocking: string[] = [];

  // Mandatory overrides are non-configurable code (§23, rule 52.10).
  if (!inputs.safetyPass) blocking.push('MANDATORY: safety not PASS');
  if (inputs.arabicApplicable && !inputs.arabicPass) blocking.push('MANDATORY: Arabic accuracy not PASS');

  let total = 0;
  for (const [dim, weight] of Object.entries(weights) as [keyof ReadinessWeights, number][]) {
    const score = inputs.scores[dim];
    if (score < DIMENSION_FLOOR) blocking.push(`dimension floor: ${dim} = ${score} < ${DIMENSION_FLOOR}`);
    total += score * weight;
  }
  total = Math.round(total * 100) / 100;

  if (total < RELEASE_THRESHOLD) blocking.push(`total ${total} below release threshold ${RELEASE_THRESHOLD}`);

  return { total, releaseReady: blocking.length === 0, blockingReasons: blocking };
}
