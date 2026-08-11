import { ImmutabilityError, newId } from '../../platform/kernel.js';
import { AuditLog } from '../../platform/audit/audit-log.js';
import { ArabicValidationReport, compareExactText, validateArabicText } from './validators/arabic-validator.js';

/** Supported calligraphy styles (§9). */
export const CALLIGRAPHY_STYLES = [
  'DIWANI',
  'DIWANI_JALI',
  'NASKH',
  'RUQAA',
  'AREF_RUQAA',
  'AMIRI',
  'THULUTH_INSPIRED',
] as const;
export type CalligraphyStyle = (typeof CALLIGRAPHY_STYLES)[number];

export interface MasterArabicArtwork {
  artworkId: string;
  /** Customer-approved exact text. Locked at creation; never mutated. */
  approvedText: string;
  lockedAt: number;
  lockedBy: string;
  style: CalligraphyStyle;
  validation: ArabicValidationReport;
  status: 'PENDING_HUMAN_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
}

export class ArabicValidationError extends Error {
  constructor(public issues: string[]) {
    super(`Arabic validation failed: ${issues.join('; ')}`);
  }
}

/**
 * Master Arabic Artwork registry (§9): one approved artwork per text; every
 * product variant derives from the same approved artwork ID. The image model
 * never invents lettering — artwork text is the locked customer input.
 */
export class MasterArtworkRegistry {
  private artworks = new Map<string, MasterArabicArtwork>();
  private locks = new Map<string, number>();

  constructor(private audit: AuditLog) {}

  /** Step 1-4 of the workflow: validate exact text and create pending artwork. */
  createPending(customerText: string, style: CalligraphyStyle, lockedBy: string): MasterArabicArtwork {
    const validation = validateArabicText(customerText);
    if (!validation.valid) throw new ArabicValidationError(validation.issues);
    const artwork: MasterArabicArtwork = {
      artworkId: newId('ART-AR'),
      approvedText: customerText.trim(),
      lockedAt: Date.now(),
      lockedBy,
      style,
      validation,
      status: 'PENDING_HUMAN_APPROVAL',
    };
    this.artworks.set(artwork.artworkId, artwork);
    this.locks.set(artwork.artworkId, artwork.lockedAt);
    this.audit.append({
      actorType: 'system',
      actorId: 'arabic-registry',
      action: 'arabic.artwork.pending',
      subjectType: 'artwork',
      subjectId: artwork.artworkId,
      detail: { text: artwork.approvedText, style },
    });
    return artwork;
  }

  /** Human approval gate (§45: Arabic master artwork is always human-gated). */
  approve(artworkId: string, humanUserId: string): MasterArabicArtwork {
    const artwork = this.get(artworkId);
    if (artwork.status === 'APPROVED') return artwork;
    artwork.status = 'APPROVED';
    artwork.approvedBy = humanUserId;
    this.audit.append({
      actorType: 'human',
      actorId: humanUserId,
      action: 'arabic.artwork.approved',
      subjectType: 'artwork',
      subjectId: artworkId,
      detail: { text: artwork.approvedText },
    });
    return artwork;
  }

  get(artworkId: string): MasterArabicArtwork {
    const artwork = this.artworks.get(artworkId);
    if (!artwork) throw new Error(`Unknown artwork ${artworkId}`);
    return artwork;
  }

  /**
   * Guard used by renderers, CAD and marketing: any text derived from this
   * artwork must exactly preserve the locked spelling (rule 52.9).
   */
  assertDerivationExact(artworkId: string, derivedText: string): void {
    const artwork = this.get(artworkId);
    const violations = compareExactText(artwork.approvedText, derivedText);
    if (violations.length > 0) {
      this.audit.append({
        actorType: 'system',
        actorId: 'arabic-registry',
        action: 'arabic.derivation.REJECTED',
        subjectType: 'artwork',
        subjectId: artworkId,
        detail: { derivedText, violations },
      });
      throw new ImmutabilityError(
        `Derived text violates approved artwork ${artworkId}: ${violations.join('; ')}`,
      );
    }
  }

  /** The locked spelling can never be changed — there is no setter; attempts throw. */
  relock(): never {
    throw new ImmutabilityError('Customer-approved spelling is immutable once locked');
  }
}
