import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import Header from './components/Header';
import TelemetryCard from './components/TelemetryCard';
import ActivityLog from './components/ActivityLog';
import IngestionForm from './components/IngestionForm';
import JobProgress from './components/JobProgress';
import ResultViewer from './components/ResultViewer';
import HistoryDrawer from './components/HistoryDrawer';
import STMModal from './components/STMModal';
import LanguagePopup from './components/LanguagePopup';
import KnowledgeAssistant from './components/KnowledgeAssistant';

import { useLanguage } from './i18n/LanguageContext';

import {
  submitTextJob,
  submitAudioJob,
  submitVideoJob,
  submitOCRJob,
  pollJob,
  fetchSystemStats,
} from './services/api';

import type {
  JobStatus,
  PipelineResult,
  SystemStats,
  InferenceRecord,
} from './services/api';

type AppView = 'input' | 'processing' | 'result';

export default function App() {
  const {
    t,
    hasSelectedLanguage,
  } = useLanguage();

  // ==========================================
  // STATE
  // ==========================================

  const [darkMode, setDarkMode] = useState(true);

  const [activeMode, setActiveMode] = useState<'translate' | 'knowledge'>('translate');

  const [view, setView] = useState<AppView>('input');

  const [currentJob, setCurrentJob] =
    useState<JobStatus | null>(null);

  const [currentResult, setCurrentResult] =
    useState<PipelineResult | null>(null);

  const [currentJobType, setCurrentJobType] =
    useState('text');

  const [detectedLanguage, setDetectedLanguage] =
    useState<string | undefined>(undefined);

  const [originalVideoUrl, setOriginalVideoUrl] =
    useState<string | undefined>(undefined);

  const pollRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const [historyOpen, setHistoryOpen] =
    useState(false);

  const [stmOpen, setSTMOpen] =
    useState(false);

  // ==========================================
  // LANGUAGE SELECTOR
  // ==========================================

  const [langSelectorOpen, setLangSelectorOpen] =
  useState(() => {
    return (
      localStorage.getItem(
        'bhasha_language_selected'
      ) !== 'true'
    );
  });

  // ==========================================
  // SYSTEM TELEMETRY
  // ==========================================

  const [serverLive, setServerLive] =
    useState(false);

  const [stats, setStats] =
    useState<SystemStats>({
      cpu_percent: 0,
      ram_used_gb: 0,
      ram_total_gb: 16,
      ram_percent: 0,
      disk_used_gb: 0,
      disk_total_gb: 0,
      disk_percent: 0,
    });

  // ==========================================
  // DARK MODE
  // ==========================================

  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      darkMode
    );
  }, [darkMode]);

  // ==========================================
  // TELEMETRY POLLING
  // ==========================================

  useEffect(() => {
    let failCount = 0;

    const poll = async () => {
      try {
        const data = await fetchSystemStats();

        setStats(data);
        setServerLive(true);
        failCount = 0;
      } catch {
        failCount++;

        if (failCount >= 3) {
          setServerLive(false);
        }
      }
    };

    poll();

    const id = setInterval(
      poll,
      2000
    );

    return () => {
      clearInterval(id);
    };
  }, []);

  // ==========================================
  // JOB POLLING
  // ==========================================

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollRef.current) {
        clearInterval(
          pollRef.current
        );
      }

      pollRef.current =
        setInterval(
          async () => {
            try {
              const job =
                await pollJob(jobId);

              setCurrentJob(job);

              if (
                job.status ===
                'complete'
              ) {
                clearInterval(
                  pollRef.current!
                );

                pollRef.current =
                  null;

                setCurrentResult(
                  job.result || null
                );

                setDetectedLanguage(
                  job.result
                    ?.detected_source_language
                );

                setView(
                  'result'
                );
              } else if (
                job.status ===
                'error'
              ) {
                clearInterval(
                  pollRef.current!
                );

                pollRef.current =
                  null;
              }
            } catch {
              // Keep polling.
            }
          },
          1000
        );
    },
    []
  );

  // ==========================================
  // CLEANUP POLLING
  // ==========================================

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(
          pollRef.current
        );
      }
    };
  }, []);

  // ==========================================
  // JOB SUBMISSION
  // ==========================================

  const handleSubmit =
    async (payload: {
      type: string | null;
      file: File | null;
      rawText: string;
      targetLanguage: string;
      originalVideoUrl?: string;
    }) => {
      if (!payload.type) {
        return;
      }

      setOriginalVideoUrl(
        payload.originalVideoUrl
      );

      try {
        let response;

        // TEXT
        if (
          payload.type ===
          'text'
        ) {
          response =
            await submitTextJob(
              payload.rawText,
              payload.targetLanguage
            );
        }

        // AUDIO
        else if (
          payload.type ===
            'audio' &&
          payload.file
        ) {
          response =
            await submitAudioJob(
              payload.file,
              payload.targetLanguage
            );
        }

        // VIDEO
        else if (
          payload.type ===
            'video' &&
          payload.file
        ) {
          response =
            await submitVideoJob(
              payload.file,
              payload.targetLanguage
            );
        }

        // OCR
        else if (
          payload.type ===
            'ocr' &&
          payload.file
        ) {
          response =
            await submitOCRJob(
              payload.file,
              payload.targetLanguage
            );
        }

        else {
          return;
        }

        setCurrentJobType(
          payload.type
        );

        setCurrentJob({
          job_id:
            response.job_id,

          type:
            payload.type,

          target_language:
            payload.targetLanguage,

          status:
            'queued',

          progress: 0,

          stage:
            'Queued',

          created_at:
            new Date().toISOString(),

          source_file_name:
            payload.file?.name,
        });

        setView(
          'processing'
        );

        startPolling(
          response.job_id
        );
      } catch (e: any) {
        alert(
          `Could not start translation: ${
            e.message
          }`
        );
      }
    };

  // ==========================================
  // BACK / RESET
  // ==========================================

  const handleBack = () => {
    setView('input');

    setCurrentJob(null);

    setCurrentResult(null);

    setOriginalVideoUrl(
      undefined
    );

    setDetectedLanguage(
      undefined
    );
  };

  // ==========================================
  // HISTORY
  // ==========================================

  const handleHistorySelect = (
    rec: InferenceRecord
  ) => {
    setHistoryOpen(false);

    setCurrentResult({
      status: 'success',

      original_text:
        rec.original_text,

      translated_text:
        rec.translated_text,

      audio_url:
        rec.audio_url ||
        undefined,

      video_url:
        rec.video_url ||
        undefined,
    });

    setCurrentJobType(
      rec.input_type
    );

    setView('result');
  };

  // ==========================================
  // PAGE TITLES
  // ==========================================

  const viewTitle =
    view === 'input'
      ? t(
          'app.translateNow'
        )
      : view === 'processing'
      ? t(
          'app.working'
        )
      : t(
          'app.result'
        );

  const viewSub =
    view === 'input'
      ? t(
          'app.inputSub'
        )
      : view === 'processing'
      ? t(
          'app.processingSub'
        )
      : t(
          'app.resultSub'
        );

  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      className={`flex h-screen transition-colors duration-200 ${
        darkMode
          ? 'bg-[#09090f] text-zinc-100'
          : 'bg-zinc-50 text-zinc-900'
      }`}
    >

      {/* ======================================
          SIDEBAR
          ====================================== */}

      <aside
        className={`w-52 flex flex-col border-r shrink-0 transition-colors ${
          darkMode
            ? 'bg-[#0c0c14] border-white/[0.06]'
            : 'bg-white border-black/[0.06]'
        }`}
      >

        {/* LOGO */}

        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">

            <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shadow-md shadow-indigo-600/20">
              B
            </div>

            <span className="text-sm font-bold tracking-tight">
              Bhasha Node
            </span>

          </div>
        </div>

        <div
          className={`mx-4 h-px ${
            darkMode
              ? 'bg-white/[0.04]'
              : 'bg-black/[0.04]'
          }`}
        />

        {/* TELEMETRY */}

        <div className="p-4 pb-2">
          <TelemetryCard
            darkMode={darkMode}
            stats={stats}
            isLive={serverLive}
          />
        </div>

        <div className={`mx-4 h-px ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />

        {/* ACTIVITY LOG */}
        <ActivityLog
          darkMode={darkMode}
          currentStage={currentJob?.stage}
          jobStatus={currentJob?.status}
          jobType={currentJob?.type}
          targetLanguage={currentJob?.target_language}
        />

      </aside>

      {/* ======================================
          MAIN
          ====================================== */}

      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* HEADER */}

        <Header
          darkMode={darkMode}
          activeTab={activeMode}
          onSelectTab={setActiveMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSTM={() => setSTMOpen(true)}
        />

        {/* CONTENT */}

        <div className="flex-1 overflow-y-auto">

          {activeMode === 'knowledge' ? (
            <div className="p-6 h-full">
              <KnowledgeAssistant darkMode={darkMode} />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-8">

              {/* PAGE TITLE */}

              <div className="mb-7">

                <h2 className="text-xl font-bold tracking-tight">
                  {viewTitle}
                </h2>

                <p
                  className={`text-sm mt-1 ${
                    darkMode
                      ? 'text-zinc-500'
                      : 'text-zinc-400'
                  }`}
                >
                  {viewSub}
                </p>

              </div>

              {/* INPUT */}

              {view ===
                'input' && (
                <IngestionForm
                  darkMode={
                    darkMode
                  }

                  onSubmit={
                    handleSubmit
                  }

                  isDisabled={
                    false
                  }

                  detectedLanguage={
                    detectedLanguage
                  }
                />
              )}

              {/* PROCESSING */}

              {view ===
                'processing' &&
                currentJob && (
                  <JobProgress
                    darkMode={
                      darkMode
                    }

                    job={
                      currentJob
                    }

                    onRetry={
                      handleBack
                    }

                    onBack={
                      handleBack
                    }
                  />
                )}

              {/* RESULT */}

              {view ===
                'result' &&
                currentResult && (
                  <ResultViewer
                    darkMode={
                      darkMode
                    }

                    result={
                      currentResult
                    }

                    jobType={
                      currentJobType
                    }

                    onBack={
                      handleBack
                    }

                    originalVideoUrl={
                      originalVideoUrl
                    }
                  />
                )}

            </div>
          )}

        </div>

      </main>

      {/* ======================================
          OVERLAYS
          ====================================== */}

      <HistoryDrawer
        darkMode={
          darkMode
        }

        isOpen={
          historyOpen
        }

        onClose={() =>
          setHistoryOpen(
            false
          )
        }

        onSelectRecord={
          handleHistorySelect
        }
      />

      <STMModal
        darkMode={
          darkMode
        }

        isOpen={
          stmOpen
        }

        onClose={() =>
          setSTMOpen(
            false
          )
        }
      />

      {/* ======================================
          LANGUAGE SELECTOR
          ====================================== */}

      <LanguagePopup
        darkMode={darkMode}
        isOpen={langSelectorOpen}
        onClose={() => setLangSelectorOpen(false)}
      />


    </div>
  );
}