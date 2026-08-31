import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';

interface LogEntry {
  id: number;
  ts: string;       // "HH:MM:SS"
  msg: string;
  kind: 'info' | 'ok' | 'warn' | 'stage';
}

interface ActivityLogProps {
  darkMode: boolean;
  currentStage?: string;
  jobStatus?: string;
  jobType?: string;
  targetLanguage?: string;
}

let _counter = 0;

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

export default function ActivityLog({
  darkMode,
  currentStage,
  jobStatus,
  jobType,
  targetLanguage,
}: ActivityLogProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const push = (msg: string, kind: LogEntry['kind'] = 'info') => {
    setLog((prev) => [
      ...prev.slice(-19), // keep last 20
      { id: ++_counter, ts: now(), msg, kind },
    ]);
  };

  // React to stage changes
  const prevStage = useRef<string | undefined>(undefined);
  const prevStatus = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (currentStage && currentStage !== prevStage.current) {
      prevStage.current = currentStage;
      push(currentStage, 'stage');
    }
  }, [currentStage]);

  useEffect(() => {
    if (jobStatus && jobStatus !== prevStatus.current) {
      prevStatus.current = jobStatus;
      if (jobStatus === 'queued') {
        const tgt = targetLanguage
          ? targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)
          : '?';
        push(`New ${jobType ?? 'text'} job → ${tgt}`, 'info');
      } else if (jobStatus === 'complete') {
        push('Job complete ✓', 'ok');
      } else if (jobStatus === 'error') {
        push('Job failed ✗', 'warn');
      }
    }
  }, [jobStatus, jobType, targetLanguage]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const muted  = darkMode ? 'text-zinc-600' : 'text-zinc-400';
  const rowBg  = darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]';

  const kindColor = (k: LogEntry['kind']) => {
    if (k === 'ok')    return 'text-emerald-500';
    if (k === 'warn')  return 'text-red-400';
    if (k === 'stage') return darkMode ? 'text-indigo-400' : 'text-indigo-500';
    return darkMode ? 'text-zinc-400' : 'text-zinc-500';
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5 ${muted}`}>
          <Terminal size={9} /> Activity
        </h3>
        {log.length > 0 && (
          <button
            onClick={() => setLog([])}
            className={`text-[9px] ${muted} hover:text-zinc-300 transition-colors`}
          >
            clear
          </button>
        )}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto max-h-36 px-2 pb-2 space-y-0.5 scrollbar-thin">
        {log.length === 0 ? (
          <p className={`text-[10px] px-2 ${muted} italic`}>No activity yet…</p>
        ) : (
          log.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-1.5 px-2 py-0.5 rounded-lg ${rowBg} transition-colors`}
            >
              <span className={`text-[9px] font-mono shrink-0 mt-px ${muted}`}>
                {entry.ts}
              </span>
              <span className={`text-[10px] font-medium leading-tight ${kindColor(entry.kind)}`}>
                {entry.msg}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
