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
  return (
    <header className={`h-14 px-5 flex items-center justify-between border-b shrink-0 transition-colors ${
      darkMode ? 'bg-[#0c0c14] border-white/[0.06]' : 'bg-white border-black/[0.06]'
    }`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-extrabold">
          B
        </div>
        <span className="font-semibold text-sm tracking-tight">Bhasha Node</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
        }`}>Local</span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-0.5">
        <button
          onClick={onOpenHistory}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            darkMode ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.03]'
          }`}
        >
          <Clock size={13} /> History
        </button>
        <button
          onClick={onOpenSTM}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            darkMode ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.03]'
          }`}
        >
          <BookOpen size={13} /> Dictionary
        </button>
        <div className={`w-px h-4 mx-1.5 ${darkMode ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`} />
        <button
          onClick={onToggleDarkMode}
          className={`p-1.5 rounded-md transition-colors ${
            darkMode ? 'text-zinc-400 hover:text-amber-400 hover:bg-white/[0.04]' : 'text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.03]'
          }`}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </nav>
    </header>
  );
}
