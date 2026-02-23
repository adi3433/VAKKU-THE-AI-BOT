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
 *
 * Storage: Supabase PostgreSQL (permanent). Falls back to
 * in-memory Map when Supabase is not configured.
 */

import { hashIdentifier } from '@/lib/privacy';
import { getConfig } from '@/lib/fireworks';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  dbSetMemoryConsent,
  dbGetMemoryConsent,
  dbStoreMemory,
  dbGetMemories,
  dbDeleteMemories,
  dbDeleteUserData,
  dbPurgeExpiredMemories,
} from '@/lib/db';
import type {
  MemoryEntry,
  MemoryType,
  MemoryConsentRequest,
  MemoryConsentResponse,
  MemoryExportResponse,
  StoredConversation,
  Locale,
} from '@/types';

// ── In-memory fallback (used when Supabase is not configured) ────

interface ConsentRecord {
  memoryEnabled: boolean;
  allowedTypes: MemoryType[];
  updatedAt: string;
}

const consentStore = new Map<string, ConsentRecord>();
const memoryStore = new Map<string, MemoryEntry[]>();

// ── Consent management ───────────────────────────────────────────

export async function setMemoryConsent(req: MemoryConsentRequest): Promise<MemoryConsentResponse> {
  const hashedUserId = hashIdentifier(req.userId);
  const record: ConsentRecord = {
    memoryEnabled: req.enabled,
    allowedTypes: req.enabled ? req.allowedTypes : [],
    updatedAt: new Date().toISOString(),
  };

  // Persist to Supabase
  if (isSupabaseConfigured()) {
    await dbSetMemoryConsent(hashedUserId, req.enabled, req.enabled ? req.allowedTypes : []);
  }

  // Always keep in-memory cache in sync
  consentStore.set(hashedUserId, record);

  if (!req.enabled) {
    memoryStore.delete(hashedUserId);
    if (isSupabaseConfigured()) {
      await dbDeleteMemories(hashedUserId);
    }
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

export async function getMemoryConsent(userId: string): Promise<ConsentRecord | null> {
  const hashedUserId = hashIdentifier(userId);

  // Check in-memory cache first
  const cached = consentStore.get(hashedUserId);
  if (cached) return cached;

  // Try Supabase
  if (isSupabaseConfigured()) {
    const dbRecord = await dbGetMemoryConsent(hashedUserId);
    if (dbRecord) {
      const record: ConsentRecord = {
        memoryEnabled: dbRecord.memoryEnabled,
        allowedTypes: dbRecord.allowedTypes,
        updatedAt: new Date().toISOString(),
      };
      consentStore.set(hashedUserId, record); // cache it
      return record;
    }
  }

  return null;
}

export async function isMemoryEnabled(userId: string): Promise<boolean> {
  const consent = await getMemoryConsent(userId);
  return consent?.memoryEnabled ?? false;
}

export async function isTypeAllowed(userId: string, type: MemoryType): Promise<boolean> {
  const consent = await getMemoryConsent(userId);
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
 * Store a memory entry (only if consent is given for that type).
 * Persists to Supabase when configured, with in-memory fallback.
 */
export async function storeMemory(
  userId: string,
  type: MemoryType,
  key: string,
  value: string,
  locale: Locale = 'en'
): Promise<MemoryEntry | null> {
  const allowed = await isTypeAllowed(userId, type);
  if (!allowed) return null;

  const hashedUserId = hashIdentifier(userId);
  const entryId = generateId();
  const expiresAt = getRetentionDate();

  const entry: MemoryEntry = {
    id: entryId,
    userId: hashedUserId,
    type,
    key,
    value,
    locale,
    createdAt: new Date().toISOString(),
    expiresAt,
    redacted: false,
  };

  // Persist to Supabase
  if (isSupabaseConfigured()) {
    await dbStoreMemory(entryId, hashedUserId, type, key, value, locale, expiresAt);
  }

  // Update in-memory cache
  const entries = memoryStore.get(hashedUserId) || [];
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
 * Retrieve user memories, filtered by type if specified.
 * Reads from Supabase when configured (with in-memory cache fallback).
 */
export async function getMemories(userId: string, type?: MemoryType): Promise<MemoryEntry[]> {
  const hashedUserId = hashIdentifier(userId);

  // Try Supabase first
  if (isSupabaseConfigured()) {
    const dbEntries = await dbGetMemories(hashedUserId, type);
    if (dbEntries.length > 0) {
      // Update in-memory cache
      memoryStore.set(hashedUserId, dbEntries);
      return dbEntries;
    }
  }

  // Fallback to in-memory
  const entries = memoryStore.get(hashedUserId) || [];
  const now = new Date().toISOString();
  const valid = entries.filter((e) => e.expiresAt > now);
  if (valid.length !== entries.length) {
    memoryStore.set(hashedUserId, valid);
  }

  return type ? valid.filter((e) => e.type === type) : valid;
}

/**
 * Build memory context block for RAG prompt enrichment
 */
export async function buildMemoryContext(userId: string): Promise<string> {
  const enabled = await isMemoryEnabled(userId);
  if (!enabled) return '';

  const memories = await getMemories(userId);
  if (memories.length === 0) return '';

  const lines = memories.map((m) => `[${m.type}] ${m.key}: ${m.value}`);
  return `\nUSER MEMORY (opt-in stored preferences):\n${lines.join('\n')}\n`;
}

/**
 * Export all user data (for GDPR/data access requests)
 */
export async function exportUserMemory(
  userId: string,
  conversations: StoredConversation[] = []
): Promise<MemoryExportResponse> {
  const hashedUserId = hashIdentifier(userId);
  return {
    userId: hashedUserId,
    exportedAt: new Date().toISOString(),
    entries: await getMemories(userId),
    conversations,
  };
}

/**
 * Delete all user memory (right to be forgotten).
 * Deletes from both Supabase and in-memory.
 */
export async function deleteUserMemory(userId: string): Promise<{ deleted: boolean; entriesRemoved: number }> {
  const hashedUserId = hashIdentifier(userId);
  let count = 0;

  // Delete from Supabase
  if (isSupabaseConfigured()) {
    const result = await dbDeleteUserData(hashedUserId);
    count = result.entriesRemoved;
  }

  // Delete from in-memory
  const localEntries = memoryStore.get(hashedUserId) || [];
  count = Math.max(count, localEntries.length);
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
 * Admin: purge all expired memories across all users.
 */
export async function purgeExpiredMemories(): Promise<number> {
  let totalPurged = 0;

  // Purge from Supabase
  if (isSupabaseConfigured()) {
    totalPurged += await dbPurgeExpiredMemories();
  }

  // Purge from in-memory
  const now = new Date().toISOString();
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
