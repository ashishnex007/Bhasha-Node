import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  Languages,
  Clock,
} from 'lucide-react';

import type { JobStatus } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

interface JobProgressProps {
  darkMode: boolean;
  job: JobStatus;
  onRetry?: () => void;
  onBack?: () => void;
}

const stageKey = (stage: string): string | undefined => {
  const map: Record<string, string> = {
    Queued: 'job.waiting',
    'Normalizing Audio': 'job.preparingAudio',
    'Transcribing (Whisper)': 'job.listening',
    Translating: 'job.changingLanguage',
    'Translating & Building SRT': 'job.changingLanguage',
    'Synthesizing Voice': 'job.creatingVoice',
    'Synthesizing voice': 'job.creatingVoice',
    'OCR Extraction': 'job.readingDocument',
    'Extracting Audio': 'job.gettingAudio',
    'Merging Audio': 'job.combiningVideo',
    'Remuxing Video': 'job.combiningVideo',
    Finalizing: 'job.allDone',
    Complete: 'job.allDone',
    Failed: 'job.somethingWrong',
  };
  return map[stage];
};

const typeIcon = (type: string, size = 18) => {
  if (type === 'audio') return <Mic size={size} className="text-amber-400" />;
  if (type === 'video') return <Video size={size} className="text-rose-400" />;
  if (type === 'ocr')   return <ImageIcon size={size} className="text-emerald-400" />;
  return <FileText size={size} className="text-indigo-400" />;
};

const langLabel = (code?: string) => {
  if (!code) return 'Auto';
  if (code === 'marathi' || code === 'mar_Deva') return 'Marathi मराठी';
  if (code === 'hindi'   || code === 'hin_Deva') return 'Hindi हिन्दी';
  if (code === 'english' || code === 'eng_Latn') return 'English';
  return code;
};

export default function JobProgress({
  darkMode,
  job,
  onRetry,
  onBack,
}: JobProgressProps) {
  const { t } = useLanguage();

  const isComplete = job.status === 'complete';
  const isError    = job.status === 'error';

  const muted   = darkMode ? 'text-zinc-500' : 'text-zinc-400';
  const cardBg  = darkMode ? 'bg-[#111118] border-white/[0.06]' : 'bg-white border-black/[0.06]';
  const chipBg  = darkMode ? 'bg-white/[0.04] text-zinc-400' : 'bg-black/[0.04] text-zinc-500';

  const translatedStage = stageKey(job.stage);

  return (
    <div className="space-y-3 animate-fadeUp">

      {/* ── Main card ── */}
      <div className={`p-7 rounded-2xl border ${cardBg}`}>
        <div className="flex items-center gap-4 mb-6">

          {/* Icon */}
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
            isError    ? 'bg-red-500/10 text-red-500'
            : isComplete ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-indigo-500/10 text-indigo-500'
          }`}>
            {isError ? (
              <AlertTriangle size={28} />
            ) : isComplete ? (
              <CheckCircle size={28} />
            ) : (
              <Loader2 size={28} className="animate-spin" />
            )}
          </div>

          {/* Status text */}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold">
              {isError    ? t('job.somethingWrong')
               : isComplete ? t('job.done')
               : t('job.working')}
            </p>
            <p className={`text-sm mt-0.5 ${muted}`}>
              {isComplete ? t('job.translationReady')
               : isError  ? t('job.tryAgain')
               : t('job.thisMayTake')}
            </p>
          </div>

          {/* Percent */}
          <span className={`text-2xl font-bold font-mono tabular-nums ${
            isError    ? 'text-red-500'
            : isComplete ? 'text-emerald-500'
            : 'text-indigo-500'
          }`}>
            {job.progress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className={`w-full rounded-full h-3 ${darkMode ? 'bg-white/[0.05]' : 'bg-black/[0.05]'}`}>
          <div
            className={`h-3 rounded-full transition-all duration-700 ease-out ${
              isError    ? 'bg-red-500'
              : isComplete ? 'bg-emerald-500'
              : 'bg-indigo-500'
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>

        {/* Stage label */}
        <p className={`text-sm font-semibold mt-4 ${
          isError    ? 'text-red-400'
          : isComplete ? 'text-emerald-500'
          : 'text-indigo-400'
        }`}>
          {isError
            ? job.error
            : translatedStage
            ? t(translatedStage)
            : job.stage}
        </p>
      </div>

      {/* ── Job context card (shows while processing) ── */}
      {!isComplete && (
        <div className={`px-5 py-4 rounded-2xl border ${cardBg}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${muted}`}>
            Processing
          </p>
          <div className="flex flex-wrap gap-2">

            {/* Type chip */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold ${chipBg}`}>
              {typeIcon(job.type, 11)}
              {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
            </span>

            {/* Source file */}
            {job.source_file_name && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold ${chipBg} max-w-[160px] truncate`}>
                <FileText size={10} />
                {job.source_file_name}
              </span>
            )}

            {/* Arrow */}
            <span className={`flex items-center px-1 text-xs ${muted}`}>
              <Languages size={12} className="mr-1" />
            </span>

            {/* Target language */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold ${
              darkMode ? 'bg-indigo-500/[0.1] text-indigo-300' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {langLabel(job.target_language)}
            </span>

          </div>
        </div>
      )}

      {/* ── Error actions ── */}
      {isError && (
        <div className="flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 border transition-all active:scale-[0.99] ${
                darkMode
                  ? 'border-white/[0.07] text-zinc-300 hover:bg-white/[0.04]'
                  : 'border-black/[0.07] text-zinc-600 hover:bg-black/[0.03]'
              }`}
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all active:scale-[0.99]"
            >
              <RotateCcw size={16} />
              {t('job.tryAgain')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}