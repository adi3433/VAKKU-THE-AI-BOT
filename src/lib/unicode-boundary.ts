/**
 * Unicode-aware Word Boundary Helpers
 * ─────────────────────────────────────
 * JavaScript's \b word boundary only considers ASCII \w characters.
 * Malayalam Unicode characters (U+0D00–U+0D7F) are classified as \W,
 * so \b never matches at the edge of a Malayalam word.
 *
 * These helpers provide Unicode-compatible word boundary matching.
 */

/**
 * Boundary pattern that works for both ASCII and Malayalam text.
 * Matches at: start of string, whitespace, punctuation, or zero-width chars.
 */
const UB_LEFT = '(?:^|(?<=[\\s.,;:!?()\\u200B-\\u200D\\u00A0—\\-]))';
const UB_RIGHT = '(?=[\\s.,;:!?()\\u200B-\\u200D\\u00A0—\\-]|$)';

/**
 * Create a Unicode-aware word-boundary regex from a pattern string.
 * Replaces leading/trailing \b in patterns containing Malayalam chars
 * with Unicode-compatible boundary assertions.
 *
 * @param pattern - Regex source string (without delimiters)
 * @param flags - Regex flags (default: 'i')
 * @returns RegExp with Unicode-compatible boundaries
 *
 * @example
 * // Instead of: /\b(booth|ബൂത്ത്)\b/i
 * ubRegex('(booth|ബൂത്ത്)')
 */
export function ubRegex(pattern: string, flags: string = 'i'): RegExp {
  return new RegExp(`${UB_LEFT}${pattern}${UB_RIGHT}`, flags);
}

/**
 * Create a simple "contains" regex for Malayalam text.
 * No word boundaries — just checks if the text is present.
 * Useful when the Malayalam keywords are unambiguous enough
 * that boundary matching is unnecessary.
 *
 * @param pattern - Regex source string
 * @param flags - Regex flags (default: 'i')
 */
export function mlRegex(pattern: string, flags: string = 'i'): RegExp {
  return new RegExp(pattern, flags);
}
