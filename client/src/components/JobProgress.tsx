import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { JobStatus } from '../services/api';

interface JobProgressProps {
  darkMode: boolean;
  job: JobStatus;
}

export default function JobProgress({ darkMode, job }: JobProgressProps) {
  const isComplete = job.status === 'complete';
  const isError = job.status === 'error';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className={`p-6 rounded-xl border animate-fadeUp ${
      darkMode ? 'bg-[#111118] border-white/[0.06]' : 'bg-white border-black/[0.06]'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
          isError ? 'bg-red-500/10 text-red-500' :
          isComplete ? 'bg-emerald-500/10 text-emerald-500' :
          'bg-indigo-500/10 text-indigo-500'
        }`}>
          {isError ? <AlertTriangle size={16} /> :
           isComplete ? <CheckCircle size={16} /> :
           <Loader2 size={16} className="animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {isError ? 'Processing Failed' : isComplete ? 'Complete' : 'Processing...'}
          </p>
          <p className={`text-[10px] font-mono ${muted}`}>
            #{job.job_id} · {job.type.toUpperCase()} → {job.target_language.toUpperCase()}
          </p>
        </div>
        <span className={`text-lg font-bold font-mono tabular-nums ${
          isError ? 'text-red-500' : isComplete ? 'text-emerald-500' : 'text-indigo-500'
        }`}>{job.progress}%</span>
      </div>

      {/* Bar */}
      <div className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`}>
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ease-out ${
            isError ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Stage label */}
      <p className={`text-xs font-medium mt-3 ${
        isError ? 'text-red-400' : isComplete ? 'text-emerald-500' : 'text-indigo-400'
      }`}>
        {isError ? job.error : job.stage}
      </p>
    </div>
  );
}
