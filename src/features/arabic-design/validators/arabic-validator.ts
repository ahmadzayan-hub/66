/**
 * Deterministic Arabic text validators (§9). These run AFTER any model step:
 * the correctness of engraved Arabic never depends on model behaviour.
 */

export interface ArabicValidationReport {
  input: string;
  valid: boolean;
  isRtl: boolean;
  letterCount: number;
  dotBearingLetters: number;
  hasDiacritics: boolean;
  hasHamza: boolean;
  words: string[];
  connectivity: LetterJoin[];
  issues: string[];
}

export interface LetterJoin {
  char: string;
  joinsPrevious: boolean;
  joinsNext: boolean;
}

const ARABIC_BLOCK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const DIACRITICS = /[ً-ٰٟ]/;
const HAMZA_FORMS = /[ءأؤإئ]/;
const LATIN = /[A-Za-z]/;

/** Letters that carry i'jam dots — their dots must never be dropped. */
const DOTTED = new Set([...'بتثجخذزشضظغفقنةيئؤ']);

/** Non-joining (right-joining only) letters: never connect to the following letter. */
const RIGHT_JOIN_ONLY = new Set([...'اأإآدذرزوؤءة']);

export function containsArabic(text: string): boolean {
  return ARABIC_BLOCK.test(text);
}

/** Strip harakat for comparisons where diacritics are optional. */
export function stripDiacritics(text: string): string {
  return text.replace(/[ً-ٰٟ]/g, '');
}

function isArabicLetter(ch: string): boolean {
  return ARABIC_BLOCK.test(ch) && !DIACRITICS.test(ch);
}

/**
 * Compute the expected joining behaviour of each letter — the ground truth
 * the rendered calligraphy must preserve (connections, §9).
 */
export function computeConnectivity(text: string): LetterJoin[] {
  const letters = [...stripDiacritics(text)].filter((c) => isArabicLetter(c));
  return letters.map((char, i) => {
    const prev = letters[i - 1];
    const isFirstOfWord = i === 0 || prev === undefined;
    const joinsPrevious = !isFirstOfWord && prev !== undefined && !RIGHT_JOIN_ONLY.has(prev);
    const joinsNext = i < letters.length - 1 && !RIGHT_JOIN_ONLY.has(char);
    return { char, joinsPrevious, joinsNext };
  });
}

export function validateArabicText(input: string): ArabicValidationReport {
  const issues: string[] = [];
  const trimmed = input.trim();
  if (trimmed.length === 0) issues.push('empty input');
  if (!containsArabic(trimmed)) issues.push('no Arabic characters present');
  if (LATIN.test(trimmed)) issues.push('mixed Latin characters inside Arabic text');
  if (/[‎]/.test(trimmed)) issues.push('LTR override mark present — breaks RTL rendering');

  const letters = [...trimmed].filter((c) => isArabicLetter(c));
  const dotted = letters.filter((c) => DOTTED.has(c)).length;
  const words = trimmed.split(/\s+/).filter(Boolean);

  return {
    input: trimmed,
    valid: issues.length === 0,
    isRtl: containsArabic(trimmed) && !LATIN.test(trimmed),
    letterCount: letters.length,
    dotBearingLetters: dotted,
    hasDiacritics: DIACRITICS.test(trimmed),
    hasHamza: HAMZA_FORMS.test(trimmed),
    words,
    connectivity: computeConnectivity(trimmed),
    issues,
  };
}

/**
 * Exact-preservation check (rule 52.9): a derived rendering/artwork text must
 * preserve letters, dots, hamza, word order and (when present) diacritics of
 * the customer-approved input. Returns list of violations (empty = exact).
 */
export function compareExactText(approved: string, derived: string): string[] {
  const violations: string[] = [];
  const a = approved.trim();
  const d = derived.trim();
  if (a === d) return violations;

  const aReport = validateArabicText(a);
  const dReport = validateArabicText(d);

  if (stripDiacritics(a) !== stripDiacritics(d)) violations.push('letter sequence altered');
  if (aReport.hasDiacritics && a !== d) violations.push('diacritics altered or dropped');
  if (aReport.dotBearingLetters !== dReport.dotBearingLetters) violations.push('dot-bearing letters changed');
  if (aReport.hasHamza !== dReport.hasHamza) violations.push('hamza altered');
  if (aReport.words.length !== dReport.words.length) violations.push('word order/count changed');
  if (violations.length === 0) violations.push('text differs from approved spelling');
  return violations;
}
