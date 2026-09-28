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
import BhashaAgent, { type FollowUpTranslation } from './components/BhashaAgent';

import { useLanguage } from './i18n/LanguageContext';

import {
  submitTextJob,
  submitAudioJob,
  submitVideoJob,
  submitOCRJob,
  pollJob,
  fetchSystemStats,
  fetchCapabilities,
} from './services/api';

import type {
  JobStatus,
  PipelineResult,
  SystemStats,
  InferenceRecord,
  LanguageCapability,
} from './services/api';

type AppView = 'input' | 'processing' | 'result';

export default function App() {
  const {
    t,
  } = useLanguage();

  // ==========================================
  // STATE
  // ==========================================

  const [darkMode, setDarkMode] = useState(true);
  const [systemVisible, setSystemVisible] = useState(true);

  const [activeMode, setActiveMode] = useState<'translate' | 'knowledge'>('translate');
  const [followUpTranslation, setFollowUpTranslation] = useState<FollowUpTranslation | null>(null);

  const [view, setView] = useState<AppView>('input');

  const [currentJob, setCurrentJob] =
    useState<JobStatus | null>(null);

  const [currentResult, setCurrentResult] =
    useState<PipelineResult | null>(null);

  const [currentJobType, setCurrentJobType] =
    useState('text');

  const [detectedLanguage, setDetectedLanguage] =
    useState<string | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<LanguageCapability[]>([]);

  useEffect(() => { fetchCapabilities().then(setCapabilities).catch(() => {}); }, []);


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
      !new URLSearchParams(window.location.search).has('job') &&
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

  useEffect(() => {
    const jobId = new URLSearchParams(window.location.search).get('job');
    if (!jobId) return;
    let active = true;
    pollJob(jobId).then((job) => {
      if (!active) return;
      setCurrentJob(job);
      setCurrentJobType(job.type);
      if (job.status === 'complete' && job.result) {
        setCurrentResult(job.result);
        setView('result');
      } else if (job.status === 'queued' || job.status === 'processing') {
        setView('processing');
        startPolling(jobId);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [startPolling]);

  // ==========================================
  // JOB SUBMISSION
  // ==========================================

  const handleSubmit =
    async (payload: {
      type: string | null;
      file: File | null;
      rawText: string;
      targetLanguage: string;
      sourceLanguage?: string;
    }) => {
      if (!payload.type) {
        return;
      }


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
              , payload.sourceLanguage
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
              payload.targetLanguage,
              payload.sourceLanguage
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
              payload.targetLanguage,
              payload.sourceLanguage
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
              payload.targetLanguage,
              payload.sourceLanguage
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
        window.history.replaceState(null, '', `?job=${encodeURIComponent(response.job_id)}`);
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
    window.history.replaceState(null, '', window.location.pathname);
    setView('input');

    setCurrentJob(null);

    setCurrentResult(null);


    setDetectedLanguage(
      undefined
    );
  };

  // ==========================================
  // HISTORY
  // ==========================================

  const handleHistorySelect = async (
    rec: InferenceRecord
  ) => {
    setHistoryOpen(false);
    try {
      const job = await pollJob(rec.job_id);
      setCurrentJob(job);
      setCurrentResult(job.result || null);
      setCurrentJobType(job.type);
      setView('result');
      window.history.replaceState(null, '', `?job=${encodeURIComponent(job.job_id)}`);
    } catch {
      alert('This saved result is no longer available.');
    }
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
      className={`flex flex-col h-screen transition-colors duration-200 ${
        darkMode
          ? 'bg-[#09090f] text-zinc-100'
          : 'bg-zinc-50 text-zinc-900'
      }`}
    >

      <Header
        darkMode={darkMode}
        activeTab={activeMode}
        onSelectTab={setActiveMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSTM={() => setSTMOpen(true)}
        systemVisible={systemVisible}
        onToggleSystem={() => setSystemVisible(visible => !visible)}
      />

      <div className="flex flex-1 min-h-0">

      {/* ======================================
          SIDEBAR
          ====================================== */}

      <aside
        id="system-panel"
        hidden={!systemVisible}
        className={`w-52 ${systemVisible ? 'flex' : 'hidden'} flex-col border-r shrink-0 transition-colors ${
          darkMode
            ? 'bg-[#0c0c14] border-white/[0.06]'
            : 'bg-white border-black/[0.06]'
        }`}
      >

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

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* CONTENT */}

        <div className="flex-1 overflow-y-auto">

          {activeMode === 'knowledge' ? (
            <div className="p-6 h-full">
              <BhashaAgent darkMode={darkMode} translationContext={followUpTranslation} onRemoveContext={() => setFollowUpTranslation(null)} />
            </div>
          ) : (
            <div className={`${view === 'result' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-6 py-8`}>

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
                  capabilities={capabilities}
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

                    job={currentJob}
                    capabilities={capabilities}
                    onAskFollowUp={() => {
                      setFollowUpTranslation({
                        jobId: currentJob?.job_id || '',
                        originalText: currentResult.original_text || '',
                        translatedText: currentResult.translated_text || '',
                        sourceLanguage: currentJob?.source_language || currentResult.detected_source_language || '',
                        targetLanguage: currentJob?.target_language || '',
                      });
                      setActiveMode('knowledge');
                    }}
                  />
                )}

            </div>
          )}

        </div>

      </main>
      </div>

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
