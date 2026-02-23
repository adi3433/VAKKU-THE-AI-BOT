/**
 * Privacy module unit tests
 */
import { describe, it, expect } from 'vitest';
import { hashIdentifier, redactPII, createAuditEntry } from '@/lib/privacy';

describe('Privacy - hashIdentifier', () => {
  it('returns a 16-char hex string', () => {
    const hash = hashIdentifier('test-id-123');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('is deterministic', () => {
    const a = hashIdentifier('same-value');
    const b = hashIdentifier('same-value');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = hashIdentifier('alpha');
    const b = hashIdentifier('beta');
    expect(a).not.toBe(b);
  });
});

describe('Privacy - redactPII', () => {
  it('redacts Aadhaar numbers', () => {
    const result = redactPII('My Aadhaar is 1234 5678 9012');
    expect(result).not.toContain('1234 5678 9012');
    expect(result).toContain('[AADHAAR]');
  });

  it('redacts email addresses', () => {
    const result = redactPII('Contact me at voter@example.com');
    expect(result).not.toContain('voter@example.com');
  });

  it('redacts phone numbers', () => {
    const result = redactPII('Call +91 9876543210');
    expect(result).not.toContain('9876543210');
  });

  it('preserves non-PII text', () => {
    const text = 'How to register as a voter?';
    expect(redactPII(text)).toBe(text);
  });
});

describe('Privacy - createAuditEntry', () => {
  it('creates an entry with required fields', () => {
    const entry = createAuditEntry('test-action', 'admin_01', 'Some detail text');
    expect(entry.action).toBe('test-action');
    expect(entry.timestamp).toBeDefined();
    expect(entry.actorId).toBeDefined();
    expect(entry.details).toBeDefined();
  });
});
