/**
 * Actions extractor unit tests
 */
import { describe, it, expect } from 'vitest';
import { extractActions } from '@/lib/rag/actions';

describe('Action Extraction', () => {
  it('extracts registration action from query', () => {
    const actions = extractActions('How do I register to vote?', 'Visit NVSP portal to register.', 'en');
    const actionTypes = actions.map((a) => a.action);
    expect(actionTypes).toContain('check_epic');
  });

  it('extracts booth action from response', () => {
    const actions = extractActions('Where is my booth?', 'You can find your polling booth on the CEO website.', 'en');
    const actionTypes = actions.map((a) => a.action);
    expect(actionTypes).toContain('locate_booth');
  });

  it('returns at most 3 actions', () => {
    const actions = extractActions(
      'register vote booth find documents check report violation',
      'register at NVSP, find booth, check documents, report violation',
      'en'
    );
    expect(actions.length).toBeLessThanOrEqual(3);
  });

  it('handles empty text gracefully', () => {
    const actions = extractActions('', '', 'en');
    expect(Array.isArray(actions)).toBe(true);
  });
});
