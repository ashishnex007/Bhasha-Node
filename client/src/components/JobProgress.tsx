import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

import type { JobStatus } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

interface JobProgressProps {
  darkMode: boolean;
  job: JobStatus;
  onRetry?: () => void;
}

const stageKey = (
  stage: string
): string | undefined => {
  const map: Record<string, string> = {
    Queued: 'job.waiting',
    'Normalizing Audio':
      'job.preparingAudio',
    'Transcribing (Whisper)':
      'job.listening',
    Translating:
      'job.changingLanguage',
    'Synthesizing Voice':
      'job.creatingVoice',
    'Synthesizing voice':
      'job.creatingVoice',
    'OCR Extraction':
      'job.readingDocument',
    'Extracting Audio':
      'job.gettingAudio',
    'Merging Audio':
      'job.combiningVideo',
    Complete: 'job.allDone',
    Failed: 'job.somethingWrong',
  };

  return map[stage];
};

export default function JobProgress({
  darkMode,
  job,
  onRetry,
}: JobProgressProps) {
  const { t } = useLanguage();

  const isComplete =
    job.status === 'complete';

  const isError =
    job.status === 'error';

  const muted = darkMode
    ? 'text-zinc-500'
    : 'text-zinc-400';

  const translatedStage =
    stageKey(job.stage);

  return (
    <div
      className={`p-7 rounded-2xl border animate-fadeUp ${
        darkMode
          ? 'bg-[#111118] border-white/[0.06]'
          : 'bg-white border-black/[0.06]'
      }`}
    >
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
            isError
              ? 'bg-red-500/10 text-red-500'
              : isComplete
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-indigo-500/10 text-indigo-500'
          }`}
        >
          {isError ? (
            <AlertTriangle size={28} />
          ) : isComplete ? (
            <CheckCircle size={28} />
          ) : (
            <Loader2
              size={28}
              className="animate-spin"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold">
            {isError
              ? t('job.somethingWrong')
              : isComplete
              ? t('job.done')
              : t('job.working')}
          </p>

          <p
            className={`text-sm mt-0.5 ${muted}`}
          >
            {isComplete
              ? t(
                  'job.translationReady'
                )
              : isError
              ? t('job.tryAgain')
              : t('job.thisMayTake')}
          </p>
        </div>

        <span
          className={`text-2xl font-bold font-mono tabular-nums ${
            isError
              ? 'text-red-500'
              : isComplete
              ? 'text-emerald-500'
              : 'text-indigo-500'
          }`}
        >
          {job.progress}%
        </span>
      </div>

      {/* Progress */}
      <div
        className={`w-full rounded-full h-3 ${
          darkMode
            ? 'bg-white/[0.05]'
            : 'bg-black/[0.05]'
        }`}
      >
        <div
          className={`h-3 rounded-full transition-all duration-700 ease-out ${
            isError
              ? 'bg-red-500'
              : isComplete
              ? 'bg-emerald-500'
              : 'bg-indigo-500'
          }`}
          style={{
            width: `${job.progress}%`,
          }}
        />
      </div>

      <p
        className={`text-sm font-semibold mt-4 ${
          isError
            ? 'text-red-400'
            : isComplete
            ? 'text-emerald-500'
            : 'text-indigo-400'
        }`}
      >
        {isError
          ? job.error
          : translatedStage
          ? t(translatedStage)
          : job.stage}
      </p>

      {isError && onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all active:scale-[0.99]"
        >
          <RotateCcw size={16} />
          {t('job.tryAgain')}
        </button>
      )}
    </div>
  );
}