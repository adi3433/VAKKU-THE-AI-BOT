/**
 * Privacy Module — PII Hashing, Encryption helpers, Data Minimization
 * ────────────────────────────────────────────────────────────────────
 * - Hash identifiers for analytics (SHA-256)
 * - Redact PII from text
 * - Data access/deletion utilities
 */

import { createHash } from 'crypto';

/**
 * Hash an identifier (session ID, user ID) for anonymous logging.
 * Uses SHA-256 with a salt.
 */
export function hashIdentifier(identifier: string): string {
  const salt = process.env.HASH_SALT || 'vaakku-kottayam-sveep-2026';
  return createHash('sha256')
    .update(`${salt}:${identifier}`)
    .digest('hex')
    .substring(0, 16); // Truncate to 16 chars for log readability
}

/**
 * Redact PII from a text string
 */
export function redactPII(text: string): string {
  let redacted = text;

  // Aadhaar numbers (12 digits)
  redacted = redacted.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR]');

  // EPIC/Voter ID (3 letters + 7 digits)
  redacted = redacted.replace(/\b[A-Z]{3}\d{7}\b/g, '[VOTER_ID]');

  // PAN (5 letters + 4 digits + 1 letter)
  redacted = redacted.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]');

  // Phone numbers
  redacted = redacted.replace(/\b(\+91|91|0)?[6-9]\d{9}\b/g, '[PHONE]');

  // Email addresses
  redacted = redacted.replace(
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g,
    '[EMAIL]'
  );

  return redacted;
}

/**
 * Generate a minimal session identifier for logging
 * (not linked to user identity)
 */
export function generateAnonymousId(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 12);
}

/**
 * Audit log entry creator
 */
export function createAuditEntry(
  action: string,
  actorId: string,
  details: string,
  targetId?: string
) {
  return {
    id: generateAnonymousId(),
    action,
    actorId: hashIdentifier(actorId),
    targetId: targetId ? hashIdentifier(targetId) : undefined,
    details: redactPII(details),
    timestamp: new Date().toISOString(),
  };
}
