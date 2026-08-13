import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { JobStatus } from '../services/api';

interface JobProgressProps {
  darkMode: boolean;
  job: JobStatus;
}

// Map technical stage names to plain language
const stageLabel = (stage: string) => {
  const map: Record<string, string> = {
    'Queued': 'Waiting to start…',
    'Normalizing Audio': 'Preparing audio…',
    'Transcribing (Whisper)': 'Listening to audio…',
    'Translating': 'Changing language…',
    'Synthesizing Voice': 'Creating voice…',
    'Synthesizing voice': 'Creating voice…',
    'OCR Extraction': 'Reading document…',
    'Extracting Audio': 'Getting audio from video…',
    'Merging Audio': 'Combining video and voice…',
    'Complete': 'All done!',
    'Failed': 'Something went wrong',
  };
  return map[stage] || stage;
};

export default function JobProgress({ darkMode, job }: JobProgressProps) {
  const isComplete = job.status === 'complete';
  const isError = job.status === 'error';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className={`p-7 rounded-2xl border animate-fadeUp ${
      darkMode ? 'bg-[#111118] border-white/[0.06]' : 'bg-white border-black/[0.06]'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
          isError ? 'bg-red-500/10 text-red-500' :
          isComplete ? 'bg-emerald-500/10 text-emerald-500' :
          'bg-indigo-500/10 text-indigo-500'
        }`}>
          {isError ? <AlertTriangle size={28} /> :
           isComplete ? <CheckCircle size={28} /> :
           <Loader2 size={28} className="animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold">
            {isError ? 'Something went wrong' :
             isComplete ? 'Done! ✓' :
             'Working on it…'}
          </p>
          <p className={`text-sm mt-0.5 ${muted}`}>
            {isComplete ? 'Your translation is ready' :
             isError ? 'Please try again' :
             'This may take a minute'}
          </p>
        </div>
        <span className={`text-2xl font-bold font-mono tabular-nums ${
          isError ? 'text-red-500' : isComplete ? 'text-emerald-500' : 'text-indigo-500'
        }`}>{job.progress}%</span>
      </div>

      {/* Progress bar */}
      <div className={`w-full rounded-full h-3 ${darkMode ? 'bg-white/[0.05]' : 'bg-black/[0.05]'}`}>
        <div
          className={`h-3 rounded-full transition-all duration-700 ease-out ${
            isError ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Stage label */}
      <p className={`text-sm font-semibold mt-4 ${
        isError ? 'text-red-400' : isComplete ? 'text-emerald-500' : 'text-indigo-400'
      }`}>
        {isError ? job.error : stageLabel(job.stage)}
      </p>
    </div>
  );
}
