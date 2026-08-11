/** Materials engine (§4): extensible records + unsupported-claim guard. */

export interface MaterialRecord {
  materialId: string;
  materialName: string;
  composition: string;
  densityGCm3: number;
  supplier: string;
  rawMaterialCostPerGramAed: number;
  manufacturingCompatibility: string[];
  castingCompatible: boolean;
  laserCompatible: boolean;
  cncCompatible: boolean;
  platingCompatible: boolean;
  minimumThicknessMm: number;
  finishingMethods: string[];
  polishingRequirements: string;
  estimatedWasteFactorPct: number;
  safetyRestrictions: string[];
  skinContactNotes: string;
  targetProductCategories: string[];
  costBand: 'ENTRY' | 'CORE' | 'PREMIUM';
  /** claim -> evidence reference. Claims without evidence cannot be published. */
  certificationEvidence: Record<string, string>;
}

/** Claims that must never be made without supporting evidence (§4, rule 52.6). */
export const RESTRICTED_CLAIMS = [
  'hypoallergenic',
  'nickel-free',
  'medical grade',
  'non-toxic',
  'certified',
] as const;

export class UnsupportedClaimError extends Error {}

/**
 * Guard used by marketing/catalogue generation: strips or rejects restricted
 * claims that lack certification evidence on the material record.
 */
export function assertClaimAllowed(material: MaterialRecord, claim: string): void {
  const normalized = claim.toLowerCase();
  const restricted = RESTRICTED_CLAIMS.some((c) => normalized.includes(c));
  if (restricted && !material.certificationEvidence[normalized]) {
    throw new UnsupportedClaimError(
      `Claim "${claim}" on ${material.materialName} has no certification evidence`,
    );
  }
}

export function filterClaims(material: MaterialRecord, claims: string[]): string[] {
  return claims.filter((claim) => {
    try {
      assertClaimAllowed(material, claim);
      return true;
    } catch {
      return false;
    }
  });
}

export class MaterialRepository {
  private materials = new Map<string, MaterialRecord>();

  add(material: MaterialRecord): void {
    this.materials.set(material.materialId, material);
  }

  get(materialId: string): MaterialRecord {
    const m = this.materials.get(materialId);
    if (!m) throw new Error(`Unknown material ${materialId}`);
    return m;
  }

  all(): MaterialRecord[] {
    return [...this.materials.values()];
  }
}

/** Seed data: initial supported materials (§4). */
export function seedMaterials(repo: MaterialRepository): void {
  const base: Omit<MaterialRecord, 'materialId' | 'materialName' | 'composition' | 'densityGCm3' | 'rawMaterialCostPerGramAed' | 'costBand'> = {
    supplier: 'UAE Silver Trading LLC',
    manufacturingCompatibility: ['casting', 'laser', 'handcraft'],
    castingCompatible: true,
    laserCompatible: true,
    cncCompatible: true,
    platingCompatible: true,
    minimumThicknessMm: 0.8,
    finishingMethods: ['high-polish', 'brushed', 'matte'],
    polishingRequirements: 'standard tumble + hand finish',
    estimatedWasteFactorPct: 8,
    safetyRestrictions: [],
    skinContactNotes: 'Standard skin contact material; individual sensitivities vary.',
    targetProductCategories: ['men', 'women', 'couples', 'gifts'],
    certificationEvidence: {},
  };
  repo.add({
    ...base,
    materialId: 'MAT-925',
    materialName: '925 Sterling Silver',
    composition: '92.5% Ag, 7.5% Cu',
    densityGCm3: 10.36,
    rawMaterialCostPerGramAed: 4.2,
    costBand: 'CORE',
  });
  repo.add({
    ...base,
    materialId: 'MAT-999',
    materialName: 'Fine Silver',
    composition: '99.9% Ag',
    densityGCm3: 10.49,
    rawMaterialCostPerGramAed: 4.6,
    costBand: 'PREMIUM',
  });
  repo.add({
    ...base,
    materialId: 'MAT-SS316',
    materialName: 'Stainless Steel 316L',
    composition: 'Fe/Cr/Ni/Mo 316L',
    densityGCm3: 8.0,
    rawMaterialCostPerGramAed: 0.4,
    costBand: 'ENTRY',
    castingCompatible: false,
  });
  repo.add({
    ...base,
    materialId: 'MAT-925-GP',
    materialName: 'Gold-Plated 925 Silver',
    composition: '925 Ag core, 18k Au plating 1.0µm',
    densityGCm3: 10.36,
    rawMaterialCostPerGramAed: 5.1,
    costBand: 'PREMIUM',
  });
  repo.add({
    ...base,
    materialId: 'MAT-925-RGP',
    materialName: 'Rose-Gold-Plated 925 Silver',
    composition: '925 Ag core, rose gold plating 1.0µm',
    densityGCm3: 10.36,
    rawMaterialCostPerGramAed: 5.0,
    costBand: 'PREMIUM',
  });
  repo.add({
    ...base,
    materialId: 'MAT-925-RH',
    materialName: 'Rhodium-Plated 925 Silver',
    composition: '925 Ag core, Rh plating',
    densityGCm3: 10.36,
    rawMaterialCostPerGramAed: 5.3,
    costBand: 'PREMIUM',
  });
  repo.add({
    ...base,
    materialId: 'MAT-925-BRH',
    materialName: 'Black Rhodium 925 Silver',
    composition: '925 Ag core, black Rh plating',
    densityGCm3: 10.36,
    rawMaterialCostPerGramAed: 5.4,
    costBand: 'PREMIUM',
  });
  repo.add({
    ...base,
    materialId: 'MAT-LEATHER',
    materialName: 'Leather (vegetable tanned)',
    composition: 'Vegetable-tanned leather',
    densityGCm3: 0.9,
    rawMaterialCostPerGramAed: 0.15,
    costBand: 'ENTRY',
    castingCompatible: false,
    platingCompatible: false,
    targetProductCategories: ['men'],
    safetyRestrictions: ['not for babies-children category'],
  });
  repo.add({
    ...base,
    materialId: 'MAT-ONYX',
    materialName: 'Onyx',
    composition: 'Chalcedony (SiO2)',
    densityGCm3: 2.65,
    rawMaterialCostPerGramAed: 0.8,
    costBand: 'CORE',
    castingCompatible: false,
    platingCompatible: false,
  });
  repo.add({
    ...base,
    materialId: 'MAT-MOP',
    materialName: 'Mother of Pearl',
    composition: 'Nacre',
    densityGCm3: 2.7,
    rawMaterialCostPerGramAed: 1.2,
    costBand: 'PREMIUM',
    castingCompatible: false,
    platingCompatible: false,
  });
}
