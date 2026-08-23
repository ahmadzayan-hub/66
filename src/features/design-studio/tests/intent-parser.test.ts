import { describe, expect, it } from 'vitest';
import { parseDesignIntent } from '../intent-parser.js';

describe('intent parser — Arabic requests', () => {
  it('parses the canonical request: product + name + style + budget', () => {
    const p = parseDesignIntent('عايزة إسورة فضة باسم خالد بالديواني بميزانية 250');
    expect(p.productType).toBe('bracelet');
    expect(p.arabicText).toBe('خالد');
    expect(p.calligraphyStyle).toBe('DIWANI');
    expect(p.targetRetailPriceAed).toBe(250);
    expect(p.recognised).toEqual(
      expect.arrayContaining(['productType', 'arabicText', 'calligraphyStyle', 'budget']),
    );
  });

  it('parses Arabic-Indic digits and درهم suffix', () => {
    const p = parseDesignIntent('سلسلة باسم مريم بالثلث ٣٥٠ درهم');
    expect(p.productType).toBe('necklace');
    expect(p.arabicText).toBe('مريم');
    expect(p.calligraphyStyle).toBe('THULUTH_INSPIRED');
    expect(p.targetRetailPriceAed).toBe(350);
  });

  it('detects family from context words', () => {
    expect(parseDesignIntent('خاتم رجالي باسم سيف').family).toBe('MEN');
    expect(parseDesignIntent('هدية قلادة باسم نورة').family).toBe('GIFTS');
    expect(parseDesignIntent('إسوارة لزوجتي باسم لطيفة').family).toBe('WOMEN');
  });

  it('flags child products and applies the wearable child-safety flag', () => {
    const p = parseDesignIntent('إسوارة لطفل باسم حمد');
    expect(p.family).toBe('BABIES_CHILDREN');
    expect(p.isChildProduct).toBe(true);
    expect(p.isWearableChildProduct).toBe(true);
    expect(p.warnings.join(' ')).toContain('سلامة الأطفال');
  });

  it('keychain for a child is a child product but not wearable', () => {
    const p = parseDesignIntent('ميدالية مفاتيح لطفل باسم زايد');
    expect(p.productType).toBe('keychain');
    expect(p.isChildProduct).toBe(true);
    expect(p.isWearableChildProduct).toBe(false);
  });

  it('distinguishes DIWANI_JALI from DIWANI', () => {
    expect(parseDesignIntent('باسم راشد بالديواني الجلي').calligraphyStyle).toBe('DIWANI_JALI');
    expect(parseDesignIntent('باسم راشد بالديواني').calligraphyStyle).toBe('DIWANI');
  });
});

describe('intent parser — English and mixed requests', () => {
  it('parses an English request with a quoted Arabic name', () => {
    const p = parseDesignIntent('A silver bracelet with the name «أحمد» in Diwani, budget AED 300');
    expect(p.productType).toBe('bracelet');
    expect(p.arabicText).toBe('أحمد');
    expect(p.calligraphyStyle).toBe('DIWANI');
    expect(p.targetRetailPriceAed).toBe(300);
  });

  it('warns (without failing) when the name is missing', () => {
    const p = parseDesignIntent('a ring for my wife, naskh style, around 400');
    expect(p.productType).toBe('ring');
    expect(p.family).toBe('WOMEN');
    expect(p.arabicText).toBeUndefined();
    expect(p.calligraphyStyle).toBe('NASKH');
    expect(p.targetRetailPriceAed).toBe(400);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
});

describe('intent parser — defaults and guards', () => {
  it('falls back to sane defaults and says so', () => {
    const p = parseDesignIntent('حاجة حلوة');
    expect(p.productType).toBe('bracelet');
    expect(p.family).toBe('PERSONALISED');
    expect(p.calligraphyStyle).toBe('DIWANI');
    expect(p.targetRetailPriceAed).toBeUndefined();
    expect(p.recognised).not.toContain('productType');
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it('rejects out-of-range budgets instead of passing them to the pipeline', () => {
    expect(parseDesignIntent('إسورة باسم سعيد بـ 20').targetRetailPriceAed).toBeUndefined();
    expect(parseDesignIntent('إسورة باسم سعيد بميزانية 500000').targetRetailPriceAed).toBeUndefined();
  });

  it('does not treat stopwords after باسم as the name', () => {
    const p = parseDesignIntent('إسورة باسم من فضلك');
    expect(p.arabicText).toBeUndefined();
  });
});
