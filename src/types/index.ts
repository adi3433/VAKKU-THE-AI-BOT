/**
 * Vaakku — Shared TypeScript Types
 * ─────────────────────────────────
 * Canonical types for the chat protocol, API contracts,
 * and domain models.
 */

// ── Locale ────────────────────────────────────────────────────────
export type Locale = 'en' | 'ml';

// ── Chat Protocol ─────────────────────────────────────────────────
export interface ChatSource {
  title: string;
  url: string;
  lastUpdated: string; // ISO 8601
  excerpt: string;
}

export interface ChatResponse {
  text: string;
  confidence: number; // 0–1
  sources: ChatSource[];
  actionable: ActionItem[];
  escalate: boolean;
  locale: Locale;
  messageId: string;
  timestamp: string; // ISO 8601
}

export interface ChatRequest {
  message: string;
  locale: Locale;
  sessionId: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  locale: Locale;
  timestamp: string;
  confidence?: number;
  sources?: ChatSource[];
  actionable?: ActionItem[];
  escalate?: boolean;
}

export interface ActionItem {
  id: string;
  label: string;
  labelMl?: string;
  icon: string; // Heroicon name
  action: 'check_epic' | 'locate_booth' | 'report_violation' | 'faq' | 'escalate' | 'custom';
  payload?: Record<string, unknown>;
}

// ── Booth / Polling ───────────────────────────────────────────────
export interface BoothInfo {
  boothId: string;
  boothName: string;
  boothNameMl: string;
  address: string;
  addressMl: string;
  latitude: number;
  longitude: number;
  constituency: string;
  ward: string;
  facilities: string[];
  accessibility: boolean;
}

export interface BoothSearchRequest {
  voterId?: string;
  pincode?: string;
  constituencyName?: string;
}

export interface BoothSearchResponse {
  booths: BoothInfo[];
  matchedVoter?: VoterSummary;
  confidence: number;
  source: ChatSource;
}

// ── Voter ─────────────────────────────────────────────────────────
export interface VoterSummary {
  epicNumber: string;
  name: string;
  nameMl: string;
  constituency: string;
  boothId: string;
  status: 'active' | 'pending' | 'not_found';
}

export interface RegistrationCheckRequest {
  voterId?: string;
  name?: string;
  dob?: string; // YYYY-MM-DD
  constituency?: string;
}

export interface RegistrationCheckResponse {
  voter: VoterSummary | null;
  confidence: number;
  sources: ChatSource[];
  message: string;
  messageMl: string;
}

// ── Violation Report ──────────────────────────────────────────────
export interface ViolationReport {
  id: string;
  type: 'bribery' | 'intimidation' | 'misinformation' | 'polling_irregularity' | 'other';
  description: string;
  descriptionMl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  media?: ViolationMedia[];
  reporterHashedId: string;
  timestamp: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'dismissed';
  referenceNumber: string;
}

export interface ViolationMedia {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  sizeBytes: number;
}

export interface ViolationReportRequest {
  type: ViolationReport['type'];
  description: string;
  location?: { latitude: number; longitude: number; address?: string };
  mediaIds?: string[];
  locale: Locale;
}

export interface ViolationReportResponse {
  referenceNumber: string;
  status: 'submitted';
  message: string;
  messageMl: string;
}

// ── Admin ─────────────────────────────────────────────────────────
export interface AdminSyncRequest {
  sourceType: 'voter_roll' | 'booth_data' | 'faq' | 'circular';
  sourceUrl?: string;
  data?: unknown;
}

export interface AdminSyncResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  recordsProcessed?: number;
  errors?: string[];
}

export interface QueryLog {
  id: string;
  sessionId: string;
  query: string;
  locale: Locale;
  response: string;
  confidence: number;
  sources: ChatSource[];
  escalated: boolean;
  timestamp: string;
  latencyMs: number;
  retrievalScore?: number;
}

export interface AuditLogEntry {
  id: string;
  action: 'data_access' | 'data_deletion' | 'admin_sync' | 'escalation' | 'pii_redaction';
  actorId: string;
  targetId?: string;
  details: string;
  timestamp: string;
}

// ── Privacy / GDPR ────────────────────────────────────────────────
export interface DataAccessRequest {
  userId: string;
  type: 'export' | 'delete';
}

export interface DataAccessResponse {
  requestId: string;
  status: 'processing' | 'completed';
  downloadUrl?: string;
  message: string;
}

