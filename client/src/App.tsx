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
        response = await submitTextJob(payload.rawText, payload.targetLanguage);
      } else if (payload.type === 'audio' && payload.file) {
        response = await submitAudioJob(payload.file, payload.targetLanguage);
      } else if (payload.type === 'video' && payload.file) {
        response = await submitVideoJob(payload.file, payload.targetLanguage);
      } else if (payload.type === 'ocr' && payload.file) {
        response = await submitOCRJob(payload.file, payload.targetLanguage);
      } else return;

      setCurrentJobType(payload.type);
      setCurrentJob({
        job_id: response.job_id, type: payload.type,
        target_language: payload.targetLanguage,
        status: 'queued', progress: 0, stage: 'Queued',
        created_at: new Date().toISOString(),
      });
      setView('processing');
      startPolling(response.job_id);
    } catch (e: any) {
      alert(`Could not start translation: ${e.message}`);
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
        } else if (job.status === 'error') {
          clearInterval(pollRef.current!); pollRef.current = null;
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
  };

  // ---- View title labels ----
  const viewTitle = view === 'input' ? 'Translate Now'
    : view === 'processing' ? 'Working…'
    : 'Result';
  const viewSub = view === 'input' ? 'Upload a file, record audio, or type text below.'
    : view === 'processing' ? 'Using local AI — no internet needed.'
    : 'Translation complete — 100% offline.';

  return (
    <div className={`flex h-screen transition-colors duration-200 ${
      darkMode ? 'bg-[#09090f] text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>

      {/* ==========================================
          SIDEBAR — system stats only
          ========================================== */}
      <aside className={`w-52 flex flex-col border-r shrink-0 transition-colors ${
        darkMode ? 'bg-[#0c0c14] border-white/[0.06]' : 'bg-white border-black/[0.06]'
      }`}>
        {/* Logo */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shadow-md shadow-indigo-600/20">B</div>
            <span className="text-sm font-bold tracking-tight">Bhasha Node</span>
          </div>
        </div>

        <div className={`mx-4 h-px ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />

        {/* Telemetry */}
        <div className="p-4">
          <TelemetryCard darkMode={darkMode} stats={stats} />
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
            {/* Page title */}
            <div className="mb-7">
              <h2 className="text-xl font-bold tracking-tight">{viewTitle}</h2>
              <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{viewSub}</p>
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