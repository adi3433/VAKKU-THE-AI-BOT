/**
 * Vaakku — API Client V2.1
 * ─────────────────────────
 * Typed fetch wrappers that hit Next.js API routes.
 * V2.1: multimodal chat, embeddings, rerank, transcribe, memory, registration-status.
 */
import axios from 'axios';
import type {
  ChatRequest,
  ChatResponse,
  ChatResponseV2,
  BoothSearchRequest,
  BoothSearchResponse,
  ViolationReportRequest,
  ViolationReportResponse,
  RegistrationCheckRequest,
  RegistrationCheckResponse,
  RegistrationStatusRequest,
  RegistrationStatusResponse,
  AdminSyncRequest,
  AdminSyncResponse,
  DataAccessRequest,
  DataAccessResponse,
  MultimodalChatRequest,
  MemoryConsentRequest,
  MemoryConsentResponse,
  MemoryExportResponse,
  ConversationListItem,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Chat ──────────────────────────────────────────────────────────
export async function sendChatMessage(req: ChatRequest & { userId?: string }): Promise<ChatResponseV2> {
  const { data } = await api.post<ChatResponseV2>('/chat', req);
  return data;
}

// ── Multimodal Chat ───────────────────────────────────────────────
export async function sendMultimodalChat(req: MultimodalChatRequest): Promise<ChatResponseV2> {
  const { data } = await api.post<ChatResponseV2>('/chat-multimodal', req);
  return data;
}

// ── Booth Locator ─────────────────────────────────────────────────
export async function searchBooth(req: BoothSearchRequest): Promise<BoothSearchResponse> {
  const { data } = await api.get<BoothSearchResponse>('/booth', { params: req });
  return data;
}

// ── Registration Check ────────────────────────────────────────────
export async function checkRegistration(req: RegistrationCheckRequest): Promise<RegistrationCheckResponse> {
  const { data } = await api.post<RegistrationCheckResponse>('/registration', req);
  return data;
}

// ── Registration Status ───────────────────────────────────────────
export async function checkRegistrationStatus(req: RegistrationStatusRequest): Promise<RegistrationStatusResponse> {
  const { data } = await api.post<RegistrationStatusResponse>('/registration-status', req);
  return data;
}

// ── Violation Report ──────────────────────────────────────────────
export async function submitViolationReport(req: ViolationReportRequest): Promise<ViolationReportResponse> {
  const { data } = await api.post<ViolationReportResponse>('/report', req);
  return data;
}

// ── Embeddings ────────────────────────────────────────────────────
export async function createEmbeddingsApi(texts: string[]): Promise<{ embeddings: number[][]; model: string }> {
  const { data } = await api.post('/embeddings', { texts });
  return data;
}

// ── Rerank ────────────────────────────────────────────────────────
export async function rerankDocuments(
  query: string,
  documents: string[],
  topN?: number
): Promise<{ results: Array<{ index: number; relevanceScore: number; document: string }> }> {
  const { data } = await api.post('/rerank', { query, documents, topN });
  return data;
}

// ── Transcribe ────────────────────────────────────────────────────
export async function transcribeAudioApi(
  audioBase64: string
): Promise<{ transcript: string; locale: string; duration?: number; latencyMs: number }> {
  const { data } = await api.post('/transcribe', { audioBase64 });
  return data;
}

// ── Memory Consent ────────────────────────────────────────────────
export async function setMemoryConsent(req: MemoryConsentRequest): Promise<MemoryConsentResponse> {
  const { data } = await api.post<MemoryConsentResponse>('/memory/consent', req);
  return data;
}

export async function getMemoryConsent(userId: string): Promise<{ enabled: boolean; allowedTypes: string[] }> {
  const { data } = await api.get('/memory/consent', { params: { userId } });
  return data;
}

// ── Memory Export ─────────────────────────────────────────────────
export async function exportMemory(userId: string): Promise<MemoryExportResponse> {
  const { data } = await api.get<MemoryExportResponse>('/memory/export', { params: { userId } });
  return data;
}

// ── Memory Delete ─────────────────────────────────────────────────
export async function deleteMemory(userId: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete('/memory/delete', { data: { userId } });
  return data;
}

// ── Admin Sync ────────────────────────────────────────────────────
export async function syncSources(req: AdminSyncRequest): Promise<AdminSyncResponse> {
  const { data } = await api.post<AdminSyncResponse>('/sync_sources', req);
  return data;
}

// ── Data Access (GDPR) ───────────────────────────────────────────
export async function requestDataAccess(req: DataAccessRequest): Promise<DataAccessResponse> {
  const { data } = await api.post<DataAccessResponse>('/data-access', req);
  return data;
}

export default api;
