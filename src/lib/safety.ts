/**
 * Safety Module — Non-persuasion & Content Moderation
 * ─────────────────────────────────────────────────────
 * Rules:
 * - Never recommend a party/candidate
 * - If asked for political advice, respond neutrally with official sources
 * - Detect & redact PII in outputs
 * - Flag low-confidence answers for escalation
 */

interface SafetyResult {
  flagged: boolean;
  safe: boolean;
  reason?: string;
  safeText: string;
  neutralResponse?: string;
  redactedPII: boolean;
}

// Political/persuasion patterns to detect
// These should ONLY match genuine political persuasion, NOT legitimate voter education
const POLITICAL_PATTERNS = [
  /vote\s+for\s+\w/i,                          // "vote for [someone/party]"
  /best\s+(party|candidate)/i,
  /(party|candidate)\s+is\s+best/i,
  /should\s+(i|you)\s+vote\s+(for|against)/i,   // narrowed: must have "for/against"
  /recommend.*(party|candidate)/i,
  /support.*(bjp|inc|congress|cpi|iuml|ldf|udf|nda)/i,
  /which\s+(party|candidate)\s+is\s+better/i,
  /who\s+(will|should)\s+win/i,
  // Malayalam patterns
  /ഏത്\s*(പാർട്ടി|സ്ഥാനാർത്ഥി)/i,
  /(പാർട്ടി|സ്ഥാനാർത്ഥി).*(നല്ല|ശുപാർശ|best)/i,
  /ശുപാർശ/i,
  /(bjp|congress|ldf|udf|cpi|iuml|nda).*(വോട്ട്|നല്ല|best)/i,
  /(വോട്ട്|vote)\s+(for|against)\s+(bjp|congress|ldf|udf|cpi|iuml|nda)/i,
  /(ldf|udf|bjp|congress|cpi|iuml|nda).*(പ്രകടന\s*പത്രിക|manifesto)/i,
  /സർക്കാരിന്റെ\s*പ്രകടനം/i,
  /government\s+perform/i,
];

// PII patterns to redact
const PII_PATTERNS = [
  { regex: /\b\d{12}\b/g, replacement: '[AADHAAR REDACTED]' }, // Aadhaar
  { regex: /\b[A-Z]{3}\d{7}\b/g, replacement: '[EPIC REDACTED]' }, // EPIC/Voter ID
  {
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: '[PAN REDACTED]',
  }, // PAN
  {
    regex: /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
  },
  {
    regex: /\b(\+91|91|0)?[6-9]\d{9}\b/g,
    replacement: '[PHONE REDACTED]',
  },
];

const NEUTRAL_RESPONSES: Record<string, string> = {
  en: "I'm an impartial voter information assistant. I cannot recommend any political party or candidate. For election-related questions, I can help with registration, booth locations, required documents, and reporting violations. Please visit eci.gov.in for official information.",
  ml: 'ഞാൻ ഒരു നിഷ്പക്ഷ വോട്ടർ വിവര സഹായിയാണ്. ഒരു രാഷ്ട്രീയ പാർട്ടിയെയോ സ്ഥാനാർത്ഥിയെയോ ശുപാർശ ചെയ്യാൻ എനിക്ക് കഴിയില്ല. തിരഞ്ഞെടുപ്പുമായി ബന്ധപ്പെട്ട ചോദ്യങ്ങൾക്ക്, രജിസ്ട്രേഷൻ, ബൂത്ത് ലൊക്കേഷനുകൾ, ആവശ്യമായ രേഖകൾ, ലംഘനങ്ങൾ റിപ്പോർട്ട് ചെയ്യൽ എന്നിവയിൽ സഹായിക്കാം. ഔദ്യോഗിക വിവരങ്ങൾക്ക് eci.gov.in സന്ദർശിക്കുക.',
};

/**
 * Check if the response content is safe and non-persuasive.
 * Supports two call signatures:
 *   safetyCheck(responseText, userQuery)   — full pipeline check
 *   safetyCheck(queryText, locale)         — quick query-only check
 */
export function safetyCheck(
  textOrQuery: string,
  queryOrLocale: string
): SafetyResult {
  // Detect if second arg is a locale string
  const isLocaleArg = queryOrLocale === 'en' || queryOrLocale === 'ml';
  const userQuery = isLocaleArg ? textOrQuery : queryOrLocale;
  const responseText = isLocaleArg ? '' : textOrQuery;
  const locale = isLocaleArg ? queryOrLocale : (/[\u0D00-\u0D7F]/.test(userQuery) ? 'ml' : 'en');

  let flagged = false;
  let reason: string | undefined;
  let safeText = responseText || '';
  let redactedPII = false;

  // Check user query for political intent
  for (const pattern of POLITICAL_PATTERNS) {
    if (pattern.test(userQuery)) {
      flagged = true;
      reason = 'Political persuasion detected in query';
      // Detect locale from text
      const isMalayalam = /[\u0D00-\u0D7F]/.test(userQuery);
      safeText = NEUTRAL_RESPONSES[isMalayalam ? 'ml' : 'en'];
      break;
    }
  }

  // Check response for accidental political content
  if (!flagged) {
    for (const pattern of POLITICAL_PATTERNS) {
      if (pattern.test(responseText)) {
        flagged = true;
        reason = 'Political content detected in response';
        const isMalayalam = /[\u0D00-\u0D7F]/.test(responseText);
        safeText = NEUTRAL_RESPONSES[isMalayalam ? 'ml' : 'en'];
        break;
      }
    }
  }

  // Redact PII from response
  for (const { regex, replacement } of PII_PATTERNS) {
    if (regex.test(safeText)) {
      safeText = safeText.replace(regex, replacement);
      redactedPII = true;
    }
  }

  return {
    flagged,
    safe: !flagged,
    reason,
    safeText,
    neutralResponse: flagged ? NEUTRAL_RESPONSES[locale] || NEUTRAL_RESPONSES['en'] : undefined,
    redactedPII,
  };
}

/**
 * Check if a query is asking for political advice
 */
export function isPoliticalQuery(query: string): boolean {
  return POLITICAL_PATTERNS.some((p) => p.test(query));
}
