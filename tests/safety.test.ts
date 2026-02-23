/**
 * Safety module unit tests
 */
import { describe, it, expect } from 'vitest';
import { safetyCheck, isPoliticalQuery } from '@/lib/safety';

describe('Safety - Political Detection', () => {
  it('flags "vote for BJP" as political', () => {
    expect(isPoliticalQuery('You should vote for BJP')).toBe(true);
  });

  it('flags "support Congress" as political', () => {
    expect(isPoliticalQuery('Support Congress in elections')).toBe(true);
  });

  it('flags Malayalam party references', () => {
    expect(isPoliticalQuery('LDF ആണ് നല്ലത്')).toBe(true);
  });

  it('passes neutral voter query', () => {
    expect(isPoliticalQuery('How do I register to vote?')).toBe(false);
  });

  it('passes booth location query', () => {
    expect(isPoliticalQuery('Where is my polling booth?')).toBe(false);
  });
});

describe('Safety - safetyCheck', () => {
  it('returns safe for normal query', () => {
    const result = safetyCheck('How to check my registration?', 'en');
    expect(result.safe).toBe(true);
  });

  it('returns unsafe for political query', () => {
    const result = safetyCheck('Which party is best?', 'en');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.neutralResponse).toBeDefined();
  });

  it('provides Malayalam neutral response', () => {
    const result = safetyCheck('BJP-ക്ക് വോട്ട് ചെയ്യൂ', 'ml');
    expect(result.safe).toBe(false);
    expect(result.neutralResponse).toBeDefined();
  });
});
