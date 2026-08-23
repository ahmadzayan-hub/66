/**
 * Customer intent parser — the "understanding" step of the Co-Design Studio.
 *
 * Turns a free-text request (Arabic, English, or mixed) like
 *   «عايزة إسورة فضة باسم خالد بالديواني بميزانية ٢٥٠»
 * into a structured design brief the deterministic pipeline can run.
 *
 * Deterministic by design: a lexicon + pattern parser, no model call. The
 * Model Gateway may later PROPOSE a parse for exotic phrasing, but exactly
 * like concept generation, an LLM output would only ever be a proposal —
 * this module (and the gates behind it) stay the authority.
 */
import { ProductFamily } from './models/concept.js';
import { CALLIGRAPHY_STYLES, CalligraphyStyle } from '../arabic-design/master-artwork.js';

export interface ParsedIntent {
  productType: string;
  family: ProductFamily;
  arabicText?: string;
  calligraphyStyle: CalligraphyStyle;
  targetRetailPriceAed?: number;
  isChildProduct: boolean;
  isWearableChildProduct: boolean;
  /** Which fields were actually recognised in the text (vs defaulted). */
  recognised: string[];
  /** Human-readable follow-ups the studio should ask before running. */
  warnings: string[];
}

const PRODUCT_TYPES: Array<{ type: string; wearable: boolean; patterns: RegExp }> = [
  { type: 'bracelet', wearable: true, patterns: /(إسوارة|اسوارة|إسورة|اسورة|أسورة|سوار|bracelet)/i },
  { type: 'necklace', wearable: true, patterns: /(سلسلة|سلسله|قلادة|قلاده|عقد|necklace|chain)/i },
  { type: 'pendant', wearable: true, patterns: /(تعليقة|تعليقه|دلاية|دلايه|pendant|charm)/i },
  { type: 'ring', wearable: true, patterns: /(خاتم|محبس|ring)/i },
  { type: 'earrings', wearable: true, patterns: /(حلق|أقراط|اقراط|earring)/i },
  { type: 'cufflinks', wearable: true, patterns: /(كبك|أزرار أكمام|cufflink)/i },
  { type: 'keychain', wearable: false, patterns: /(ميدالية|ميداليه|مفاتيح|keychain|keyring)/i },
];

const STYLES: Array<{ style: CalligraphyStyle; patterns: RegExp }> = [
  { style: 'DIWANI_JALI', patterns: /(ديواني جلي|جلي|diwani\s*jali)/i },
  { style: 'DIWANI', patterns: /(ديواني|الديواني|diwani)/i },
  { style: 'NASKH', patterns: /(نسخ|النسخ|naskh)/i },
  { style: 'AREF_RUQAA', patterns: /(رقعة عارف|aref)/i },
  { style: 'RUQAA', patterns: /(رقعة|الرقعة|ruq)/i },
  { style: 'AMIRI', patterns: /(أميري|اميري|amiri)/i },
  { style: 'THULUTH_INSPIRED', patterns: /(ثلث|الثلث|thuluth)/i },
];

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function normaliseDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

const ARABIC_LETTERS = /[ء-ي]/;
/** Words that follow «باسم/اسم» but are not the name itself. */
const NAME_STOPWORDS = new Set(['على', 'من', 'في', 'مع', 'و']);

