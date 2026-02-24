/**
 * V5 Election Timeline Engine
 * ────────────────────────────
 * Data Source: election_timeline.json
 *
 * Capabilities:
 *   - Poll date query
 *   - Nomination/scrutiny/withdrawal/counting dates
 *   - Model Code of Conduct status
 *   - Kottayam constituency list
 *   - Deadline-aware reasoning
 *   - Clearly states "TBA" when dates not announced
 *
 * CRITICAL: Never use 2021 reference dates as 2026 dates.
 * CRITICAL: Never assume dates — state limitation clearly.
 */

import timelineData from '@/data/election_timeline.json';

// ── Types ────────────────────────────────────────────────────────

export interface TimelineResult {
  subIntent: string;
  formattedResponse: string;
  confidence: number;
  datesAnnounced: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function isDateAnnounced(): boolean {
  return timelineData.announcement.status !== 'PENDING_OFFICIAL_ANNOUNCEMENT';
}

function formatDate(dateStr: string): string {
  if (dateStr === 'TBA') return '📅 TBA (To Be Announced)';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getTbaNotice(locale: string): string {
  return locale === 'ml'
    ? '⚠️ _ഔദ്യോഗിക തീയതികൾ ECI ഇതുവരെ പ്രഖ്യാപിച്ചിട്ടില്ല. ഏറ്റവും പുതിയ വിവരങ്ങൾക്കായി [eci.gov.in](https://www.eci.gov.in) അല്ലെങ്കിൽ [CEO Kerala](https://www.ceo.kerala.gov.in) സന്ദർശിക്കുക._'
    : '⚠️ _Official dates have not yet been announced by the Election Commission of India. Visit [eci.gov.in](https://www.eci.gov.in) or [CEO Kerala](https://www.ceo.kerala.gov.in) for the latest updates._';
}

// ── Engine functions ─────────────────────────────────────────────

/**
 * Get poll date information
 */
function getPollDate(locale: string): string {
  const isMl = locale === 'ml';
  const pollDate = timelineData.key_dates.poll_date;

  let response = isMl
    ? `🗳️ **വോട്ടെടുപ്പ് തീയതി — Kerala Assembly Election 2026**\n\n`
    : `🗳️ **Poll Date — Kerala Legislative Assembly Election 2026**\n\n`;

  response += `**${pollDate.label}:** ${formatDate(pollDate.date)}\n`;
  if (pollDate.date !== 'TBA') {
    response += `- Polling hours: ${pollDate.poll_time_start} to ${pollDate.poll_time_end}\n`;
    response += `- ${pollDate.description}\n`;
  } else {
    response += `\n${getTbaNotice(locale)}`;
    response += `\n\n${isMl ? 'പ്രതീക്ഷിത പ്രഖ്യാപന കാലാവധി' : 'Expected announcement window'}: **${timelineData.announcement.expected_window}**`;
  }

  return response;
}

/**
 * Get all key dates
 */
function getAllDates(locale: string): string {
  const isMl = locale === 'ml';
  const dates = timelineData.key_dates;

  let response = isMl
    ? `📅 **2026 കേരള നിയമസഭാ തിരഞ്ഞെടുപ്പ് — പ്രധാന തീയതികൾ**\n\n`
    : `📅 **2026 Kerala Assembly Election — Key Dates**\n\n`;

  const dateEntries = [
    dates.election_notification_date,
    dates.last_date_of_nomination,
    dates.scrutiny_of_nominations,
    dates.last_date_of_withdrawal,
    dates.poll_date,
    dates.counting_date,
    dates.completion_date,
  ];

  for (const entry of dateEntries) {
    const status = entry.date === 'TBA' ? '⏳' : '✅';
    response += `${status} **${entry.label}:** ${formatDate(entry.date)}\n`;
    response += `  _${entry.description}_\n\n`;
  }

  if (!isDateAnnounced()) {
    response += '\n' + getTbaNotice(locale);
  }

  return response;
}

/**
 * Get Model Code of Conduct status
 */
function getMccStatus(locale: string): string {
  const isMl = locale === 'ml';
  const mcc = timelineData.model_code_of_conduct;

  let response = isMl
    ? `⚖️ **മാതൃകാ പെരുമാറ്റ ചട്ടം (MCC)**\n\n`
    : `⚖️ **Model Code of Conduct (MCC)**\n\n`;

  response += `**Status:** ${mcc.status === 'NOT_IN_EFFECT' ? '🔴 Not in effect' : '🟢 In effect'}\n\n`;
  response += `${mcc.description}\n\n`;
  response += `- **Comes into effect:** ${formatDate(mcc.comes_into_effect)}\n`;
  response += `- **Lifted on:** ${formatDate(mcc.lifted_on)}\n`;

  if (!isDateAnnounced()) {
    response += '\n\n' + getTbaNotice(locale);
  }

  return response;
}

/**
 * Get Kottayam constituency list
 */
function getConstituencies(locale: string): string {
  const isMl = locale === 'ml';
  const data = timelineData.assembly_constituencies_kottayam;

  let response = isMl
    ? `🗺️ **കോട്ടയം ജില്ല — നിയമസഭാ മണ്ഡലങ്ങൾ**\n\n`
    : `🗺️ **Kottayam District — Assembly Constituencies**\n\n`;

  for (const c of data.constituencies) {
    response += `- **${c.no}.** ${c.name}\n`;
  }

  response += `\n**${isMl ? 'ആകെ മണ്ഡലങ്ങൾ' : 'Total Constituencies'}:** ${data.total_constituencies}`;
  response += `\n_${data.note}_`;

  return response;
}

/**
 * Get voter service deadlines
 */
function getDeadlines(locale: string): string {
  const isMl = locale === 'ml';
  const deadlines = timelineData.voter_service_deadlines;

  let response = isMl
    ? `📋 **വോട്ടർ സേവന അവസാന തീയതികൾ**\n\n`
    : `📋 **Voter Service Deadlines**\n\n`;

  const entries = [
    deadlines.form_6_new_registration,
    deadlines.form_8_corrections,
    deadlines.form_7_deletion_objection,
    deadlines.postal_ballot_application,
  ];

  for (const entry of entries) {
    const status = entry.deadline === 'TBA' ? '⏳' : (entry.deadline === 'Closed' ? '🔴' : '🟢');
    response += `${status} **${entry.label}:** ${entry.deadline === 'TBA' ? 'TBA' : entry.deadline}\n`;
    response += `  _${entry.reference}_\n\n`;
  }

  response += `_${deadlines.note}_\n`;

  if (!isDateAnnounced()) {
    response += '\n' + getTbaNotice(locale);
  }

  return response;
}

/**
 * Get specific date type
 */
function getSpecificDate(dateKey: string, locale: string): string {
  const dateMap: Record<string, keyof typeof timelineData.key_dates> = {
    nomination_date: 'last_date_of_nomination',
    scrutiny_date: 'scrutiny_of_nominations',
    withdrawal_date: 'last_date_of_withdrawal',
    counting_date: 'counting_date',
    poll_date: 'poll_date',
  };

  const key = dateMap[dateKey];
  if (!key) return getAllDates(locale);

  const entry = timelineData.key_dates[key];

  let response = `📅 **${entry.label}:** ${formatDate(entry.date)}\n\n`;
  response += `${entry.description}\n`;

  if (entry.date === 'TBA') {
    response += '\n' + getTbaNotice(locale);
  }

  return response;
}

/**
 * Main entry point — route sub-intent to correct handler
 */
export function getTimelineResponse(subIntent?: string, query?: string, locale: string = 'en'): TimelineResult {
  // Auto-detect sub-intent from query
  if (!subIntent && query) {
    const lq = query.toLowerCase();
    if (/\b(poll|voting|election)\s*date\b/i.test(lq)) subIntent = 'poll_date';
    else if (/\b(nomination)\b/i.test(lq)) subIntent = 'nomination_date';
    else if (/\b(scrutiny)\b/i.test(lq)) subIntent = 'scrutiny_date';
    else if (/\b(withdrawal)\b/i.test(lq)) subIntent = 'withdrawal_date';
    else if (/\b(counting|result)\b/i.test(lq)) subIntent = 'counting_date';
    else if (/\b(mcc|model\s*code|code\s*of\s*conduct)\b/i.test(lq)) subIntent = 'mcc';
    else if (/\b(constituency|constituencies|lac)\b/i.test(lq)) subIntent = 'constituencies';
    else if (/\b(deadline|last\s*date)\b/i.test(lq)) subIntent = 'deadlines';
    else if (/\b(schedule|timeline|key\s*date|all\s*date)\b/i.test(lq)) subIntent = 'all_dates';
  }

  const handlers: Record<string, (l: string) => string> = {
    poll_date: getPollDate,
    all_dates: getAllDates,
    mcc: getMccStatus,
    constituencies: getConstituencies,
    deadlines: getDeadlines,
    nomination_date: (l) => getSpecificDate('nomination_date', l),
    scrutiny_date: (l) => getSpecificDate('scrutiny_date', l),
    withdrawal_date: (l) => getSpecificDate('withdrawal_date', l),
    counting_date: (l) => getSpecificDate('counting_date', l),
  };

  if (subIntent && handlers[subIntent]) {
    return {
      subIntent,
      formattedResponse: handlers[subIntent](locale),
      confidence: 0.95,
      datesAnnounced: isDateAnnounced(),
    };
  }

  // Default: all key dates + constituencies
  let response = getAllDates(locale);
  response += '\n\n---\n\n';
  response += getConstituencies(locale);
  response += `\n\n📞 ${locale === 'ml' ? 'ഹെൽപ്‌ലൈൻ' : 'Helpline'}: **1950** | [eci.gov.in](https://www.eci.gov.in) | [CEO Kerala](https://www.ceo.kerala.gov.in)`;

  return {
    subIntent: 'overview',
    formattedResponse: response,
    confidence: 0.90,
    datesAnnounced: isDateAnnounced(),
  };
}
