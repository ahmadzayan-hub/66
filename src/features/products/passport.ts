import { newId } from '../../platform/kernel.js';
import { DesignVersion } from '../design-studio/versioning.js';
import { DesignBrief } from '../design-studio/models/concept.js';
import { MaterialRecord } from '../materials/materials.js';
import { CostResult } from '../costing/cost-engine.js';
import { QaReport } from '../qa/qa-agent.js';
import { ApprovalRecord } from '../approvals/approval-service.js';
import { MarketingAssets } from '../marketing/marketing-agent.js';

/** Digital Product Passport (§25). */
export interface ProductPassport {
  sku: string;
  designId: string;
  version: string;
  collection: string;
  targetGender: string;
  ageGroup: string;
  material: string;
  dimensions: string;
  weightG: number;
  finish: string;
  stones: string[];
  manufacturingMethod: string;
  workshop: string;
  supplier: string;
  costAed: number;
  retailPriceAed: number;
  marginPct: number;
  cadFiles: string[];
  vectorFiles: string[];
  renderFiles: string[];
  photography: string[];
  safetyAssessment: string;
  qaReport: QaReport;
  prototypeHistory: string[];
  productionHistory: string[];
  marketingAssets: MarketingAssets;
  salesPerformance: { units: number; revenueAed: number };
  returnRate: number;
  customerFeedback: string[];
}

export function buildSku(family: string, productType: string, versionNo: number): string {
  const fam = family.slice(0, 2).toUpperCase();
  const type = productType.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase();
  return `BS-${fam}-${type}-${newId('sku').split('_')[1]}-V${versionNo}`;
}

export function buildPassport(args: {
  brief: DesignBrief;
  version: DesignVersion;
  material: MaterialRecord;
  cost: CostResult;
  qa: QaReport;
  approvals: ApprovalRecord[];
  marketing: MarketingAssets;
  vectorFiles: string[];
  renderFiles: string[];
  workshop: string;
  safetyAssessment: string;
}): ProductPassport {
  const c = args.version.concept;
  return {
    sku: buildSku(args.brief.family, args.brief.productType, args.version.versionNo),
    designId: args.version.designId,
    version: args.version.versionId,
    collection: 'Signature Personalised',
    targetGender: args.brief.family === 'MEN' ? 'Men' : args.brief.family === 'WOMEN' ? 'Women' : 'Unisex',
    ageGroup: args.brief.isChildProduct ? 'Children' : 'Adults',
    material: args.material.materialName,
    dimensions: `${c.dimensions.lengthMm}×${c.dimensions.widthMm}×${c.dimensions.thicknessMm} mm`,
    weightG: c.estimatedWeightG,
    finish: args.material.finishingMethods[0] ?? 'high-polish',
    stones: [],
    manufacturingMethod: c.manufacturingMethod,
    workshop: args.workshop,
    supplier: args.material.supplier,
    costAed: args.cost.landedCost,
    retailPriceAed: args.brief.targetRetailPriceAed,
    marginPct: args.cost.grossMarginPct,
    cadFiles: args.vectorFiles,
    vectorFiles: args.vectorFiles,
    renderFiles: args.renderFiles,
    photography: [],
    safetyAssessment: args.safetyAssessment,
    qaReport: args.qa,
    prototypeHistory: ['prototype requested'],
    productionHistory: args.approvals.map((a) => `${a.gate}: ${a.decision} by ${a.decidedBy}`),
    marketingAssets: args.marketing,
    salesPerformance: { units: 0, revenueAed: 0 },
    returnRate: 0,
    customerFeedback: [],
  };
}
