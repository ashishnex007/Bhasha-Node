import {
  Sun,
  Moon,
  Clock,
  BookOpen,
  Globe,
  Sparkles,
  Layers,
} from 'lucide-react';

import {
  useLanguage,
  type Language,
} from '../i18n/LanguageContext';

interface HeaderProps {
  darkMode: boolean;
  activeTab: 'translate' | 'knowledge';
  onSelectTab: (tab: 'translate' | 'knowledge') => void;
  onToggleDarkMode: () => void;
  onOpenHistory: () => void;
  onOpenSTM: () => void;
}

export default function Header({
  darkMode,
  activeTab,
  onSelectTab,
  onToggleDarkMode,
  onOpenHistory,
  onOpenSTM,
}: HeaderProps) {
  const {
    t,
    language,
    setLanguage,
  } = useLanguage();

  const btn = `px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
    darkMode
      ? 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
      : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04]'
  }`;

  const languages: {
    key: Language;
    label: string;
  }[] = [
    {
      key: 'en',
      label: 'English',
    },
    {
      key: 'hi',
      label: 'हिन्दी',
    },
    {
      key: 'mr',
      label: 'मराठी',
    },
  ];

  return (
    <header
      className={`h-16 px-5 flex items-center justify-between border-b shrink-0 transition-colors ${
        darkMode
          ? 'bg-[#0c0c14] border-white/[0.06]'
          : 'bg-white border-black/[0.06]'
      }`}
    >
      {/* Logo & Mode Tabs */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-lg shadow-indigo-600/20">
            B
          </div>

          <div>
            <span className="font-bold text-sm tracking-tight">
              Bhasha Node
            </span>

            <span
              className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                darkMode
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {t('header.offline')}
            </span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          className={`flex items-center gap-1 p-1 rounded-xl border ${
            darkMode
              ? 'bg-white/[0.03] border-white/[0.06]'
              : 'bg-black/[0.03] border-black/[0.06]'
          }`}
        >
          <button
            onClick={() => onSelectTab('translate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'translate'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : darkMode
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layers size={16} />
            Translation Studio
          </button>

          <button
            onClick={() => onSelectTab('knowledge')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'knowledge'
                ? 'bg-gradient-to-r from-emerald-500 to-indigo-600 text-white shadow-md shadow-emerald-500/20'
                : darkMode
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Sparkles size={16} className={activeTab === 'knowledge' ? 'text-amber-300' : 'text-emerald-400'} />
            Knowledge Assistant
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1">
        {/* History */}
        <button
          onClick={onOpenHistory}
          className={btn}
          id="btn-history"
        >
          <Clock size={18} />
          {t('header.pastWork')}
        </button>

        {/* Dictionary */}
        <button
          onClick={onOpenSTM}
          className={btn}
          id="btn-stm"
        >
          <BookOpen size={18} />
          {t('header.wordList')}
        </button>

        {/* Divider */}
        <div
          className={`w-px h-5 mx-2 ${
            darkMode
              ? 'bg-white/[0.06]'
              : 'bg-black/[0.06]'
          }`}
        />

        {/* Language Selector Pill */}
        <div
          className={`flex items-center gap-1 p-1 rounded-full border ${
            darkMode
              ? 'bg-white/[0.03] border-white/[0.08]'
              : 'bg-black/[0.02] border-black/[0.08]'
          }`}
        >
          <div
            className={`flex items-center justify-center px-2 ${
              darkMode
                ? 'text-zinc-400'
                : 'text-zinc-500'
            }`}
            title="Language"
          >
            <Globe size={18} />
          </div>

          {languages.map((lang) => {
            const active =
              language === lang.key;

            return (
              <button
                key={lang.key}
                onClick={() =>
                  setLanguage(lang.key)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : darkMode
                    ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.05]'
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>

        {/* Dark Mode */}
        <button
          onClick={onToggleDarkMode}
          id="btn-dark-mode"
          className={`p-2.5 ml-1 rounded-xl transition-colors ${
            darkMode
              ? 'text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06]'
              : 'text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04]'
          }`}
        >
          {darkMode ? (
            <Sun size={19} />
          ) : (
            <Moon size={19} />
          )}
        </button>
      </nav>
    </header>
  );
}