import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, FileText, Mic, Video, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { fetchHistory, deleteInference } from '../services/api';
import type { InferenceRecord } from '../services/api';

interface HistoryDrawerProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord: (record: InferenceRecord) => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  text:  <FileText size={13} className="text-indigo-500" />,
  audio: <Mic size={13} className="text-amber-500" />,
  video: <Video size={13} className="text-rose-500" />,
  ocr:   <ImageIcon size={13} className="text-emerald-500" />,
};

export default function HistoryDrawer({ darkMode, isOpen, onClose, onSelectRecord }: HistoryDrawerProps) {
  const [records, setRecords] = useState<InferenceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) load(); }, [isOpen]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory(50, 0);
      setRecords(data.items);
      setTotal(data.total);
    } catch { /* offline */ }
    setLoading(false);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteInference(id);
    setRecords(prev => prev.filter(r => r.id !== id));
    setTotal(prev => prev - 1);
  };

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  const bg = darkMode ? 'bg-[#0c0c14]' : 'bg-white';
  const border = darkMode ? 'border-white/[0.06]' : 'border-black/[0.06]';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm z-50 transition-transform duration-200 ease-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${bg} shadow-2xl flex flex-col`}>
        {/* Header */}
        <div className={`p-4 flex items-center justify-between border-b ${border}`}>
          <div className="flex items-center gap-2.5">
            <Clock size={14} className={muted} />
            <div>
              <h2 className="text-sm font-semibold">History</h2>
              <p className={`text-[10px] font-mono ${muted}`}>{total} records</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-md transition-colors ${
            darkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
          }`}><X size={14} className={muted} /></button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {loading ? (
            <p className={`text-xs text-center py-12 ${muted}`}>Loading...</p>
          ) : records.length === 0 ? (
            <p className={`text-xs text-center py-12 ${muted}`}>No inferences yet</p>
          ) : records.map(rec => (
            <button
              key={rec.id}
              onClick={() => onSelectRecord(rec)}
              className={`w-full text-left p-3 rounded-lg transition-colors group flex items-start gap-2.5 ${
                darkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'
              }`}
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.02]'
              }`}>
                {TYPE_ICON[rec.input_type] || <FileText size={13} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {rec.file_name || (rec.original_text?.substring(0, 35) + '...') || 'Text Input'}
                </p>
                <p className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  {rec.input_type} → {rec.target_language} · {fmt(rec.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handleDelete(rec.id, e)}
                  className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors">
                  <Trash2 size={11} />
                </button>
                <ChevronRight size={12} className={muted} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
