import { describe, expect, it } from 'vitest';
import {
  compareExactText,
  computeConnectivity,
  validateArabicText,
} from '../validators/arabic-validator.js';
import { MasterArtworkRegistry, ArabicValidationError } from '../master-artwork.js';
import { AuditLog } from '../../../platform/audit/audit-log.js';
import { ImmutabilityError } from '../../../platform/kernel.js';

describe('Arabic validation (§9)', () => {
  it('validates RTL and rejects mixed Latin', () => {
    expect(validateArabicText('خالد').isRtl).toBe(true);
    const mixed = validateArabicText('خالد Khalid');
    expect(mixed.valid).toBe(false);
    expect(mixed.issues.join(' ')).toContain('Latin');
  });

  it('counts dot-bearing letters (dots must never be dropped)', () => {
    // خالد: خ carries a dot; ا ل د do not.
    expect(validateArabicText('خالد').dotBearingLetters).toBe(1);
    // نور: ن has a dot, و and ر do not.
    expect(validateArabicText('نور').dotBearingLetters).toBe(1);
    // يثب: all three dotted.
    expect(validateArabicText('يثب').dotBearingLetters).toBe(3);
  });

  it('computes letter connectivity ground truth', () => {
    // خالد: خ joins next (dual); ا does NOT join next; ل joins د; د terminal.
    const joins = computeConnectivity('خالد');
    expect(joins.map((j) => j.joinsNext)).toEqual([true, false, true, false]);
    // First letter never joins previous.
    expect(joins[0]!.joinsPrevious).toBe(false);
    // د follows ل which is dual-joining, so it joins previous.
    expect(joins[3]!.joinsPrevious).toBe(true);
  });

  it('detects hamza and diacritics', () => {
    expect(validateArabicText('أمل').hasHamza).toBe(true);
    expect(validateArabicText('مُحَمَّد').hasDiacritics).toBe(true);
  });

  it('exact-preservation catches every tampering class', () => {
    expect(compareExactText('خالد', 'خالد')).toEqual([]);
    expect(compareExactText('خالد', 'حالد').join(' ')).toContain('letter sequence'); // dot dropped from خ
    expect(compareExactText('نور الهدى', 'الهدى نور').join(' ')).toBeTruthy(); // word order
    expect(compareExactText('أمل', 'امل')).not.toEqual([]); // hamza dropped
    expect(compareExactText('مُحَمَّد', 'محمد').join(' ')).toContain('diacritics');
  });
});

describe('Master artwork registry (§9, rule 52.9)', () => {
  it('rejects invalid Arabic at creation', () => {
    const reg = new MasterArtworkRegistry(new AuditLog());
    expect(() => reg.createPending('Khalid', 'DIWANI', 'customer')).toThrow(ArabicValidationError);
  });

  it('requires human approval before use and locks spelling forever', () => {
    const reg = new MasterArtworkRegistry(new AuditLog());
    const artwork = reg.createPending('خالد', 'DIWANI', 'customer');
    expect(artwork.status).toBe('PENDING_HUMAN_APPROVAL');
    reg.approve(artwork.artworkId, 'user-arabic-01');
    expect(reg.get(artwork.artworkId).status).toBe('APPROVED');
    // Derivations must preserve the locked spelling exactly.
    expect(() => reg.assertDerivationExact(artwork.artworkId, 'حالد')).toThrow(ImmutabilityError);
    expect(() => reg.assertDerivationExact(artwork.artworkId, 'خالد')).not.toThrow();
    // There is no way to change the locked spelling.
    expect(() => reg.relock()).toThrow(ImmutabilityError);
  });
});
