import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import TelemetryCard from './components/TelemetryCard';
import IngestionForm from './components/IngestionForm';
import JobProgress from './components/JobProgress';
import ResultViewer from './components/ResultViewer';
import HistoryDrawer from './components/HistoryDrawer';
import STMModal from './components/STMModal';
import {
  submitTextJob, submitAudioJob, submitVideoJob, submitOCRJob,
  pollJob, fetchSystemStats,
} from './services/api';
import type { JobStatus, PipelineResult, SystemStats, InferenceRecord } from './services/api';

type AppView = 'input' | 'processing' | 'result';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [view, setView] = useState<AppView>('input');

  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [currentResult, setCurrentResult] = useState<PipelineResult | null>(null);
  const [currentJobType, setCurrentJobType] = useState('text');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [stmOpen, setSTMOpen] = useState(false);

  const [stats, setStats] = useState<SystemStats>({
    cpu_percent: 0, ram_used_gb: 0, ram_total_gb: 16,
    ram_percent: 0, disk_used_gb: 0, disk_total_gb: 0, disk_percent: 0,
  });

  const [logs, setLogs] = useState<string[]>(['System ready.']);
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);

  // ---- Dark mode ----
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // ---- Telemetry polling ----
  useEffect(() => {
    const poll = async () => {
      try { setStats(await fetchSystemStats()); } catch {}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  // ---- Job submission ----
  const handleSubmit = async (payload: {
    type: string | null; file: File | null; rawText: string; targetLanguage: string;
  }) => {
    if (!payload.type) return;
    try {
      let response;
      if (payload.type === 'text') {
        addLog(`Text → ${payload.targetLanguage}`);
        response = await submitTextJob(payload.rawText, payload.targetLanguage);
      } else if (payload.type === 'audio' && payload.file) {
        addLog(`Audio: ${payload.file.name}`);
        response = await submitAudioJob(payload.file, payload.targetLanguage);
      } else if (payload.type === 'video' && payload.file) {
        addLog(`Video: ${payload.file.name}`);
        response = await submitVideoJob(payload.file, payload.targetLanguage);
      } else if (payload.type === 'ocr' && payload.file) {
        addLog(`OCR: ${payload.file.name}`);
        response = await submitOCRJob(payload.file, payload.targetLanguage);
      } else return;

      setCurrentJobType(payload.type);
      addLog(`Queued #${response.job_id}`);
      setCurrentJob({
        job_id: response.job_id, type: payload.type,
        target_language: payload.targetLanguage,
        status: 'queued', progress: 0, stage: 'Queued',
        created_at: new Date().toISOString(),
      });
      setView('processing');
      startPolling(response.job_id);
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
  };

  // ---- Job polling ----
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(jobId);
        setCurrentJob(job);
        if (job.status === 'complete') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setCurrentResult(job.result || null);
          setView('result');
          addLog(`#${jobId} complete`);
        } else if (job.status === 'error') {
          clearInterval(pollRef.current!); pollRef.current = null;
          addLog(`#${jobId} failed: ${job.error}`);
        }
      } catch {}
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ---- Navigation ----
  const handleBack = () => { setView('input'); setCurrentJob(null); setCurrentResult(null); };

  const handleHistorySelect = (rec: InferenceRecord) => {
    setHistoryOpen(false);
    setCurrentResult({
      status: 'success',
      original_text: rec.original_text,
      translated_text: rec.translated_text,
      audio_url: rec.audio_url || undefined,
      video_url: rec.video_url || undefined,
    });
    setCurrentJobType(rec.input_type);
    setView('result');
    addLog(`Loaded history #${rec.id}`);
  };

  const muted = darkMode ? 'text-zinc-600' : 'text-zinc-400';

  return (
    <div className={`flex h-screen transition-colors duration-200 ${
      darkMode ? 'bg-[#09090f] text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      {/* ==========================================
          SIDEBAR
          ========================================== */}
      <aside className={`w-56 flex flex-col border-r shrink-0 transition-colors ${
        darkMode ? 'bg-[#0c0c14] border-white/[0.06]' : 'bg-white border-black/[0.06]'
      }`}>
        {/* Logo */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-indigo-600 rounded-md flex items-center justify-center text-white text-[10px] font-extrabold">B</div>
            <span className="text-xs font-semibold tracking-tight">Bhasha Node</span>
          </div>
        </div>

        <div className={`mx-3 h-px ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />

        {/* Telemetry */}
        <div className="p-4">
          <TelemetryCard darkMode={darkMode} stats={stats} />
        </div>

        <div className={`mx-3 h-px ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />

        {/* Event log */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <h3 className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${muted}`}>Log</h3>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {logs.map((log, i) => (
              <p key={i} className={`text-[9px] font-mono leading-relaxed ${
                i === 0
                  ? log.includes('Error') ? 'text-red-400' : darkMode ? 'text-zinc-400' : 'text-zinc-600'
                  : darkMode ? 'text-zinc-600' : 'text-zinc-400'
              }`}>{log}</p>
            ))}
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN
          ========================================== */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSTM={() => setSTMOpen(true)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Title */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">
                {view === 'input' ? 'New Inference' :
                 view === 'processing' ? 'Processing' :
                 'Result'}
              </h2>
              <p className={`text-xs mt-0.5 ${muted}`}>
                {view === 'input'
                  ? 'Upload a document, record audio, or paste text.'
                  : view === 'processing'
                    ? 'Running on local AI models.'
                    : 'Processed 100% offline.'}
              </p>
            </div>

            {view === 'input' && (
              <IngestionForm darkMode={darkMode} onSubmit={handleSubmit} isDisabled={false} />
            )}
            {view === 'processing' && currentJob && (
              <JobProgress darkMode={darkMode} job={currentJob} />
            )}
            {view === 'result' && currentResult && (
              <ResultViewer darkMode={darkMode} result={currentResult} jobType={currentJobType} onBack={handleBack} />
            )}
          </div>
        </div>
      </main>

      {/* ==========================================
          OVERLAYS
          ========================================== */}
      <HistoryDrawer darkMode={darkMode} isOpen={historyOpen} onClose={() => setHistoryOpen(false)} onSelectRecord={handleHistorySelect} />
      <STMModal darkMode={darkMode} isOpen={stmOpen} onClose={() => setSTMOpen(false)} />
    </div>
  );
}