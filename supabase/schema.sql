-- ═══════════════════════════════════════════════════════════════
-- Vaakku — Supabase Database Schema
-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)
-- to create all required tables.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Conversations ─────────────────────────────────────────
-- Stores full chat conversations with messages as JSONB
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT 'New conversation',
  summary       TEXT DEFAULT '',
  locale        TEXT NOT NULL DEFAULT 'en',
  messages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  starred       BOOLEAN NOT NULL DEFAULT FALSE,
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  escalated     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups and ordering
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);

-- ── 2. Memory Consent ────────────────────────────────────────
-- Per-user opt-in for memory features
CREATE TABLE IF NOT EXISTS memory_consent (
  user_id        TEXT PRIMARY KEY,
  memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_types  TEXT[] NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Memory Entries ────────────────────────────────────────
-- Persistent user memory (profile, preferences, saved docs)
CREATE TABLE IF NOT EXISTS memory_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,       -- 'profile' | 'preferences' | 'saved_docs'
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  redacted   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, type, key)    -- upsert on same user+type+key
);

CREATE INDEX IF NOT EXISTS idx_memory_user_id ON memory_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries (user_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── 4. Violation Reports ─────────────────────────────────────
-- Stores violation reports submitted via /api/report
CREATE TABLE IF NOT EXISTS violation_reports (
  id               TEXT PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  user_id          TEXT,
  session_id       TEXT,
  type             TEXT NOT NULL DEFAULT 'other', -- 'bribery' | 'intimidation' | 'misuse_of_power' | 'fake_news' | 'booth_capture' | 'other'
  description      TEXT NOT NULL,
  location         JSONB,                          -- { lat, lng, address }
  media_ids        TEXT[] NOT NULL DEFAULT '{}',
  locale           TEXT NOT NULL DEFAULT 'en',
  status           TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'under_review' | 'resolved' | 'dismissed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reference ON violation_reports (reference_number);
CREATE INDEX IF NOT EXISTS idx_reports_status ON violation_reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON violation_reports (created_at DESC);

-- ── 5. FAQ Analytics (optional) ──────────────────────────────
-- Track FAQ hits for analytics
CREATE TABLE IF NOT EXISTS faq_analytics (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  faq_key    TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'en',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faq_analytics_key ON faq_analytics (faq_key);

-- ── 6. Auto-update updated_at trigger ────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER memory_consent_updated_at
  BEFORE UPDATE ON memory_consent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER violation_reports_updated_at
  BEFORE UPDATE ON violation_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 7. Row Level Security (RLS) ─────────────────────────────
-- Enable RLS on all tables (service-role key bypasses RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: service role has full access (API routes use service key)
-- If you want client-side access via anon key, add policies like:
-- CREATE POLICY "Users can read own conversations"
--   ON conversations FOR SELECT
--   USING (user_id = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- Done! Your Supabase database is ready for Vaakku.
-- ═══════════════════════════════════════════════════════════════
