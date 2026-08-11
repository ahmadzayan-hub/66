/** Design brief and concept models (§8, §51). */

export type ProductFamily =
  | 'MEN'
  | 'WOMEN'
  | 'BABIES_CHILDREN'
  | 'COUPLES'
  | 'GIFTS'
  | 'PERSONALISED'
  | 'ARABIC_CALLIGRAPHY'
  | 'CORPORATE'
  | 'UAE_INSPIRED'
  | 'SEASONAL';

export interface DesignBrief {
  briefId: string;
  title: string;
  family: ProductFamily;
  productType: string;
  customerSegment: string;
  customerPersona: string;
  customerProblem: string;
  marketRationale: string;
  targetRetailPriceAed: number;
  requiredGrossMarginPct: number;
  personalisation: boolean;
  arabicText?: string;
  isChildProduct: boolean;
  isWearableChildProduct: boolean;
  isReligiousText: boolean;
}

export interface DimensionsMm {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** Fine features present in the design (engraving lines, gaps, bridges). */
  minLineWidthMm: number;
  minInternalGapMm: number;
  hasIsolatedArabicDots: boolean;
  hasFragileBridges: boolean;
}

export interface DesignConcept {
  conceptName: string;
  designStory: string;
  targetCustomer: string;
  visualLanguage: string;
  materialId: string;
  dimensions: DimensionsMm;
  estimatedWeightG: number;
  manufacturingMethod: string;
  personalisationOptions: string[];
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCostBand: 'ENTRY' | 'CORE' | 'PREMIUM';
  differentiation: string;
  risks: string[];
  /** Construction approach — used by the distinctness validator. */
  construction: string;
  /** Personalisation mechanic — used by the distinctness validator. */
  personalisationMechanic: string;
}