// ── RAG / Retrieval ───────────────────────────────────────────────
export interface RetrievedPassage {
  id: string;
  content: string;
  metadata: {
    source: string;
    url: string;
    lastUpdated: string;
    pageNumber?: number;
    section?: string;
  };
  score: number;
  method: 'vector' | 'bm25' | 'hybrid';
}

export interface RetrievalResult {
  passages: RetrievedPassage[];
  totalTokens: number;
  queryEmbeddingLatencyMs: number;
  retrievalLatencyMs: number;
}

// ── Session ───────────────────────────────────────────────────────
export interface UserSession {
  sessionId: string;
  locale: Locale;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  escalated: boolean;
}

// ── Retrieval Trace (per-chunk audit) ─────────────────────────────
export interface RetrievalTraceEntry {
  docId: string;
  chunkId: string;
  similarityScore: number;
  rerankerScore: number;
}

// ── Enhanced Chat Response (V2 output schema) ─────────────────────
export interface ChatResponseV2 extends ChatResponse {
  retrievalTrace: RetrievalTraceEntry[];
  extractedFields?: Record<string, string>;
  promptVersionHash?: string;
  generatorModel?: string;
  routerType?: string;
  modality?: string;
}

// ── Memory / Persistent User State ────────────────────────────────
export type MemoryType = 'profile' | 'preferences' | 'saved_docs';

export interface MemoryEntry {
  id: string;
  userId: string;
  type: MemoryType;
  key: string;
  value: string;
  locale: Locale;
  createdAt: string;
  expiresAt: string; // after MEMORY_RETENTION_DAYS
  redacted: boolean;
}

export interface MemoryConsentRequest {
  userId: string;
  enabled: boolean;
  allowedTypes: MemoryType[];
}

export interface MemoryConsentResponse {
  userId: string;
  memoryEnabled: boolean;
  allowedTypes: MemoryType[];
  updatedAt: string;
}

export interface MemoryExportResponse {
  userId: string;
  exportedAt: string;
  entries: MemoryEntry[];
  conversations: StoredConversation[];
}

// ── Stored Chat History ───────────────────────────────────────────
export interface StoredConversation {
  id: string;
  sessionId: string;
  userId: string;
  title: string;
  summary: string;
  locale: Locale;
  messages: ChatMessage[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  pinned: boolean;
  escalated: boolean;
  tags: string[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  summary: string;
  locale: Locale;
  messageCount: number;
  updatedAt: string;
  starred: boolean;
  pinned: boolean;
  escalated: boolean;
}

export interface ConversationSearchParams {
  query?: string;
  locale?: Locale;
  starred?: boolean;
  escalated?: boolean;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}

// ── Multimodal Chat Request ───────────────────────────────────────
export interface MultimodalChatRequest {
  message?: string;
  locale: Locale;
  sessionId: string;
  conversationHistory?: ChatMessage[];
  /** Base64-encoded image data (without data: prefix) */
  imageBase64?: string;
  imageMimeType?: string;
  /** Base64-encoded audio data */
  audioBase64?: string;
  audioMimeType?: string;
  /** Context mode: full (include memory) or ephemeral */
  contextMode?: 'full' | 'ephemeral';
  /** Optional userId for memory context */
  userId?: string;
}

// ── File Upload ───────────────────────────────────────────────────
export interface FileUploadResult {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Server-side OCR or extraction results, if computed */
  ocrFields?: Record<string, string>;
  ocrConfidence?: number;
  /** Whether the user consented to store the file */
  stored: boolean;
  /** Fields suggested for redaction */
  redactionSuggestions: string[];
}

// ── Registration Status ───────────────────────────────────────────
export interface RegistrationStatusRequest {
  epicNumber?: string;
  name?: string;
  dob?: string;
  constituency?: string;
  partNumber?: string;
}

export interface RegistrationStatusResponse {
  found: boolean;
  status?: string;
  voter?: VoterSummary | null;
  voterDetails?: {
    epicNumber: string;
    constituencyName: string;
    constituencyCode: string;
    assemblyConstituency: string;
    pollingStation: string;
    boothNumber: number;
    partNumber: number;
    serialNumber: number;
  };
  actionItems?: {
    id: string;
    label: string;
    labelMl?: string;
    icon: string;
    action: string;
  }[];
  sources?: ChatSource[];
  message: string;
  messageMl: string;
  checkedAt?: string;
}