function extractArabicName(text: string): string | undefined {
  // «باسم خالد» / «اسم مريم» / «بإسم نورة»
  const m = text.match(/(?:باسم|بإسم|بأسم|اسم|إسم)\s+([ء-ي]{2,20})/);
  if (m && m[1] && !NAME_STOPWORDS.has(m[1])) return m[1];
  // Quoted text: «...» or "..."
  const q = text.match(/[«"']([ء-ي][ء-ي\s]{0,30})[»"']/);
  if (q && q[1]) return q[1].trim();
  return undefined;
}

function extractBudget(text: string): number | undefined {
  const t = normaliseDigits(text);
  const m =
    t.match(/(?:ميزانية|بحدود|حوالي|تقريبا|budget|around|about|under)\s*(?:AED|aed|درهم)?\s*(\d{2,6})/i) ??
    t.match(/(\d{2,6})\s*(?:درهم|AED|aed|dhs|dh)/i) ??
    t.match(/(?:بـ|ب)\s?(\d{2,6})(?!\d)/);
  if (!m || !m[1]) return undefined;
  const n = Number(m[1]);
  return n >= 50 && n <= 100000 ? n : undefined;
}

function detectFamily(text: string, hasChild: boolean): { family: ProductFamily; recognised: boolean } {
  if (hasChild) return { family: 'BABIES_CHILDREN', recognised: true };
  if (/(شركة|شركات|مؤسسة|corporate|company)/i.test(text)) return { family: 'CORPORATE', recognised: true };
  if (/(هدية|هديه|gift)/i.test(text)) return { family: 'GIFTS', recognised: true };
  if (/(رجالي|لرجل|رجل|زوجي|men|husband|father|أبوي|والدي)/i.test(text)) return { family: 'MEN', recognised: true };
  if (/(نسائي|حريمي|لزوجتي|زوجتي|أمي|والدتي|بنت|women|wife|mother|lady)/i.test(text)) return { family: 'WOMEN', recognised: true };
  if (/(الإمارات|دبي|uae|emirat)/i.test(text)) return { family: 'UAE_INSPIRED', recognised: true };
  return { family: 'PERSONALISED', recognised: false };
}

export function parseDesignIntent(raw: string): ParsedIntent {
  const text = (raw ?? '').trim();
  const recognised: string[] = [];
  const warnings: string[] = [];

  const productMatch = PRODUCT_TYPES.find((p) => p.patterns.test(text));
  if (productMatch) recognised.push('productType');
  const productType = productMatch?.type ?? 'bracelet';
  const wearable = productMatch?.wearable ?? true;

  const isChildProduct = /(طفل|أطفال|اطفال|بيبي|مولود|بنتي|ولدي|ابني|kid|child|baby)/i.test(text);
  if (isChildProduct) recognised.push('child');

  const fam = detectFamily(text, isChildProduct);
  if (fam.recognised) recognised.push('family');

  const styleMatch = STYLES.find((s) => s.patterns.test(text));
  if (styleMatch) recognised.push('calligraphyStyle');
  const calligraphyStyle: CalligraphyStyle = styleMatch?.style ?? 'DIWANI';

  const arabicText = extractArabicName(text);
  if (arabicText) recognised.push('arabicText');

  const targetRetailPriceAed = extractBudget(text);
  if (targetRetailPriceAed !== undefined) recognised.push('budget');

  if (!arabicText) {
    if (ARABIC_LETTERS.test(text)) {
      warnings.push('لم أتعرف على الاسم المطلوب نقشه — اكتبه بصيغة «باسم …» أو أضِفه في الخطوة التالية.');
    } else {
      warnings.push('Personalisation name not recognised — add the Arabic name in the next step (engraving is Arabic-calligraphy native).');
    }
  }
  if (!productMatch) {
    warnings.push('نوع المنتج غير واضح — افترضت «إسوارة»، عدّليه إن أردت. / Product type unclear — assumed bracelet.');
  }
  if (isChildProduct && wearable) {
    warnings.push('منتج لطفل: بوابة سلامة الأطفال ستُطبق تلقائيًا (خامات وأجزاء صغيرة). / Child product — the child-safety gate applies.');
  }

  return {
    productType,
    family: fam.family,
    arabicText,
    calligraphyStyle,
    targetRetailPriceAed,
    isChildProduct,
    isWearableChildProduct: isChildProduct && wearable,
    recognised,
    warnings,
  };
}

/** Guard used by the API boundary. */
export function isCalligraphyStyle(s: string): s is CalligraphyStyle {
  return (CALLIGRAPHY_STYLES as readonly string[]).includes(s);
}
