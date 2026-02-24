/**
 * Fireworks AI SDK Client — Centralized Model Access Layer
 * ─────────────────────────────────────────────────────────
 * All model IDs and endpoint URLs read from env vars.
 * No hardcoded model strings or URLs.
 * Includes: circuit breaker, streaming, retry, token trimming.
 */

// ── Environment-driven config ────────────────────────────────────

export function getConfig() {
  return {
    apiKey: process.env.FIREWORKS_API_KEY || '',
    baseUrl: process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai',

    // Per-endpoint URLs
    chatUrl: process.env.CHAT_URL || 'https://api.fireworks.ai/inference/v1/chat/completions',
    rerankerUrl: process.env.RERANKER_URL || 'https://api.fireworks.ai/inference/v1/rerank',
    embeddingUrl: process.env.EMBEDDING_URL || 'https://api.fireworks.ai/inference/v1/embeddings',
    audioTranscribeUrl: process.env.AUDIO_TRANSCRIBE_URL || 'https://audio-prod.api.fireworks.ai/v1/audio/transcriptions',
    imageUrl: process.env.IMAGE_URL || 'https://api.fireworks.ai/inference/v1/images',

    // Model IDs
    generatorModel: process.env.GENERATOR_MODEL || 'accounts/fireworks/models/qwen3-vl-30b-a3b-thinking',
    rerankerModel: process.env.RERANKER_MODEL || 'accounts/fireworks/models/qwen3-reranker-8b',
    embeddingModel: process.env.EMBEDDING_MODEL || 'accounts/fireworks/models/qwen3-embedding-8b',
    asrModel: process.env.ASR_MODEL || 'accounts/fireworks/models/whisper-v3',

    // Budgets & limits
    maxContextTokens: parseInt(process.env.MAX_CONTEXT_TOKENS || '6000', 10),
    maxGenerationTokens: parseInt(process.env.MAX_GENERATION_TOKENS || '1800', 10),
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10),
    memoryRetentionDays: parseInt(process.env.MEMORY_RETENTION_DAYS || '90', 10),
    modelTimeoutMs: 12_000, // 12s timeout for model calls
  };
}

// ── Circuit Breaker ──────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000; // 1 minute

function getCircuit(model: string): CircuitState {
  if (!circuits.has(model)) {
    circuits.set(model, { failures: 0, lastFailure: 0, open: false });
  }
  return circuits.get(model)!;
}

function recordSuccess(model: string) {
  const c = getCircuit(model);
  c.failures = 0;
  c.open = false;
}

function recordFailure(model: string) {
  const c = getCircuit(model);
  c.failures++;
  c.lastFailure = Date.now();
  if (c.failures >= CIRCUIT_THRESHOLD) {
    c.open = true;
  }
}

function isCircuitOpen(model: string): boolean {
  const c = getCircuit(model);
  if (c.open && Date.now() - c.lastFailure > CIRCUIT_RESET_MS) {
    c.open = false; // half-open — allow retry
    c.failures = 0;
  }
  return c.open;
}

// ── Retry helper with exponential backoff ────────────────────────

const TRANSIENT_STATUS_CODES = new Set([429, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000; // 1s, 2s, 4s

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);

      // Only retry on transient HTTP errors
      const isTransient = TRANSIENT_STATUS_CODES.has(
        parseInt(msg.match(/\b(429|502|503)\b/)?.[1] || '0', 10)
      );

      if (!isTransient || attempt === MAX_RETRIES) throw err;

      const delay = BASE_DELAY_MS * 2 ** attempt; // 1s, 2s, 4s
      console.warn(
        `[fireworks] ${label} attempt ${attempt + 1} failed (${msg}), retrying in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr; // unreachable but satisfies TS
}

// ── Headers helper ───────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error('FIREWORKS_API_KEY not configured');
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  };
}

// ── Chat Completions (text-only or multimodal) ───────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContent[];
}

export interface MultimodalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  text: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  finishReason: string;
}

/**
 * Non-streaming chat completion
 */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const cfg = getConfig();
  const model = opts.model || cfg.generatorModel;

  if (isCircuitOpen(model)) {
    throw new Error(`Circuit breaker open for model ${model}`);
  }

  return withRetry(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cfg.modelTimeoutMs);
      const signal = opts.signal
        ? opts.signal
        : controller.signal;

      const response = await fetch(cfg.chatUrl, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model,
          messages: opts.messages,
          max_tokens: opts.maxTokens ?? cfg.maxGenerationTokens,
          temperature: opts.temperature ?? 0.3,
          top_p: opts.topP ?? 0.9,
          stream: false,
        }),
        signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Fireworks ${response.status}: ${errText}`);
      }

      const data = await response.json();
      recordSuccess(model);

      return {
        text: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        model,
        finishReason: data.choices?.[0]?.finish_reason || 'unknown',
      };
    } catch (err) {
      recordFailure(model);
      throw err;
    }
  }, 'chatCompletion');
}

