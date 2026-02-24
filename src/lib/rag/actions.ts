/**
 * Actions Extractor — Determine suggested next actions from query/response
 */
import { v4 as uuid } from 'uuid';
import type { ActionItem } from '@/types';

const ACTION_PATTERNS: {
  regex: RegExp;
  action: ActionItem['action'];
  labelEn: string;
  labelMl: string;
  icon: string;
}[] = [
  {
    regex: /register|registration|form\s*6|enroll|രജിസ്/i,
    action: 'check_epic',
    labelEn: 'Check Registration',
    labelMl: 'രജിസ്ട്രേഷൻ പരിശോധിക്കുക',
    icon: 'IdentificationIcon',
  },
  {
    regex: /booth|polling\s*station|where.*vote|ബൂത്ത്|പോളിംഗ്/i,
    action: 'locate_booth',
    labelEn: 'Find Polling Booth',
    labelMl: 'പോളിംഗ് ബൂത്ത് കണ്ടെത്തുക',
    icon: 'MapPinIcon',
  },
  {
    regex: /violation|report|complaint|bribery|intimidat|ലംഘന|റിപ്പോർട്ട്/i,
    action: 'report_violation',
    labelEn: 'Report Violation',
    labelMl: 'ലംഘനം റിപ്പോർട്ട് ചെയ്യുക',
    icon: 'ExclamationTriangleIcon',
  },
  {
    regex: /faq|question|help|സഹായ|ചോദ്യ/i,
    action: 'faq',
    labelEn: 'View FAQ',
    labelMl: 'FAQ കാണുക',
    icon: 'QuestionMarkCircleIcon',
  },
];

export function extractActions(
  query: string,
  responseText: string,
  _locale: string
): ActionItem[] {
  const combined = `${query} ${responseText}`;
  const matched: ActionItem[] = [];
  const seenActions = new Set<string>();

  for (const pattern of ACTION_PATTERNS) {
    if (pattern.regex.test(combined) && !seenActions.has(pattern.action)) {
      seenActions.add(pattern.action);
      matched.push({
        id: uuid(),
        label: pattern.labelEn,
        labelMl: pattern.labelMl,
        icon: pattern.icon,
        action: pattern.action,
      });
    }
  }

  return matched.slice(0, 3); // max 3 actions
}
