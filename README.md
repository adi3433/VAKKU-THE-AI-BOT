# Vaakku — Bilingual AI Voter Assistant

> **SVEEP Kottayam · 2026 Kerala Elections**
> A production-grade bilingual (English + Malayalam) AI chatbot that helps citizens find voter information, locate polling booths, check registration status, and report violations — powered by a 4-stage hybrid RAG pipeline on Fireworks AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tests](https://img.shields.io/badge/Tests-117%20passing-brightgreen) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [Overview](#overview)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [How the RAG Pipeline Works](#how-the-rag-pipeline-works)
- [Multimodal Router](#multimodal-router)
- [Core Modules Explained](#core-modules-explained)
- [API Routes](#api-routes)
- [Frontend Pages](#frontend-pages)
- [UI Components](#ui-components)
- [Hooks](#hooks)
- [What You Need to Make RAG Functional](#what-you-need-to-make-rag-functional)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)
- [Design System](#design-system)

---

## Overview

**Vaakku** (വാക്ക്, meaning "word" / "voice" in Malayalam) is a conversational AI assistant that helps voters in Kottayam district with:

- **Voter Registration** — Form guidance, status checks, corrections
- **Polling Booth Locator** — Find your booth with accessibility info
- **Document Guidance** — Required ID proofs for voting
- **EVM/VVPAT Information** — How electronic voting works
- **Violation Reporting** — Report election irregularities with evidence
- **SVEEP Awareness** — Voter education and participation
- **Document OCR** — Upload voter ID / Aadhaar → AI extracts fields
- **Voice Input** — Speak your question in Malayalam or English

The bot is strictly **non-partisan** — it will never recommend parties, candidates, or political positions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js App Router)                  │
│                                                                         │
│   Landing ─── Chat ─── Booth ─── Registration ─── Report ─── Settings  │
│                 │            FAQ            Admin                        │
│                 │                                                       │
│            Zustand Store         API Client (axios)                      │
└────────────────┬────────────────────┬───────────────────────────────────┘
                 │                    │
                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API ROUTES (Next.js Route Handlers)              │
│                                                                         │
│   /api/chat ───────────────┐                                            │
│   /api/chat-multimodal ────┤                                            │
│   /api/booth ──────────────┤      /api/embeddings                       │
│   /api/registration ───────┼───►  /api/rerank                           │
│   /api/registration-status │      /api/transcribe                       │
│   /api/report ─────────────┤      /api/vision                           │
│   /api/memory/* ───────────┘      /api/admin/*                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENT ROUTER (router.ts)                   │
│                                                                         │
│   Classifies input modality → routes to correct pipeline:               │
│                                                                         │
│   Text ──────────────► RAG Pipeline                                     │
│   Audio ─────────────► Whisper V3 → transcribe → RAG Pipeline           │
│   Image ─────────────► Vision VL Model (OCR/extraction)                 │
│   Image + Text ──────► Multimodal reasoning                             │
│   Structured keyword ► Internal API (booth/registration/report)         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     4-STAGE HYBRID RAG PIPELINE                         │
│                                                                         │
│   Stage 1: EMBED      │ qwen3-embedding-8b         Dense vectors        │
│   Stage 2: RETRIEVE   │ Vector search + BM25       Top 15 candidates    │
│   Stage 3: RERANK     │ qwen3-reranker-8b          Top 3 passages       │
│   Stage 4: GENERATE   │ qwen3-vl-30b-a3b-thinking  Final answer         │
│                                                                         │
│   + Memory injection (opt-in) + Prompt versioning + Retrieval trace     │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CROSS-CUTTING CONCERNS                              │
│                                                                         │
│   Safety ─── political neutrality enforcement, content moderation       │
│   Privacy ── PII hashing (SHA-256), data redaction                      │
│   Audit ──── query logs, escalation tracking, admin dashboard           │
│   i18n ───── bilingual (English + Malayalam) throughout                  │
│   Memory ─── opt-in persistent memory with GDPR export/delete           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
vaakku/
├── src/
│   ├── app/                        # Next.js App Router pages & API routes
│   │   ├── page.tsx                # Landing page
│   │   ├── layout.tsx              # Root layout
│   │   ├── globals.css             # Tailwind v4 global styles
│   │   ├── chat/page.tsx           # Main chat interface (sidebar, upload, quick actions)
│   │   ├── booth/page.tsx          # Polling booth locator (map + search)
│   │   ├── registration/page.tsx   # Voter registration check
│   │   ├── report/page.tsx         # Violation reporting form
│   │   ├── faq/page.tsx            # FAQ page
│   │   ├── settings/page.tsx       # Settings (language, memory toggle, data export/delete)
│   │   ├── admin/page.tsx          # Admin dashboard (6 tabs)
│   │   └── api/                    # Backend API routes
│   │       ├── chat/route.ts              # Main text chat → Router → RAG → ChatResponseV2
│   │       ├── chat-multimodal/route.ts   # Text + image + audio → Router → ChatResponseV2
│   │       ├── booth/route.ts             # Booth search by ward/location
│   │       ├── registration/route.ts      # Registration check by EPIC/name
│   │       ├── registration-status/route.ts # Detailed EPIC status with booth info
│   │       ├── report/route.ts            # Violation report submission
│   │       ├── embeddings/route.ts        # Fireworks embedding wrapper
│   │       ├── rerank/route.ts            # Fireworks reranker wrapper
│   │       ├── transcribe/route.ts        # Whisper V3 audio transcription wrapper
│   │       ├── vision/route.ts            # Image analysis (VL model)
│   │       ├── voice/route.ts             # Voice processing pipeline
│   │       ├── sync_sources/route.ts      # Admin content sync
│   │       ├── data-access/route.ts       # GDPR data access request
│   │       ├── admin/route.ts             # Admin stats/logs/escalations
│   │       └── memory/                    # User memory management
│   │           ├── consent/route.ts       #   POST/GET consent preferences
│   │           ├── export/route.ts        #   GET GDPR data export
│   │           └── delete/route.ts        #   DELETE right to erasure
│   │
│   ├── lib/                        # Core business logic
│   │   ├── fireworks.ts            # Fireworks AI SDK client (ALL model calls go through here)
│   │   ├── router.ts              # Intelligent multimodal input router/classifier
│   │   ├── vision.ts              # Document OCR / image extraction (VL model)
│   │   ├── voice.ts               # Audio transcription pipeline (Whisper V3)
│   │   ├── memory.ts              # Opt-in persistent user memory (with consent)
│   │   ├── chat-history.ts        # Stored conversation history (search, pin, star)
│   │   ├── prompts.ts             # Versioned, auditable prompt templates
│   │   ├── safety.ts              # Political neutrality enforcement & content moderation
│   │   ├── privacy.ts             # PII hashing (SHA-256) & redaction
│   │   ├── admin-audit.ts         # Query logs, audit trail, escalation queue
│   │   ├── store.ts               # Zustand global client state
│   │   ├── api-client.ts          # Typed fetch wrappers for all API routes
│   │   ├── i18n.ts                # Bilingual string translations (EN + ML)
│   │   ├── design-tokens.ts       # UI design token system
│   │   └── rag/                   # ── RAG Pipeline (4 stages) ──
│   │       ├── index.ts           # Barrel exports
│   │       ├── orchestrator.ts    # Pipeline orchestrator (main entry point)
│   │       ├── embeddings.ts      # Stage 1: Dense vector embeddings (qwen3-embedding-8b)
│   │       ├── retriever.ts       # Stage 2: Hybrid vector + BM25 search
│   │       ├── reranker.ts        # Stage 3: Cross-encoder reranking (qwen3-reranker-8b)
│   │       ├── generator.ts       # Stage 4: Answer generation (qwen3-vl-30b)
│   │       └── actions.ts         # Quick action extraction from responses
│   │
│   ├── components/                 # React UI components
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx      # Message text input with send button
│   │   │   ├── MessageList.tsx    # Scrollable chat bubbles with citations & actions
│   │   │   ├── ChatSidebar.tsx    # Slide-out conversation history (search, pin, star)
│   │   │   ├── FileUpload.tsx     # Drag/drop + camera + file picker with PII consent
│   │   │   ├── QuickActions.tsx   # Suggested action cards
│   │   │   ├── SystemBanner.tsx   # Dismissable system announcement
│   │   │   └── index.ts          # Barrel exports
│   │   └── layout/
│   │       ├── Header.tsx         # App header with logo + language toggle
│   │       ├── ParallaxBackground.tsx  # Animated gradient background
│   │       └── index.ts
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useChat.ts             # Chat state management & message sending
│   │   ├── useLocale.ts           # Language switching (en ↔ ml)
│   │   ├── useSpeechRecognition.ts # Browser Web Speech API for voice input
│   │   ├── useParallax.ts         # Scroll-based parallax animation
│   │   ├── useDeviceOrientation.ts # Gyroscope-based parallax (mobile)
│   │   └── index.ts
│   │
│   └── types/
│       └── index.ts               # ALL shared TypeScript interfaces (~400 lines)
│
├── tests/                          # Vitest test suite (117 tests)
│   ├── canonical-queries.test.ts  # 92 bilingual query coverage tests
│   ├── safety.test.ts             # 8 political neutrality tests
│   ├── privacy.test.ts            # 8 PII redaction tests
│   ├── retriever.test.ts          # 5 RAG retrieval tests
│   ├── actions.test.ts            # 4 action extraction tests
│   └── fixtures/                  # Test data fixtures
│
├── kubernetes/deployment.yaml      # K8s deployment config
├── Dockerfile                      # Docker multi-stage build
├── docker-compose.yml              # Docker Compose (app + ChromaDB)
├── .github/                        # CI/CD (GitHub Actions)
├── .env.example                    # Environment variable template
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript 5 config
├── vitest.config.ts                # Test config
└── next.config.ts                  # Next.js 16 config
```

---

## How the RAG Pipeline Works

The RAG (Retrieval-Augmented Generation) pipeline is the brain of Vaakku. Every user question goes through 4 stages inside `src/lib/rag/`:

### Stage 1 — Embed (`embeddings.ts`)

The user's question is converted into a dense vector (array of numbers) using **qwen3-embedding-8b** via Fireworks. This vector represents the *meaning* of the question, not just the keywords.

```
"Where is my polling booth?" → [0.23, -0.14, 0.87, ...] (768-dim vector)
```

- Embeddings are cached for 24 hours to avoid redundant API calls
- Batch embedding of documents uses groups of 64
- Exposed functions: `embedQuery()`, `embedDocuments()`, `cosineSimilarity()`

### Stage 2 — Retrieve (`retriever.ts`)

Two search methods run and their scores are merged:

| Method | How it works | Good at |
|--------|-------------|---------|
| **Vector search** | Cosine similarity between query embedding and all document embeddings | Semantic meaning ("How do I vote?" finds "casting your ballot") |
| **BM25 keyword search** | TF-IDF term frequency scoring | Exact keyword matches ("EPIC number", "Form 6") |

Scores are combined: `0.7 × vector_score + 0.3 × bm25_score`

**Output:** Top 15 candidate passages, each with a source reference.

**Built-in knowledge base:** Currently contains 15+ seeded entries covering voter registration, booth finding, required documents, Kottayam district info, SVEEP activities, violation reporting — all in both English and Malayalam.

### Stage 3 — Rerank (`reranker.ts`)

The 15 candidates from Stage 2 are sent to **qwen3-reranker-8b**, a cross-encoder model that reads each passage *alongside* the query and assigns a relevance score.

Cross-encoders are more accurate than embedding similarity because they see the query and passage together, but they're slower — that's why we only rerank 15 candidates, not thousands.

**Output:** Top 3 most relevant passages, each with a reranker score. Results are cached for 1 hour.

### Stage 4 — Generate (`generator.ts`)

The top 3 passages are injected into a structured prompt (from `prompts.ts`) and sent to **qwen3-vl-30b-a3b-thinking**:

```
System: You are Vaakku, an impartial voter information assistant for
        SVEEP Kottayam 2026. You MUST cite sources as [Source 1],
        [Source 2]... Rate your confidence 0.0-1.0 in your answer.

User:   Question: "Where is my polling booth?"

        Source 1: Government Higher Secondary School, Ward 12...
        Source 2: Booth locator service at ceokerala.gov.in...
        Source 3: ...

        Answer in {locale} with citations.
```

The model generates a bilingual answer with source citations and a self-assessed confidence score.

### Confidence Formula (Orchestrator)

After generation, the orchestrator (`orchestrator.ts`) computes a final confidence:

```
confidence = 0.2 × max_similarity + 0.4 × avg_reranker + 0.2 × model_selfscore + 0.2 × validation_score
```

| Weight | Component | Meaning |
|--------|-----------|---------|
| 20% | `max_similarity` | Best vector similarity score from retrieval |
| 40% | `avg_reranker` | Average reranker score of top passages |
| 20% | `model_selfscore` | Model's own confidence rating (parsed from response) |
| 20% | `validation_score` | Post-generation validation (citations present? length adequate?) |

**If confidence < 0.55** → the query is **escalated** to human review via the admin dashboard.

### Retrieval Trace

Every response includes a `retrievalTrace[]` — an array showing each passage that was considered, with its similarity and reranker scores. This powers the Admin "Retrieval Traces" tab for debugging poor answers.

### How It All Connects (Data Flow)

```
User types: "How do I register to vote?"
     │
     ▼
[/api/chat] receives message
     │
     ▼
[router.ts] classifies as "text" → routes to RAG
     │
     ▼
[orchestrator.ts] starts 4-stage pipeline:
     │
     ├─► [embeddings.ts] embeds query → vector [0.23, -0.14, ...]
     │
     ├─► [retriever.ts] searches knowledge base
     │     ├── vector search (cosine similarity)
     │     └── BM25 keyword search
     │     → returns 15 candidate passages
     │
     ├─► [reranker.ts] reranks 15 → picks top 3
     │
     ├─► [memory.ts] (if opted in) injects user context
     │
     ├─► [prompts.ts] builds versioned system + user prompt
     │
     ├─► [generator.ts] sends to qwen3-vl-30b → gets answer
     │
     ├─► [actions.ts] extracts quick actions from response
     │
     └─► Computes confidence, checks if escalation needed
     │
     ▼
[safety.ts] checks for political bias, redacts PII
     │
     ▼
[admin-audit.ts] logs query, escalation if needed
     │
     ▼
[chat-history.ts] auto-saves conversation
     │
     ▼
Returns ChatResponseV2 to frontend
```

---

## Multimodal Router

`router.ts` is the first thing that processes any input. It classifies what kind of input it is and routes it to the right pipeline:

| Input | Router Type | What Happens |
|-------|------------|--------------|
| Plain text | `rag` | Direct to 4-stage RAG pipeline |
| Audio blob | `voice_then_rag` | Whisper V3 transcribes → language detected → text goes to RAG |
| Image only | `vision` | VL model extracts document fields (EPIC card, Aadhaar, etc.) |
| Image + question | `multimodal` | VL model answers question about the image |
| "Find my booth" | `structured_lookup` | Hits booth/registration API, then wraps result with RAG |

**Critical rule:** The VL (Vision-Language) model is NEVER invoked unless image data is actually present. The router enforces this.

---

## Core Modules Explained

### `fireworks.ts` — Fireworks AI Client

**The single gateway to ALL AI models.** Every model call in the entire app goes through this file.

| Function | Model | Purpose |
|----------|-------|---------|
| `chatCompletion()` | qwen3-vl-30b-a3b-thinking | Text generation, vision analysis |
| `chatCompletionStream()` | qwen3-vl-30b-a3b-thinking | Streaming responses (SSE) |
| `createEmbeddings()` | qwen3-embedding-8b | Dense vector embeddings |
| `transcribeAudio()` | whisper-v3 | Audio → text transcription |

Key features:
- **Per-endpoint URLs** — each model type has its own Fireworks URL
- **Circuit breaker** — 5 failures → 60s cool-down (stops hammering a broken endpoint)
- **12-second timeout** — `AbortController` on all requests
- **`ResponseCache<T>`** — generic TTL cache class used by embeddings, reranker, answers

### `vision.ts` — Document OCR & Image Analysis

Uses qwen3-vl-30b in multimodal mode (image + text prompt) to:
- Detect document type (voter ID, Aadhaar, driving license, passport, etc.)
- Extract fields (name, ID number, address, DOB)
- Validate extracted data
- Explain the document in bilingual text

### `voice.ts` — Audio Transcription Pipeline

1. Format validation (webm, wav, mp3, mp4, ogg)
2. Whisper V3 transcription via Fireworks
3. Language detection (Malayalam vs English via Unicode + Whisper tag)
4. Filler word removal ("um", "uh" in English; "അത്", "പിന്നെ" in Malayalam)
5. PII redaction for audit logs

### `safety.ts` — Political Neutrality Enforcement

**Critical for an election tool.** Detects mentions of BJP, Congress, LDF, UDF, CPI(M), IUML, NDA, and all major Kerala parties in English and Malayalam. When flagged, replaces the response with a neutral redirect to official sources. Ensures Vaakku never recommends candidates or expresses political opinions.

### `privacy.ts` — PII Protection

- `hashIdentifier(id)` — SHA-256 with salt, truncated to 16 chars (used for userId, sessionId in logs)
- `redactPII(text)` — masks Aadhaar `[AADHAAR]`, Voter ID `[VOTER_ID]`, PAN `[PAN]`, phone `[PHONE]`
- All admin logs contain only hashed identifiers, never raw PII

### `memory.ts` — Persistent User Memory

Opt-in system (requires explicit consent) that remembers:
- **Profile** — preferred language, constituency, name
- **Preferences** — accessibility settings
- **Saved docs** — previously extracted EPIC numbers

GDPR-compliant: export all data or delete everything ("right to be forgotten"). Auto-expires after `MEMORY_RETENTION_DAYS` (default 90).

Currently in-memory `Map` (PoC). Production: encrypted PostgreSQL.

### `chat-history.ts` — Conversation Storage

Stores sessions with auto-titles, search, pin/star. Only stores if memory consent is given. Currently in-memory (production: encrypted DB).

### `prompts.ts` — Prompt Templates

All prompts centralized (not scattered). Each template is versioned (`v2.1-kottayam-2026`) and hashed for audit trail — so you can trace which prompt version produced which answer.

### `admin-audit.ts` — Admin Dashboard Backend

- **Query logs** — every question, response, confidence, latency, modality, router type
- **Escalation queue** — low-confidence or safety-flagged queries for human review
- **Audit trail** — data access, memory operations, content syncs
- Protected by `x-admin-token` header

### `store.ts` — Zustand Client State

| Slice | What it holds |
|-------|---------------|
| Locale | Current language (en/ml) |
| Session | sessionId, persistent userId (localStorage) |
| Chat | Message array, typing indicator |
| Quick Actions | Suggested action buttons |
| History | Sidebar open/closed, conversation list, active conversation |
| Memory | Memory enabled toggle, consent status |
| Upload | Pending file (base64, preview, type, size) |
| UI | Sidebar, motion, accessibility mode |

### `api-client.ts` — Frontend HTTP Client

Typed wrappers for all API routes using axios (30s timeout). Exports functions like `sendChatMessage()`, `sendMultimodalChat()`, `searchBooth()`, `checkRegistrationStatus()`, `setMemoryConsent()`, `exportMemory()`, `deleteMemory()`, etc.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Main text chat → Router → RAG → `ChatResponseV2` |
| `/api/chat-multimodal` | POST | Text + image + audio (multipart/JSON) → Router → `ChatResponseV2` |
| `/api/booth` | GET | Polling booth search by ward/location |
| `/api/registration` | POST | Voter registration check by EPIC/name |
| `/api/registration-status` | POST | Detailed EPIC status with polling station info |
| `/api/report` | POST | Election violation report submission |
| `/api/embeddings` | POST | Wrapper for Fireworks embedding endpoint |
| `/api/rerank` | POST | Wrapper for Fireworks reranker endpoint |
| `/api/transcribe` | POST | Wrapper for Whisper V3 (multipart audio or base64) |
| `/api/vision` | POST | Image analysis via VL model |
| `/api/voice` | POST | Voice processing pipeline |
| `/api/memory/consent` | POST/GET | Set or read memory consent preferences |
| `/api/memory/export` | GET | GDPR data export (all memories + conversations) |
| `/api/memory/delete` | DELETE | Right to erasure (delete all user data) |
| `/api/admin` | GET | Admin stats, query logs, escalations (token-protected) |
| `/api/sync_sources` | POST | Admin content source sync |
| `/api/data-access` | POST | GDPR data access request |

---

## Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| **Landing** | `/` | Welcome screen, language selector, feature intro |
| **Chat** | `/chat` | Main AI chat with sidebar, file upload, voice, quick actions |
| **Booth Locator** | `/booth` | Find polling booth by location/ward (map) |
| **Registration** | `/registration` | Check voter registration status by EPIC |
| **Report** | `/report` | Report election violations with evidence uploads |
| **FAQ** | `/faq` | Frequently asked questions (bilingual) |
| **Settings** | `/settings` | Language toggle, memory enable/disable, export/delete data |
| **Admin** | `/admin` | 6 tabs: Overview, Query Logs, Retrieval Traces, Escalations, Content Sync, Audit Log |

---

## UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `ChatInput` | `components/chat/ChatInput.tsx` | Message text input with send button |
| `MessageList` | `components/chat/MessageList.tsx` | Scrollable chat bubbles with source citations |
| `ChatSidebar` | `components/chat/ChatSidebar.tsx` | Slide-out conversation history (search, pin, star, time-ago) |
| `FileUpload` | `components/chat/FileUpload.tsx` | Drag/drop + camera + file picker with PII consent checkbox |
| `QuickActions` | `components/chat/QuickActions.tsx` | Suggested action cards (check EPIC, find booth, etc.) |
| `SystemBanner` | `components/chat/SystemBanner.tsx` | Dismissable system announcement |
| `Header` | `components/layout/Header.tsx` | App header with logo, language toggle, nav |
| `ParallaxBackground` | `components/layout/ParallaxBackground.tsx` | Animated gradient background |

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useChat` | Chat state management, send messages, typing indicator |
| `useLocale` | Language switching (en ↔ ml) with persistence |
| `useSpeechRecognition` | Browser Web Speech API for voice input |
| `useParallax` | Scroll-based parallax animation values |
| `useDeviceOrientation` | Gyroscope-based parallax on mobile devices |

---

## What You Need to Make RAG Functional

### 1. Fireworks AI API Key ⚠️ REQUIRED

This is the **single most important thing**. All 4 models run on Fireworks AI.

1. Go to [fireworks.ai](https://fireworks.ai) and create an account
2. Get your API key from the dashboard
3. Set it in `.env.local`:

```env
FIREWORKS_API_KEY=your-actual-key-here
```

**Without this key, every model call returns fallback/template responses.** The app will still work (template answers for common questions), but it won't be an AI — just a rule-based FAQ bot.

### 2. The 4 Fireworks Models

Vaakku uses these specific models (all available on Fireworks, no setup needed):

| Model | Model ID | Used For |
|-------|----------|----------|
| **Qwen3 VL 30B** | `accounts/fireworks/models/qwen3-vl-30b-a3b-thinking` | Answer generation + vision OCR |
| **Qwen3 Reranker 8B** | `accounts/fireworks/models/qwen3-reranker-8b` | Passage reranking (Stage 3) |
| **Qwen3 Embedding 8B** | `accounts/fireworks/models/qwen3-embedding-8b` | Dense embeddings (Stage 1) |
| **Whisper V3** | `accounts/fireworks/models/whisper-v3` | Audio transcription |

These IDs are already set in `.env.example`. You only change them if Fireworks renames the models.

### 3. Knowledge Base — What the RAG Searches Through

**Current state (good enough for demo/testing):**

`retriever.ts` has a **hardcoded seed knowledge base** of ~15 entries with real voter information. The RAG pipeline works end-to-end with this data. Common questions about registration, documents, booths, EVMs, and violations will get correct answers.

**For production, you need real data:**

1. **Collect official content:**
   - CEO Kerala voter guidelines, forms, procedures
   - Kottayam district polling booth data (all booths, addresses, accessibility)
   - Election Commission of India (ECI) circulars
   - SVEEP awareness material
   - FAQ from NVSP (nvsp.in)

2. **Chunk the content:** Split documents into 200-400 word passages, each with a clear source tag

3. **Embed the chunks:** Use the embedding model to convert each chunk to a vector

4. **Store in ChromaDB (vector database):**

```bash
# Run ChromaDB
docker run -p 8000:8000 chromadb/chroma
```

```env
CHROMA_URL=http://localhost:8000
```

The `chromadb` npm package is already in `package.json`. To switch from the seeded knowledge base to ChromaDB, you'd modify `retriever.ts` to query ChromaDB instead of the in-memory array.

### 4. Privacy Salt ⚠️ REQUIRED for Security

```env
HASH_SALT=generate-a-random-string-here-at-least-32-chars
```

Used for hashing all user identifiers. **Change from the default before any real deployment.**

### 5. Admin Token ⚠️ REQUIRED for Admin Panel

```env
ADMIN_API_TOKEN=your-secure-admin-token
```

Protects the admin dashboard API endpoints.

### Quick Setup Checklist

| Step | Status | Impact |
|------|--------|--------|
| Set `FIREWORKS_API_KEY` | **Required** | AI models will work (all 4 stages) |
| Change `HASH_SALT` | **Required** | PII hashing is secure |
| Change `ADMIN_API_TOKEN` | **Required** | Admin panel is protected |
| Run ChromaDB | Optional | Production vector store (PoC works without it) |
| Load real knowledge base | Optional | Better answers (PoC has seeded data) |
| Set up PostgreSQL | Optional | Persistent memory & history (PoC uses in-memory) |

**Minimum for a working demo:** Just set `FIREWORKS_API_KEY`. Everything else has sensible defaults and the seeded knowledge base covers common voter questions.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `FIREWORKS_API_KEY` | **Yes** | — | Fireworks AI API key |
| `FIREWORKS_BASE_URL` | No | `https://api.fireworks.ai` | Fireworks base URL |
| `CHAT_URL` | No | `.../v1/chat/completions` | Chat completions endpoint |
| `RERANKER_URL` | No | `.../v1/rerank` | Reranker endpoint |
| `EMBEDDING_URL` | No | `.../v1/embeddings` | Embeddings endpoint |
| `AUDIO_TRANSCRIBE_URL` | No | `.../v1/audio/transcriptions` | Whisper endpoint |
| `IMAGE_URL` | No | `.../v1/images` | Image analysis endpoint |
| `GENERATOR_MODEL` | No | `qwen3-vl-30b-a3b-thinking` | Generator model ID |
| `RERANKER_MODEL` | No | `qwen3-reranker-8b` | Reranker model ID |
| `EMBEDDING_MODEL` | No | `qwen3-embedding-8b` | Embedding model ID |
| `ASR_MODEL` | No | `whisper-v3` | Speech recognition model |
| `MAX_CONTEXT_TOKENS` | No | `6000` | Max tokens for RAG context |
| `MAX_GENERATION_TOKENS` | No | `900` | Max tokens for generation |
| `CACHE_TTL_SECONDS` | No | `86400` | Response cache TTL (24h) |
| `MEMORY_RETENTION_DAYS` | No | `90` | How long user memories persist |
| `HASH_SALT` | **Yes** | `change-me` | Salt for PII hashing |
| `ADMIN_API_TOKEN` | **Yes** | `change-me` | Admin API authentication |
| `ADMIN_EMAILS` | No | — | Comma-separated admin emails |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB vector store URL |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **npm**
- **Fireworks AI API key** (get one at [fireworks.ai](https://fireworks.ai))

### Install & Run

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local → add FIREWORKS_API_KEY, change HASH_SALT and ADMIN_API_TOKEN

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

---

## Testing

```bash
# Run all 117 tests
npm test

# Run with watch mode
npx vitest

# Run specific test file
npx vitest run tests/safety.test.ts
```

| Test File | # Tests | What it verifies |
|-----------|---------|------------------|
| `canonical-queries.test.ts` | 92 | Retriever finds relevant passages for 92 sample queries (EN + ML) |
| `safety.test.ts` | 8 | Political party detection, neutral response generation |
| `privacy.test.ts` | 8 | Aadhaar, EPIC, PAN, phone number masking |
| `retriever.test.ts` | 5 | Hybrid search, passage ranking, score merging |
| `actions.test.ts` | 4 | Quick action pattern matching |

---

## Deployment

### Docker

```bash
# Build and run with Docker Compose (includes ChromaDB)
docker compose up -d

# Or build standalone
docker build -t vaakku .
docker run -p 3000:3000 --env-file .env.local vaakku
```

### Kubernetes

```bash
kubectl create secret generic vaakku-secrets --from-env-file=.env.local
kubectl apply -f kubernetes/deployment.yaml
```

### CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
1. Lint & Test (ESLint + Vitest)
2. Build (Next.js production build)
3. Docker build & push (main branch)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| React | React 19 |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Animation | Framer Motion |
| Maps | MapLibre GL + React Map GL |
| HTTP Client | Axios |
| AI Models | Fireworks AI (Qwen3 family + Whisper V3) |
| Vector Store | ChromaDB |
| Validation | Zod |
| Testing | Vitest + Testing Library |
| Deployment | Docker + Kubernetes |
| CI/CD | GitHub Actions |

---

## Design System

### Colors
- **Primary**: Blue (#1A56DB) — trust, governance
- **Accent**: Kerala Gold (#F59E0B) — cultural identity
- **Neutrals**: Slate scale for text & backgrounds
- **Semantic**: Green (success), Red (error), Amber (warning)

### Typography
- **Latin**: Inter (variable weight)
- **Malayalam**: Noto Sans Malayalam

### Motion
- Spring animations (Framer Motion)
- 3-layer parallax background
- Staggered list transitions
- Reduced motion support via `prefers-reduced-motion`

---

## License

MIT © SVEEP Kottayam