/**
 * Streaming chat completion — returns ReadableStream of text chunks
 */
export async function chatCompletionStream(
  opts: ChatCompletionOptions
): Promise<ReadableStream<string>> {
  const cfg = getConfig();
  const model = opts.model || cfg.generatorModel;

  if (isCircuitOpen(model)) {
    throw new Error(`Circuit breaker open for model ${model}`);
  }

  const response = await fetch(cfg.chatUrl, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? cfg.maxGenerationTokens,
      temperature: opts.temperature ?? 0.3,
      top_p: opts.topP ?? 0.9,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    recordFailure(model);
    throw new Error(`Fireworks stream error: ${response.status}`);
  }

  recordSuccess(model);
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(delta);
              } catch {
                // skip malformed chunk
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// ── Embeddings ───────────────────────────────────────────────────

export interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
  model: string;
}

/**
 * Generate embeddings for one or more texts
 */
export async function createEmbeddings(
  texts: string[],
  model?: string
): Promise<EmbeddingResult> {
  const cfg = getConfig();
  const embModel = model || cfg.embeddingModel;

  if (isCircuitOpen(embModel)) {
    throw new Error(`Circuit breaker open for model ${embModel}`);
  }

  return withRetry(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cfg.modelTimeoutMs);

      const response = await fetch(cfg.embeddingUrl, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model: embModel,
          input: texts,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Fireworks embeddings ${response.status}: ${errText}`);
      }

      const data = await response.json();
      recordSuccess(embModel);

      return {
        embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
        tokensUsed: data.usage?.total_tokens || 0,
        model: embModel,
      };
    } catch (err) {
      recordFailure(embModel);
      throw err;
    }
  }, 'createEmbeddings');
}

// ── Audio Transcription (Whisper V3) ─────────────────────────────

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  model: string;
}

/**
 * Transcribe audio using Whisper V3
 * Accepts a Buffer or Blob of audio data.
 */
export async function transcribeAudio(
  audioData: Buffer | Blob,
  filename: string = 'audio.webm'
): Promise<TranscriptionResult> {
  const cfg = getConfig();
  const asrModel = cfg.asrModel;

  if (isCircuitOpen(asrModel)) {
    throw new Error(`Circuit breaker open for model ${asrModel}`);
  }

  return withRetry(async () => {
    try {
      const formData = new FormData();
      const blob =
        audioData instanceof Blob ? audioData : new Blob([new Uint8Array(audioData)], { type: 'audio/webm' });
      formData.append('file', blob, filename);
      formData.append('model', asrModel);
      formData.append('response_format', 'verbose_json');

      const response = await fetch(cfg.audioTranscribeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          // No Content-Type — FormData sets boundary automatically
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Fireworks ASR ${response.status}: ${errText}`);
      }

      const data = await response.json();
      recordSuccess(asrModel);

      return {
        text: data.text || '',
        language: data.language || 'unknown',
        duration: data.duration || 0,
        model: asrModel,
      };
    } catch (err) {
      recordFailure(asrModel);
      throw err;
    }
  }, 'transcribeAudio');
}

// ── Token Estimation ─────────────────────────────────────────────

/**
 * Rough token estimate. ~1.3 tokens per whitespace-delimited word.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

/**
 * Trim text to fit within a token budget
 */
export function trimToTokenBudget(text: string, maxTokens: number): string {
  const words = text.split(/\s+/);
  const maxWords = Math.floor(maxTokens / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

// ── Response Cache ───────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class ResponseCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds?: number) {
    const cfg = getConfig();
    this.ttlMs = (ttlSeconds ?? cfg.cacheTtlSeconds) * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
