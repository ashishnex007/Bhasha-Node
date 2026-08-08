import React, { useState, useEffect } from 'react';
import { X, BookOpen, Plus, Trash2 } from 'lucide-react';
import { fetchSTMTerms, addSTMTerm, deleteSTMTerm } from '../services/api';
import type { STMTerm } from '../services/api';

interface STMModalProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function STMModal({ darkMode, isOpen, onClose }: STMModalProps) {
  const [terms, setTerms] = useState<STMTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceTerm, setSourceTerm] = useState('');
  const [targetTerm, setTargetTerm] = useState('');
  const [termLang, setTermLang] = useState('marathi');
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (isOpen) loadTerms(); }, [isOpen]);

  const loadTerms = async () => {
    setLoading(true);
    try { const d = await fetchSTMTerms(); setTerms(d.terms); } catch {}
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!sourceTerm.trim() || !targetTerm.trim()) return;
    setAdding(true);
    try {
      await addSTMTerm(sourceTerm, targetTerm, termLang);
      setSourceTerm(''); setTargetTerm('');
      await loadTerms();
    } catch {}
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    await deleteSTMTerm(id);
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#0c0c14]' : 'bg-white';
  const border = darkMode ? 'border-white/[0.06]' : 'border-black/[0.06]';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';
  const input = `px-3 py-2 rounded-lg text-xs border outline-none transition-all focus:ring-1 focus:ring-indigo-500/30 ${border} ${
    darkMode ? 'bg-[#111118] text-zinc-200 placeholder:text-zinc-600' : 'bg-white text-zinc-800 placeholder:text-zinc-400'
  }`;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className={`fixed inset-x-4 top-[12%] max-w-md mx-auto z-50 rounded-xl shadow-2xl flex flex-col max-h-[76vh] ${bg} border ${border}`}>
        {/* Header */}
        <div className={`p-4 flex items-center justify-between border-b ${border}`}>
          <div className="flex items-center gap-2.5">
            <BookOpen size={14} className={muted} />
            <div>
              <h2 className="text-sm font-semibold">Domain Dictionary</h2>
              <p className={`text-[10px] font-mono ${muted}`}>{terms.length} terms · Enforced post-translation</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-md transition-colors ${
            darkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
          }`}><X size={14} className={muted} /></button>
        </div>

        {/* Add Form */}
        <div className={`p-3 border-b ${border} space-y-2`}>
          <div className="grid grid-cols-2 gap-2">
            <input value={sourceTerm} onChange={(e) => setSourceTerm(e.target.value)}
              placeholder="English term" className={input} />
            <input value={targetTerm} onChange={(e) => setTargetTerm(e.target.value)}
              placeholder="Correct translation" className={input} />
          </div>
          <div className="flex gap-2">
            <select value={termLang} onChange={(e) => setTermLang(e.target.value)}
              className={`flex-1 ${input}`}>
              <option value="marathi">Marathi</option>
              <option value="hindi">Hindi</option>
            </select>
            <button onClick={handleAdd}
              disabled={adding || !sourceTerm.trim() || !targetTerm.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        {/* Terms */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <p className={`text-xs text-center py-8 ${muted}`}>Loading...</p>
          ) : terms.length === 0 ? (
            <p className={`text-xs text-center py-8 ${muted}`}>No terms yet. Add agricultural corrections above.</p>
          ) : terms.map(term => (
            <div key={term.id} className={`p-2.5 rounded-lg flex items-center justify-between group ${
              darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.01]'
            }`}>
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className={darkMode ? 'text-zinc-300' : 'text-zinc-700'}>{term.source_term}</span>
                <span className={muted}>→</span>
                <span className="font-semibold text-indigo-500">{term.target_term}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  darkMode ? 'bg-white/[0.03] text-zinc-500' : 'bg-black/[0.02] text-zinc-400'
                }`}>{term.target_language}</span>
              </div>
              <button onClick={() => handleDelete(term.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
