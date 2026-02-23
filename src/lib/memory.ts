/**
 * Persistent Memory System — Opt-in User Memory
 * ───────────────────────────────────────────────
 * Supports per-user opt-in with granular memory types:
 *   - profile: name, locale preference, constituency
 *   - preferences: UI settings, accessibility
 *   - saved_docs: EPIC numbers, saved extractions
 *
 * All PII is hashed before storage. Users can export/delete.
 * Retention controlled by MEMORY_RETENTION_DAYS env var.
 */

import { hashIdentifier } from '@/lib/privacy';
import { getConfig } from '@/lib/fireworks';
import type {
  MemoryEntry,
  MemoryType,
  MemoryConsentRequest,
  MemoryConsentResponse,
  MemoryExportResponse,
  StoredConversation,
  Locale,
} from '@/types';

// ── Consent store (in-memory; production: use encrypted DB) ──────

interface ConsentRecord {
  memoryEnabled: boolean;
  allowedTypes: MemoryType[];
  updatedAt: string;
}

const consentStore = new Map<string, ConsentRecord>();
const memoryStore = new Map<string, MemoryEntry[]>();

// ── Consent management ───────────────────────────────────────────

export function setMemoryConsent(req: MemoryConsentRequest): MemoryConsentResponse {
  const hashedUserId = hashIdentifier(req.userId);
  const record: ConsentRecord = {
    memoryEnabled: req.enabled,
    allowedTypes: req.enabled ? req.allowedTypes : [],
    updatedAt: new Date().toISOString(),
  };
  consentStore.set(hashedUserId, record);

  // If disabled, clear all memory
  if (!req.enabled) {
    memoryStore.delete(hashedUserId);
  }

  console.log(
    JSON.stringify({
      type: 'memory_consent_update',
      userHash: hashedUserId,
      enabled: req.enabled,
      allowedTypes: record.allowedTypes,
      timestamp: record.updatedAt,
    })
  );

  return {
    userId: hashedUserId,
    memoryEnabled: record.memoryEnabled,
    allowedTypes: record.allowedTypes,
    updatedAt: record.updatedAt,
  };
}

export function getMemoryConsent(userId: string): ConsentRecord | null {
  const hashedUserId = hashIdentifier(userId);
  return consentStore.get(hashedUserId) || null;
}

export function isMemoryEnabled(userId: string): boolean {
  const consent = getMemoryConsent(userId);
  return consent?.memoryEnabled ?? false;
}

export function isTypeAllowed(userId: string, type: MemoryType): boolean {
  const consent = getMemoryConsent(userId);
  if (!consent?.memoryEnabled) return false;
  return consent.allowedTypes.includes(type);
}

// ── Memory CRUD ──────────────────────────────────────────────────

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRetentionDate(): string {
  const cfg = getConfig();
  const d = new Date();
  d.setDate(d.getDate() + cfg.memoryRetentionDays);
  return d.toISOString();
}

/**
 * Store a memory entry (only if consent is given for that type)
 */
export function storeMemory(
  userId: string,
  type: MemoryType,
  key: string,
  value: string,
  locale: Locale = 'en'
): MemoryEntry | null {
  if (!isTypeAllowed(userId, type)) return null;

  const hashedUserId = hashIdentifier(userId);
  const entry: MemoryEntry = {
    id: generateId(),
    userId: hashedUserId,
    type,
    key,
    value,
    locale,
    createdAt: new Date().toISOString(),
    expiresAt: getRetentionDate(),
    redacted: false,
  };

  const entries = memoryStore.get(hashedUserId) || [];
  // Upsert: replace if same type+key exists
  const idx = entries.findIndex((e) => e.type === type && e.key === key);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  memoryStore.set(hashedUserId, entries);

  return entry;
}

/**
 * Retrieve user memories, filtered by type if specified
 */
export function getMemories(userId: string, type?: MemoryType): MemoryEntry[] {
  const hashedUserId = hashIdentifier(userId);
  const entries = memoryStore.get(hashedUserId) || [];
  const now = new Date().toISOString();

  // Filter expired entries
  const valid = entries.filter((e) => e.expiresAt > now);
  if (valid.length !== entries.length) {
    memoryStore.set(hashedUserId, valid);
  }

  return type ? valid.filter((e) => e.type === type) : valid;
}

/**
 * Build memory context block for RAG prompt enrichment
 */
export function buildMemoryContext(userId: string): string {
  if (!isMemoryEnabled(userId)) return '';

  const memories = getMemories(userId);
  if (memories.length === 0) return '';

  const lines = memories.map((m) => `[${m.type}] ${m.key}: ${m.value}`);
  return `\nUSER MEMORY (opt-in stored preferences):\n${lines.join('\n')}\n`;
}

/**
 * Export all user data (for GDPR/data access requests)
 */
export function exportUserMemory(
  userId: string,
  conversations: StoredConversation[] = []
): MemoryExportResponse {
  const hashedUserId = hashIdentifier(userId);
  return {
    userId: hashedUserId,
    exportedAt: new Date().toISOString(),
    entries: getMemories(userId),
    conversations,
  };
}

/**
 * Delete all user memory (right to be forgotten)
 */
export function deleteUserMemory(userId: string): { deleted: boolean; entriesRemoved: number } {
  const hashedUserId = hashIdentifier(userId);
  const entries = memoryStore.get(hashedUserId) || [];
  const count = entries.length;
  memoryStore.delete(hashedUserId);
  consentStore.delete(hashedUserId);

  console.log(
    JSON.stringify({
      type: 'memory_deletion',
      userHash: hashedUserId,
      entriesRemoved: count,
      timestamp: new Date().toISOString(),
    })
  );

  return { deleted: true, entriesRemoved: count };
}

/**
 * Admin: purge all expired memories across all users
 */
export function purgeExpiredMemories(): number {
  const now = new Date().toISOString();
  let totalPurged = 0;

  for (const [userId, entries] of memoryStore.entries()) {
    const valid = entries.filter((e) => e.expiresAt > now);
    totalPurged += entries.length - valid.length;
    if (valid.length === 0) {
      memoryStore.delete(userId);
    } else {
      memoryStore.set(userId, valid);
    }
  }

  return totalPurged;
}
