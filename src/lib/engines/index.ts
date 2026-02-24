/**
 * V5 Intelligence Engines — Barrel Export
 * ────────────────────────────────────────
 * Central re-export for all civic intelligence modules.
 */

export { classifyQuery } from './query-classifier';
export type { ClassificationResult } from './query-classifier';

export { getFormGuidance, getAllFormsSummary, recommendForm, getDocumentChecklist } from './civic-process';
export type { FormRecommendation, FormGuidanceResult } from './civic-process';

export { getVotingRulesResponse } from './voting-rules';
export type { VotingRulesResult } from './voting-rules';

export { getComplaintResponse } from './complaint';
export type { ComplaintResult } from './complaint';

export { getTimelineResponse } from './timeline';
export type { TimelineResult } from './timeline';
