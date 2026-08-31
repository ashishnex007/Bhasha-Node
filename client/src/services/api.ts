/**
 * Bhasha Node - API Client Service
 * Typed wrappers for all backend endpoints.
 */

const API_BASE = "http://127.0.0.1:8000";

// ==========================================
// TYPES
// ==========================================
export interface JobSubmitResponse {
  job_id: string;
  status: string;
}

export interface JobStatus {
  job_id: string;
  type: string;
  target_language: string;
  status: "queued" | "processing" | "complete" | "error";
  progress: number;
  stage: string;
  error?: string;
  created_at: string;
  completed_at?: string;
  result?: PipelineResult;
  result_json?: string;
  // client-side enrichment (set at submit time, not from server)
  source_file_name?: string;
  source_lang_hint?: string;
}

export interface PipelineResult {
  status: string;
  original_text?: string;
  translated_text?: string;
  audio_url?: string;
  video_url?: string;
  detected_source_language?: string;
  inference_time_sec?: number;
  model_used?: string;
}

export interface InferenceRecord {
  id: number;
  job_id: string;
  input_type: string;
  original_text: string;
  translated_text: string;
  audio_url: string;
  video_url: string;
  file_name: string;
  target_language: string;
  created_at: string;
}

export interface HistoryResponse {
  items: InferenceRecord[];
  total: number;
}

export interface STMTerm {
  id: number;
  source_term: string;
  target_term: string;
  target_language: string;
  domain: string;
  created_at: string;
}

export interface SystemStats {
  cpu_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
}

// ==========================================
// JOB SUBMISSION
// ==========================================
export async function submitTextJob(text: string, targetLanguage: string): Promise<JobSubmitResponse> {
  const res = await fetch(`${API_BASE}/api/jobs/submit/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target_language: targetLanguage }),
  });
  if (!res.ok) throw new Error("Failed to submit text job");
  return res.json();
}

export async function submitAudioJob(file: File, targetLanguage: string): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("target_language", targetLanguage);
  fd.append("audio_file", file);
  const res = await fetch(`${API_BASE}/api/jobs/submit/audio`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to submit audio job");
  return res.json();
}

export async function submitVideoJob(file: File, targetLanguage: string): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("target_language", targetLanguage);
  fd.append("video_file", file);
  const res = await fetch(`${API_BASE}/api/jobs/submit/video`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to submit video job");
  return res.json();
}

export async function submitOCRJob(file: File, targetLanguage: string): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("target_language", targetLanguage);
  fd.append("ocr_file", file);
  const res = await fetch(`${API_BASE}/api/jobs/submit/ocr`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to submit OCR job");
  return res.json();
}

// ==========================================
// JOB POLLING
// ==========================================
export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch job status");
  return res.json();
}

// ==========================================
// HISTORY
// ==========================================
export async function fetchHistory(limit = 50, offset = 0): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function deleteInference(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE" });
}

// ==========================================
// STM
// ==========================================
export async function fetchSTMTerms(targetLanguage = ""): Promise<{ terms: STMTerm[] }> {
  const url = targetLanguage
    ? `${API_BASE}/api/stm/terms?target_language=${targetLanguage}`
    : `${API_BASE}/api/stm/terms`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch STM terms");
  return res.json();
}

export async function addSTMTerm(
  sourceTerm: string, targetTerm: string, targetLanguage: string, domain = "agriculture"
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/stm/terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_term: sourceTerm,
      target_term: targetTerm,
      target_language: targetLanguage,
      domain,
    }),
  });
  if (!res.ok) throw new Error("Failed to save word to dictionary");
}

export async function deleteSTMTerm(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/stm/terms/${id}`, { method: "DELETE" });
}

// ==========================================
// SYSTEM TELEMETRY
// ==========================================
export async function fetchSystemStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/api/system/stats`);
  if (!res.ok) throw new Error("Failed to fetch system stats");
  return res.json();
}

// ==========================================
// KNOWLEDGE ASSISTANT (RAG)
// ==========================================
export interface KnowledgeSource {
  id?: number;
  source: string;
  input_type: string;
  content_type: string;
  score: number;
  text: string;
  full_text?: string;
}

export interface AskKnowledgeResponse {
  answer: string;
  answer_en?: string;
  detected_language: string;
  sources: KnowledgeSource[];
  audio_url?: string | null;
  latency_sec: number;
  model_used: string;
}

export interface KnowledgeStatusResponse {
  indexed_chunks: number;
  indexed_documents: number;
  model_available: boolean;
  model_loaded: boolean;
  model_path: string;
  is_ready: boolean;
}

export async function askKnowledge(
  question: string,
  history: { role: string; content: string }[] = [],
  generateAudio = false
): Promise<AskKnowledgeResponse> {
  const res = await fetch(`${API_BASE}/api/knowledge/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      history,
      generate_audio: generateAudio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to query Knowledge Assistant" }));
    throw new Error(err.detail || "Failed to query Knowledge Assistant");
  }
  return res.json();
}

export async function rebuildKnowledgeIndex(): Promise<{ indexed_chunks: number; message: string }> {
  const res = await fetch(`${API_BASE}/api/knowledge/rebuild`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to rebuild knowledge base index");
  return res.json();
}

export async function fetchKnowledgeStatus(): Promise<KnowledgeStatusResponse> {
  const res = await fetch(`${API_BASE}/api/knowledge/status`);
  if (!res.ok) throw new Error("Failed to fetch knowledge status");
  return res.json();
}

export async function synthesizeChatAudio(text: string, language: string): Promise<{ audio_url: string }> {
  const res = await fetch(`${API_BASE}/api/knowledge/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error("Voice synthesis failed for chat message");
  return res.json();
}
