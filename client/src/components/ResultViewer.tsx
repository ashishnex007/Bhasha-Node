import {
  ArrowLeft, Languages, Volume2, Video, Download,
  CheckCircle, FileText
} from 'lucide-react';
import type { PipelineResult } from '../services/api';

interface ResultViewerProps {
  darkMode: boolean;
  result: PipelineResult;
  jobType: string;
  onBack: () => void;
}

export default function ResultViewer({ darkMode, result, jobType, onBack }: ResultViewerProps) {
  const border = darkMode ? 'border-white/[0.06]' : 'border-black/[0.06]';
  const bg = darkMode ? 'bg-[#111118]' : 'bg-white';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';
  const label = `text-[10px] font-semibold uppercase tracking-widest mb-2.5 flex items-center gap-1.5 ${muted}`;

  return (
    <div className="space-y-4 stagger">
      {/* Top bar */}
      <div className="flex items-center justify-between animate-fadeUp">
        <button onClick={onBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${border} ${
            darkMode ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.02]'
          }`}>
          <ArrowLeft size={13} /> New Inference
        </button>
        <span className={`flex items-center gap-1.5 text-[10px] font-medium ${
          darkMode ? 'text-emerald-400' : 'text-emerald-600'
        }`}>
          <CheckCircle size={11} /> Processed Offline
        </span>
      </div>

      {/* Video */}
      {result.video_url && (
        <div className={`p-4 rounded-xl border ${border} ${bg} animate-fadeUp`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={label}><Video size={11} /> Translated Video</span>
            <a href={result.video_url} download
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors">
              <Download size={10} /> MP4
            </a>
          </div>
          <video controls src={result.video_url} className="w-full rounded-lg bg-black" />
        </div>
      )}

      {/* Source */}
      {result.original_text && (
        <div className={`p-4 rounded-xl border ${border} ${bg} animate-fadeUp`}>
          <span className={label}><FileText size={11} /> Source Text</span>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
            {result.original_text}
          </p>
        </div>
      )}

      {/* Translation */}
      {result.translated_text && !result.video_url && (
        <div className={`p-4 rounded-xl border ${border} ${bg} animate-fadeUp`}>
          <span className={label}><Languages size={11} /> Translation</span>
          <p className={`text-base font-medium leading-relaxed ${
            darkMode ? 'text-zinc-200' : 'text-zinc-800'
          }`}>
            {result.translated_text}
          </p>
        </div>
      )}

      {/* Audio */}
      {result.audio_url && (
        <div className={`p-4 rounded-xl border ${border} ${bg} animate-fadeUp`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={label}><Volume2 size={11} /> Voice Output</span>
            <a href={result.audio_url} download
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors">
              <Download size={10} /> WAV
            </a>
          </div>
          <audio controls src={result.audio_url} className="w-full h-10" />
        </div>
      )}
    </div>
  );
}
