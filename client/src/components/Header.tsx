import { Sun, Moon, Clock, BookOpen } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory: () => void;
  onOpenSTM: () => void;
}

export default function Header({
  darkMode, onToggleDarkMode, onOpenHistory, onOpenSTM,
}: HeaderProps) {
  const btn = `px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all ${
    darkMode
      ? 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
      : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04]'
  }`;

  return (
    <header className={`h-16 px-5 flex items-center justify-between border-b shrink-0 transition-colors ${
      darkMode ? 'bg-[#0c0c14] border-white/[0.06]' : 'bg-white border-black/[0.06]'
    }`}>

      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-lg shadow-indigo-600/20">
          B
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight">Bhasha Node</span>
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
          }`}>Offline</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        <button onClick={onOpenHistory} className={btn} id="btn-history">
          <Clock size={18} />
          Past Work
        </button>
        <button onClick={onOpenSTM} className={btn} id="btn-dictionary">
          <BookOpen size={18} />
          Word List
        </button>
        <div className={`w-px h-5 mx-1 ${darkMode ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`} />
        <button
          onClick={onToggleDarkMode}
          id="btn-dark-mode"
          className={`p-2.5 rounded-xl transition-colors ${
            darkMode
              ? 'text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06]'
              : 'text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04]'
          }`}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </nav>
    </header>
  );
}
