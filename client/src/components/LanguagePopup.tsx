import { Languages, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useLanguage, type Language } from '../i18n/LanguageContext';

interface LanguagePopupProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguagePopup({
  darkMode,
  isOpen,
  onClose,
}: LanguagePopupProps) {
  const { setLanguage, language } = useLanguage();
  const [selected, setSelected] = useState<Language>(language);

  if (!isOpen) {
    return null;
  }

  const languages: {
    key: Language;
    native: string;
    english: string;
  }[] = [
    {
      key: 'en',
      native: 'English',
      english: 'English',
    },
    {
      key: 'hi',
      native: 'हिन्दी',
      english: 'Hindi',
    },
    {
      key: 'mr',
      native: 'मराठी',
      english: 'Marathi',
    },
  ];

  const handleSelect = (lang: Language) => {
    setSelected(lang);
    setLanguage(lang);
    // Don't close popup immediately — let user see the change
    // They can close it manually
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-5"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl border p-7 shadow-2xl ${
          darkMode
            ? 'bg-[#111118] border-white/[0.08]'
            : 'bg-white border-black/[0.08]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-5">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
            <Languages size={26} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-center">
          Choose your language
        </h2>

        <p
          className={`text-sm text-center mt-2 leading-relaxed ${
            darkMode ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          Do you want to use Bhasha Node in English,
          Hindi, or Marathi?
        </p>

        <div className="grid grid-cols-1 gap-3 mt-7">
          {languages.map((lang) => (
            <button
              key={lang.key}
              onClick={() => handleSelect(lang.key)}
              className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                selected === lang.key
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : darkMode
                  ? 'border-white/[0.07] text-zinc-300 hover:bg-white/[0.04]'
                  : 'border-black/[0.07] text-zinc-700 hover:bg-black/[0.03]'
              }`}
            >
              <div className="text-left">
                <div className="font-bold">
                  {lang.native}
                </div>

                <div
                  className={`text-xs mt-1 ${
                    selected === lang.key
                      ? 'text-indigo-200'
                      : darkMode
                      ? 'text-zinc-500'
                      : 'text-zinc-400'
                  }`}
                >
                  {lang.english}
                </div>
              </div>

              {selected === lang.key && (
                <CheckCircle size={20} />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}