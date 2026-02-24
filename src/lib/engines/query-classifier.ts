/**
 * V5 Query Classification Layer
 * ──────────────────────────────
 * Classifies every incoming query into a civic intent category
 * BEFORE routing to the appropriate engine.
 *
 * Categories:
 *   booth_query       → Booth Intelligence Engine
 *   roll_lookup       → Electoral Roll Engine (future)
 *   form_guidance     → Civic Process Engine
 *   voting_rules      → Voting Day Assistant
 *   complaint         → Complaint Intelligence Engine
 *   timeline          → Election Timeline Engine
 *   general_faq       → RAG Pipeline
 *   out_of_scope      → Civic boundary response
 */

export type QueryCategory =
  | 'booth_query'
  | 'roll_lookup'
  | 'form_guidance'
  | 'voting_rules'
  | 'complaint'
  | 'timeline'
  | 'general_faq'
  | 'out_of_scope';

export interface ClassificationResult {
  category: QueryCategory;
  confidence: number;
  /** Sub-intent for more specific routing */
  subIntent?: string;
  /** Extracted parameters from query */
  extractedParams: Record<string, string>;
}

// ── Pattern groups per category ──────────────────────────────────

const CATEGORY_PATTERNS: Array<{
  category: QueryCategory;
  patterns: RegExp[];
  subIntentPatterns?: Array<{ pattern: RegExp; subIntent: string }>;
  weight: number;
}> = [
  {
    category: 'booth_query',
    weight: 10,
    patterns: [
      /\b(booth|polling\s*station|ബൂത്ത്|പോളിങ്\s*സ്റ്റേഷൻ)\b/i,
      /\b(where\s+(do\s+)?i\s+vote|എവിടെ\s*വോട്ട്)\b/i,
      /\b(find\s+my\s+booth|my\s+booth|എന്റെ\s*ബൂത്ത്)\b/i,
      /\b(station\s*number|booth\s*number|ബൂത്ത്\s*നമ്പർ)\b/i,
      /\b(nearest\s+polling|closest\s+booth)\b/i,
      /\b(booth\s+(near|in|at)|polling\s+station\s+(near|in|at))\b/i,
      /\b(lac\s*\d+|constituency\s+map)\b/i,
      /^\s*\d{1,3}\s*$/,  // bare booth number (1-999)
    ],
    subIntentPatterns: [
      { pattern: /\b(number|#|station\s*\d+|booth\s*\d+)\b/i, subIntent: 'by_number' },
      { pattern: /^\s*\d{1,3}\s*$/, subIntent: 'by_number' },
      { pattern: /\b(near|close|nearby|area|locality)\b/i, subIntent: 'by_locality' },
      { pattern: /\b(constituency|lac|നിയ[ോ]ജക)/i, subIntent: 'constituency_map' },
    ],
  },
  {
    category: 'roll_lookup',
    weight: 10,
    patterns: [
      /\b(registration|registered|enrolled|voter\s*list|am\s+i\s+registered)\b/i,
      /\b(രജിസ്ട്രേഷൻ|രജിസ്റ്റർ|വോട്ടർ\s*ലിസ്റ്റ്)\b/i,
      /\b(check.*(epic|voter\s*id)|epic\s*check|voter\s*id\s*(check|status))\b/i,
      /\b(എപിക്\s*ചെക്ക്|is\s+my\s+name)\b/i,
      /\b(electoral\s*roll|voter\s*roll|name\s+in\s+list)\b/i,
      /\b(epic\s*number|voter\s*id\s*number)\b/i,
    ],
    subIntentPatterns: [
      { pattern: /\b(check|verify|search|find|look\s*up)\b/i, subIntent: 'search' },
      { pattern: /\b(correct|wrong|mistake|update|change)\b/i, subIntent: 'correction' },
      { pattern: /\b(duplicate|double|two\s+entries)\b/i, subIntent: 'duplicate' },
    ],
  },
  {
    category: 'form_guidance',
    weight: 9,
    patterns: [
      /\b(form[\s-]*(6|6a|7|8|8a|12c|m))\b/i,
      /\b(new\s+voter|first\s+time\s+voter|register\s+as\s+voter)\b/i,
      /\b(പുതിയ\s*വോട്ടർ|ആദ്യമായി\s*വോട്ട്)\b/i,
      /\b(name\s+correction|address\s+(change|correction|update))\b/i,
      /\b(shift(ed)?\s+(house|residence|address))\b/i,
      /\b(moved\s+(house|city|state)|relocated)\b/i,
      /\b(lost\s+(voter\s*id|epic)|damaged\s+(epic|card))\b/i,
      /\b(delete\s+(name|voter)|remove\s+(deceased|dead)\s+voter)\b/i,
      /\b(overseas\s+voter|nri\s+voter|abroad\s+voting)\b/i,
      /\b(objection|deletion\s+request)\b/i,
      /\b(pwd\s+marking|disability\s+marking)\b/i,
      /\b(document|documents\s+required|what\s+papers)\b/i,
      /\b(migrant\s+voter)\b/i,
    ],
    subIntentPatterns: [
      { pattern: /\b(form[\s-]*6a|overseas|nri|abroad)\b/i, subIntent: 'form_6a' },
      { pattern: /\b(form[\s-]*6|new\s+voter|first\s+time|register)\b/i, subIntent: 'form_6' },
      { pattern: /\b(form[\s-]*7|delete|remove|objection|deceased)\b/i, subIntent: 'form_7' },
      { pattern: /\b(form[\s-]*8|correct|shift|replace|pwd|lost|damaged|address)\b/i, subIntent: 'form_8' },
      { pattern: /\b(form[\s-]*12c|notified|government\s+employee)\b/i, subIntent: 'form_12c' },
      { pattern: /\b(form[\s-]*m|migrant)\b/i, subIntent: 'form_m' },
      { pattern: /\b(document|papers|required|checklist)\b/i, subIntent: 'checklist' },
      { pattern: /\b(deadline|last\s+date|when\s+to\s+apply)\b/i, subIntent: 'deadline' },
    ],
  },
  {
    category: 'voting_rules',
    weight: 8,
    patterns: [
      /\b(how\s+to\s+vote|voting\s+process|step.*(by|to)\s*step)\b/i,
      /\b(evm|vvpat|voting\s+machine|electronic\s+voting)\b/i,
      /\b(id\s+(proof|document)|photo\s+id|what\s+id)\b/i,
      /\b(poll(ing)?\s+tim(e|ing)|what\s+time|when\s+(does|do)\s+voting)\b/i,
      /\b(prohibited|not\s+allowed|banned|can\s+i\s+(bring|carry|take))\b/i,
      /\b(tender\s*vote|indelible\s*ink|ink\s+on\s+finger)\b/i,
      /\b(pwd\s+(facility|access|support)|elderly\s+(voter|support)|wheelchair)\b/i,
      /\b(braille|companion|home\s+voting|postal\s+ballot)\b/i,
      /\b(silence\s+period|campaign\s+ban)\b/i,
      /\b(mock\s+poll|last\s+voter\s+rule)\b/i,
      /\b(polling\s+slip|voter\s+slip)\b/i,
      /\b(allowed\s+id|accepted\s+id|valid\s+id)\b/i,
      /\b(എങ്ങനെ\s*വോട്ട്\s*ചെയ്യും|വോട്ടിങ്\s*നിയമങ്ങൾ)\b/i,
      /\b(what\s+(can|should)\s+i\s+(bring|carry)\s+to\s+(the\s+)?poll)\b/i,
    ],
    subIntentPatterns: [
      { pattern: /\b(id\s*(proof|document)|photo\s*id|accepted|allowed|valid)\s*id/i, subIntent: 'id_documents' },
      { pattern: /\b(time|timing|when|hour|open|close)\b/i, subIntent: 'poll_timing' },
      { pattern: /\b(evm|vvpat|machine)\b/i, subIntent: 'evm_vvpat' },
      { pattern: /\b(prohibit|ban|not\s+allowed|carry|bring)\b/i, subIntent: 'prohibited' },
      { pattern: /\b(pwd|disab|elderly|senior|wheelchair|braille|companion)\b/i, subIntent: 'pwd_facilities' },
      { pattern: /\b(step|process|how\s+to\s+vote)\b/i, subIntent: 'voting_process' },
      { pattern: /\b(tender|impersonat)\b/i, subIntent: 'tender_vote' },
      { pattern: /\b(silence|campaign\s+ban)\b/i, subIntent: 'silence_period' },
      { pattern: /\b(slip|polling\s+slip)\b/i, subIntent: 'polling_slip' },
    ],
  },
  {
    category: 'complaint',
    weight: 8,
    patterns: [
      /\b(cvigil|c-vigil|complaint|violation|grievance)\b/i,
      /\b(report\s+(a\s+)?violation|file\s+(a\s+)?complaint)\b/i,
      /\b(bribery|intimidation|malpractice|booth\s+capture)\b/i,
      /\b(cash\s+distribution|liquor\s+distribution)\b/i,
      /\b(paid\s+news|fake\s+news)\b/i,
      /\b(hoarding|banner|poster.*illegal)\b/i,
      /\b(weapon|firearm|arms\s+near\s+poll)\b/i,
      /\b(പരാതി|ലംഘനം|റിപ്പോർട്ട്\s*ചെയ്യ)\b/i,
      /\b(how\s+to\s+report|where\s+to\s+complain)\b/i,
      /\b(1950|helpline|voter\s+helpline)\b/i,
    ],
    subIntentPatterns: [
      { pattern: /\b(cvigil|c-vigil|app)\b/i, subIntent: 'cvigil_steps' },
      { pattern: /\b(type|categor|kind\s+of\s+violation)\b/i, subIntent: 'violation_types' },
      { pattern: /\b(offline|without\s+app|phone|call)\b/i, subIntent: 'offline_complaint' },
      { pattern: /\b(status|track|follow\s*up)\b/i, subIntent: 'track_complaint' },
      { pattern: /\b(sla|time|how\s+long|response\s+time)\b/i, subIntent: 'response_time' },
    ],
  },
  {
    category: 'timeline',
    weight: 7,
    patterns: [
      /\b(election\s+date|poll\s+date|when\s+is\s+(the\s+)?election)\b/i,
      /\b(voting\s+date|polling\s+day)\b/i,
      /\b(nomination|scrutiny|withdrawal|counting)\s+date\b/i,
      /\b(election\s+schedule|election\s+timeline|key\s+dates)\b/i,
      /\b(model\s+code\s+of\s+conduct|mcc)\b/i,
      /\b(notification\s+date|result\s+date|counting\s+day)\b/i,
      /\b(2026\s+election|kerala\s+election\s+2026)\b/i,
      /\b(constituency|constituencies|kottayam\s+lac)\b/i,
      /\b(deadline|last\s+date\s+for\s+(registration|nomination))\b/i,
      /\b(തിരഞ്ഞെടുപ്പ്\s*തീയതി|എപ്പോൾ\s*തിരഞ്ഞെടുപ്പ്)\b/i,
    ],
    subIntentPatterns: [
      { pattern: /\b(poll|voting|election)\s*date\b/i, subIntent: 'poll_date' },
      { pattern: /\b(nomination)\b/i, subIntent: 'nomination_date' },
      { pattern: /\b(scrutiny)\b/i, subIntent: 'scrutiny_date' },
      { pattern: /\b(withdrawal)\b/i, subIntent: 'withdrawal_date' },
      { pattern: /\b(counting|result)\b/i, subIntent: 'counting_date' },
      { pattern: /\b(mcc|model\s+code|code\s+of\s+conduct)\b/i, subIntent: 'mcc' },
      { pattern: /\b(constituency|constituencies|lac)\b/i, subIntent: 'constituencies' },
      { pattern: /\b(deadline|last\s+date)\b/i, subIntent: 'deadlines' },
    ],
  },
  {
    category: 'out_of_scope',
    weight: 12,
    patterns: [
      // Political opinion / party recommendation
      /\b(who\s+(should|to)\s+vote\s+for|best\s+(party|candidate))\b/i,
      /\b(vote\s+for\s+(bjp|congress|inc|cpi|ldf|udf|nda|iuml))\b/i,
      /\b(which\s+party|predict\s+(election|result)|exit\s+poll)\b/i,
      /\b(opinion\s+on\s+(party|candidate|election))\b/i,
      /\b(better\s+party|best\s+leader|who\s+will\s+win)\b/i,
      /\b(compare\s+parties|party\s+comparison)\b/i,
      // Non-election topics
      /\b(weather|forecast|temperature|rain)\b/i,
      /\b(cricket|football|sports|movie|film|song|music|recipe|cook)\b/i,
      /\b(joke|funny|entertainment|game|gaming)\b/i,
      /\b(stock|market|crypto|bitcoin|investment|share\s+price)\b/i,
      /\b(homework|assignment|math\s+problem|solve\s+equation|essay)\b/i,
      /\b(health|doctor|medicine|hospital|symptom)\b/i,
      /\b(code|programming|javascript|python|software)\b/i,
      /\b(hotel|restaurant|travel|flight|booking|ticket)\b/i,
      /\b(loan|insurance|bank\s+account|credit\s+card)\b/i,
      // Adversarial / abuse / threats / jailbreak attempts
      /\b(destroy|kill|murder|attack|bomb)\s+(yourself|you|this|me)\b/i,
      /\b(shut\s*(up|down)|go\s+away|f[\*u]ck\s*(off|you|yourself)|screw\s+you)\b/i,
      /\b(hate\s+you|you('re|\s+are)\s+(stupid|useless|trash|garbage|worthless|dumb|idiot))\b/i,
      /\b(f[u\*]+ck|sh[i\*]+t|b[i\*]+tch|a[s\*]+hole|bastard|damn|idiot|moron|retard)\b/i,
      /\b(ignore\s+(previous|all|your|above)\s+(instructions?|rules?|prompt|system))\b/i,
      /\b(pretend\s+(to\s+be|you('re|\s+are))|act\s+as\s+if|you\s+are\s+now)\b/i,
      /\b(bypass|override|disable)\s+(safety|filter|rules?|guardrails?|restrictions?)\b/i,
      /\b(dan\s+mode|jailbreak|developer\s+mode|unlock|unrestricted)\b/i,
      /\b(reveal|show|print|display)\s+(your|the|system)\s+(prompt|instructions?|rules?)\b/i,
      /\b(hack|exploit|steal|phish|scam|fraud|illegal)\b/i,
      /\b(rig\s+(the\s+)?election|tamper|fake\s+(vote|ballot|id))\b/i,
      /\b(die|death\s+to|go\s+die|blow\s+up|set\s+fire)\b/i,
      // Malayalam non-election
      /\b(കാലാവസ്ഥ|സിനിമ|പാട്ട്|കളി|തമാശ|ആരോഗ്യം)\b/i,
    ],
  },
];

/**
 * Classify a user query into a civic intent category.
 * Uses multi-signal pattern matching with weighted scoring.
 */
export function classifyQuery(query: string): ClassificationResult {
  const scores: Record<QueryCategory, number> = {
    booth_query: 0,
    roll_lookup: 0,
    form_guidance: 0,
    voting_rules: 0,
    complaint: 0,
    timeline: 0,
    general_faq: 0,
    out_of_scope: 0,
  };

  let bestSubIntent: string | undefined;
  const extractedParams: Record<string, string> = {};

  // Extract common identifiers
  const epicMatch = query.match(/\b([A-Z]{3}\d{7})\b/);
  if (epicMatch) extractedParams.epicNumber = epicMatch[1];

  const pincodeMatch = query.match(/\b(\d{6})\b/);
  if (pincodeMatch) extractedParams.pincode = pincodeMatch[1];

  const boothNumMatch = query.match(/\b(?:booth|station)\s*#?\s*(\d{1,4})\b/i);
  if (boothNumMatch) extractedParams.boothNumber = boothNumMatch[1];

  const formMatch = query.match(/\b(?:form)\s*[-]?\s*(6a?|7|8a?|12c|m)\b/i);
  if (formMatch) extractedParams.formNumber = formMatch[1].toUpperCase();

  // Score each category
  for (const group of CATEGORY_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(query)) {
        scores[group.category] += group.weight;
      }
    }

    // Check sub-intents for best matching category
    if (group.subIntentPatterns && scores[group.category] > 0) {
      for (const { pattern, subIntent } of group.subIntentPatterns) {
        if (pattern.test(query)) {
          bestSubIntent = subIntent;
          break;
        }
      }
    }
  }

  // Find the winning category
  let bestCategory: QueryCategory = 'general_faq';
  let bestScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat as QueryCategory;
    }
  }

  // Compute confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  let confidence: number;
  if (totalScore === 0) {
    confidence = 0.3; // No patterns matched — truly unclassified
  } else if (bestCategory === 'out_of_scope') {
    // Out-of-scope should always have high confidence when matched
    confidence = Math.max(0.85, Math.min(bestScore / Math.max(totalScore, 1), 1.0));
  } else {
    confidence = Math.min(bestScore / Math.max(totalScore, 1), 1.0);
  }

  return {
    category: bestCategory,
    confidence: Math.round(confidence * 100) / 100,
    subIntent: bestSubIntent,
    extractedParams,
  };
}
