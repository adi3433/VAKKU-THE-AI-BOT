/**
 * Database Operations — Supabase CRUD Layer
 * ──────────────────────────────────────────
 * Typed operations for conversations, memory entries,
 * and consent records. Falls back gracefully when
 * Supabase is not configured.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type {
  ChatMessage,
  Locale,
  MemoryType,
  MemoryEntry,
  ConversationListItem,
} from '@/types';

// ══════════════════════════════════════════════════════════════
// ── Conversation Operations ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

interface DbConversation {
  id: string;
  user_id: string;
  session_id: string;
  title: string;
  summary: string;
  locale: string;
  messages: ChatMessage[];
  message_count: number;
  starred: boolean;
  pinned: boolean;
  escalated: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert a conversation (insert or update by session_id).
 */
export async function dbSaveConversation(
  userId: string,
  sessionId: string,
  messages: ChatMessage[],
  locale: Locale,
  title: string,
  summary: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('conversations')
      .upsert(
        {
          id: sessionId,
          user_id: userId,
          session_id: sessionId,
          title,
          summary,
          locale,
          messages: JSON.parse(JSON.stringify(messages)),
          message_count: messages.length,
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('[db] saveConversation error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[db] saveConversation exception:', err);
    return false;
  }
}

/**
 * List conversations for a user (sidebar data — no messages).
 */
export async function dbListConversations(
  userId: string,
  limit = 50
): Promise<ConversationListItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('conversations')
      .select('id, title, summary, locale, message_count, starred, pinned, escalated, updated_at')
      .eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[db] listConversations error:', error.message);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      title: row.title as string,
      summary: (row.summary as string) || '',
      locale: (row.locale as Locale) || 'en',
      messageCount: (row.message_count as number) || 0,
      updatedAt: row.updated_at as string,
      starred: (row.starred as boolean) || false,
      pinned: (row.pinned as boolean) || false,
      escalated: (row.escalated as boolean) || false,
    }));
  } catch (err) {
    console.error('[db] listConversations exception:', err);
    return [];
  }
}

/**
 * Get full conversation with messages.
 */
export async function dbGetConversation(
  conversationId: string
): Promise<{ messages: ChatMessage[]; locale: Locale } | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('conversations')
      .select('messages, locale')
      .eq('id', conversationId)
      .single();

    if (error || !data) return null;
    return {
      messages: (data as DbConversation).messages || [],
      locale: ((data as DbConversation).locale as Locale) || 'en',
    };
  } catch {
    return null;
  }
}

/**
 * Delete a conversation.
 */
export async function dbDeleteConversation(conversationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('conversations').delete().eq('id', conversationId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Toggle starred/pinned flag on a conversation.
 */
export async function dbUpdateConversationFlags(
  conversationId: string,
  updates: { starred?: boolean; pinned?: boolean; title?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    return !error;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// ── Memory Consent Operations ────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface DbConsentRecord {
  user_id: string;
  memory_enabled: boolean;
  allowed_types: string[];
  updated_at: string;
}

/**
 * Set or update memory consent for a user.
 */
export async function dbSetMemoryConsent(
  userId: string,
  enabled: boolean,
  allowedTypes: MemoryType[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('memory_consent')
      .upsert(
        {
          user_id: userId,
          memory_enabled: enabled,
          allowed_types: enabled ? allowedTypes : [],
        },
        { onConflict: 'user_id' }
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get memory consent record for a user.
 */
export async function dbGetMemoryConsent(
  userId: string
): Promise<{ memoryEnabled: boolean; allowedTypes: MemoryType[] } | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('memory_consent')
      .select('memory_enabled, allowed_types')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    const row = data as DbConsentRecord;
    return {
      memoryEnabled: row.memory_enabled,
      allowedTypes: row.allowed_types as MemoryType[],
    };
  } catch {
    return null;
  }
}

/**
 * Delete consent and all memory for a user (right to be forgotten).
 */
export async function dbDeleteUserData(userId: string): Promise<{ entriesRemoved: number }> {
  if (!isSupabaseConfigured()) return { entriesRemoved: 0 };

  try {
    const sb = getSupabaseClient();

    // Count entries before deletion
    const { count } = await sb
      .from('memory_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Delete memory entries
    await sb.from('memory_entries').delete().eq('user_id', userId);
    // Delete consent
    await sb.from('memory_consent').delete().eq('user_id', userId);
    // Delete conversations
    await sb.from('conversations').delete().eq('user_id', userId);

    return { entriesRemoved: count || 0 };
  } catch {
    return { entriesRemoved: 0 };
  }
}

// ══════════════════════════════════════════════════════════════
// ── Memory Entry Operations ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Store (upsert) a memory entry.
 */
export async function dbStoreMemory(
  id: string,
  userId: string,
  type: MemoryType,
  key: string,
  value: string,
  locale: Locale,
  expiresAt: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('memory_entries')
      .upsert(
        {
          id,
          user_id: userId,
          type,
          key,
          value,
          locale,
          expires_at: expiresAt,
        },
        { onConflict: 'user_id,type,key' }
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get memory entries for a user (optionally filtered by type).
 */
export async function dbGetMemories(
  userId: string,
  type?: MemoryType
): Promise<MemoryEntry[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const sb = getSupabaseClient();
    let query = sb
      .from('memory_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('redacted', false)
      .gt('expires_at', new Date().toISOString());

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      type: row.type as MemoryType,
      key: row.key as string,
      value: row.value as string,
      locale: (row.locale as Locale) || 'en',
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
      redacted: (row.redacted as boolean) || false,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete all memory entries for a user.
 */
export async function dbDeleteMemories(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const sb = getSupabaseClient();
    const { count } = await sb
      .from('memory_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    await sb.from('memory_entries').delete().eq('user_id', userId);
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Purge all expired memory entries across all users.
 */
export async function dbPurgeExpiredMemories(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const sb = getSupabaseClient();
    const now = new Date().toISOString();

    const { count } = await sb
      .from('memory_entries')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', now);

    await sb.from('memory_entries').delete().lt('expires_at', now);
    return count || 0;
  } catch {
    return 0;
  }
}
