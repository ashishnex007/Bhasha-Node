import {
  useState,
  useEffect,
} from 'react';

import {
  X,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import {
  fetchSTMTerms,
  addSTMTerm,
  deleteSTMTerm,
} from '../services/api';

import type {
  STMTerm,
} from '../services/api';

import { useLanguage } from '../i18n/LanguageContext';

interface STMModalProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

type Toast =
  | {
      type: 'ok' | 'err';
      msg: string;
    }
  | null;

export default function STMModal({
  darkMode,
  isOpen,
  onClose,
}: STMModalProps) {
  const { t } =
    useLanguage();

  const [terms, setTerms] =
    useState<STMTerm[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [sourceTerm, setSourceTerm] =
    useState('');

  const [targetTerm, setTargetTerm] =
    useState('');

  const [termLang, setTermLang] =
    useState('marathi');

  const [filterLang, setFilterLang] =
    useState('all');

  const [adding, setAdding] =
    useState(false);

  const [toast, setToast] =
    useState<Toast>(null);

  useEffect(() => {
    if (isOpen) {
      loadTerms();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(
      () => setToast(null),
      3000
    );

    return () =>
      clearTimeout(timer);
  }, [toast]);

  const loadTerms = async () => {
    setLoading(true);

    try {
      const d =
        await fetchSTMTerms();

      setTerms(d.terms);
    } catch {
      setToast({
        type: 'err',
        msg: t(
          'stm.loadError'
        ),
      });
    }

    setLoading(false);
  };

  const handleAdd = async () => {
    if (
      !sourceTerm.trim() ||
      !targetTerm.trim()
    ) {
      return;
    }

    setAdding(true);

    try {
      await addSTMTerm(
        sourceTerm.trim(),
        targetTerm.trim(),
        termLang
      );

      setSourceTerm('');
      setTargetTerm('');

      setToast({
        type: 'ok',
        msg: t(
          'stm.wordSaved'
        ),
      });

      await loadTerms();
    } catch {
      setToast({
        type: 'err',
        msg: t(
          'stm.saveError'
        ),
      });
    }

    setAdding(false);
  };

  const handleDelete = async (
    id: number
  ) => {
    try {
      await deleteSTMTerm(id);

      setTerms((prev) =>
        prev.filter(
          (term) =>
            term.id !== id
        )
      );

      setToast({
        type: 'ok',
        msg: t(
          'stm.wordRemoved'
        ),
      });
    } catch {
      setToast({
        type: 'err',
        msg: t(
          'stm.removeError'
        ),
      });
    }
  };

  if (!isOpen) return null;

  const bg = darkMode
    ? 'bg-[#0d0d18]'
    : 'bg-white';

  const border = darkMode
    ? 'border-white/[0.07]'
    : 'border-black/[0.07]';

  const muted = darkMode
    ? 'text-zinc-500'
    : 'text-zinc-400';

  const inputCls = `w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 ${border} ${
    darkMode
      ? 'bg-[#16161f] text-zinc-200 placeholder:text-zinc-600'
      : 'bg-zinc-50 text-zinc-800 placeholder:text-zinc-400'
  }`;

  const rowBg = darkMode
    ? 'hover:bg-white/[0.03]'
    : 'hover:bg-black/[0.02]';

  const displayed =
    filterLang === 'all'
      ? terms
      : terms.filter(
          (term) =>
            term.target_language ===
            filterLang
        );

  const marathiCount =
    terms.filter(
      (term) =>
        term.target_language ===
        'marathi'
    ).length;

  const hindiCount =
    terms.filter(
      (term) =>
        term.target_language ===
        'hindi'
    ).length;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div
        className={`fixed inset-x-4 top-[6%] max-w-lg mx-auto z-50 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] ${bg} border ${border}`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${border}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/15 flex items-center justify-center">
              <BookOpen
                size={22}
                className="text-indigo-500"
              />
            </div>

            <div>
              <h2 className="text-base font-bold">
                {t(
                  'stm.title'
                )}
              </h2>

              <p
                className={`text-xs mt-0.5 ${muted}`}
              >
                {terms.length}{' '}
                {t(
                  'stm.savedWords'
                )}{' '}
                ·{' '}
                {t(
                  'stm.subtitle'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              darkMode
                ? 'hover:bg-white/[0.06] text-zinc-400'
                : 'hover:bg-black/[0.04] text-zinc-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mx-4 mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-medium ${
              toast.type === 'ok'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}
          >
            {toast.type ===
            'ok' ? (
              <CheckCircle
                size={18}
              />
            ) : (
              <AlertCircle
                size={18}
              />
            )}

            {toast.msg}
          </div>
        )}

        {/* Add */}
        <div
          className={`px-4 py-4 border-b ${border} space-y-3`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-widest ${muted}`}
          >
            {t(
              'stm.addNew'
            )}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                className={`text-[11px] font-medium mb-1 block ${muted}`}
              >
                {t(
                  'stm.englishWord'
                )}
              </label>

              <input
                value={sourceTerm}
                onChange={(e) =>
                  setSourceTerm(
                    e.target.value
                  )
                }
                onKeyDown={(e) =>
                  e.key ===
                    'Enter' &&
                  handleAdd()
                }
                placeholder="e.g. pesticide"
                className={inputCls}
              />
            </div>

            <div>
              <label
                className={`text-[11px] font-medium mb-1 block ${muted}`}
              >
                {t(
                  'stm.correctTranslation'
                )}
              </label>

              <input
                value={targetTerm}
                onChange={(e) =>
                  setTargetTerm(
                    e.target.value
                  )
                }
                onKeyDown={(e) =>
                  e.key ===
                    'Enter' &&
                  handleAdd()
                }
                placeholder="e.g. कीटकनाशक"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1">
              <label
                className={`text-[11px] font-medium mb-1 block ${muted}`}
              >
                {t(
                  'stm.language'
                )}
              </label>

              <select
                value={termLang}
                onChange={(e) =>
                  setTermLang(
                    e.target.value
                  )
                }
                className={inputCls}
              >
                <option value="marathi">
                  Marathi (मराठी)
                </option>

                <option value="hindi">
                  Hindi (हिन्दी)
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={
                  handleAdd
                }
                disabled={
                  adding ||
                  !sourceTerm.trim() ||
                  !targetTerm.trim()
                }
                className="h-[46px] px-5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
              >
                {adding ? (
                  <span className="animate-spin text-base">
                    ⟳
                  </span>
                ) : (
                  <Plus size={18} />
                )}

                {t(
                  'stm.save'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pt-3 pb-1 flex gap-2">
          <button
            onClick={() =>
              setFilterLang('all')
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterLang === 'all'
                ? 'bg-indigo-600 text-white'
                : darkMode
                ? 'text-zinc-400 hover:bg-white/[0.05]'
                : 'text-zinc-500 hover:bg-black/[0.04]'
            }`}
          >
            {t('stm.all')} ({terms.length})
          </button>

          <button
            onClick={() =>
              setFilterLang(
                'marathi'
              )
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterLang === 'marathi'
                ? 'bg-indigo-600 text-white'
                : darkMode
                ? 'text-zinc-400 hover:bg-white/[0.05]'
                : 'text-zinc-500 hover:bg-black/[0.04]'
            }`}
          >
            {t(
              'stm.marathi'
            )}{' '}
            ({marathiCount})
          </button>

          <button
            onClick={() =>
              setFilterLang(
                'hindi'
              )
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterLang === 'hindi'
                ? 'bg-indigo-600 text-white'
                : darkMode
                ? 'text-zinc-400 hover:bg-white/[0.05]'
                : 'text-zinc-500 hover:bg-black/[0.04]'
            }`}
          >
            {t(
              'stm.hindi'
            )}{' '}
            ({hindiCount})
          </button>
        </div>

        {/* Word list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div
                className={`text-sm ${muted} animate-pulse`}
              >
                {t(
                  'stm.loading'
                )}
              </div>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <BookOpen
                size={36}
                className={muted}
              />

              <p
                className={`text-sm text-center whitespace-pre-line ${muted}`}
              >
                {filterLang ===
                'all'
                  ? `${t(
                      'stm.noWords'
                    )}\n${t(
                      'stm.addFirst'
                    )}`
                  : `${t(
                      'stm.noLanguageWords'
                    )}`}
              </p>
            </div>
          ) : (
            displayed.map(
              (term) => (
                <div
                  key={term.id}
                  className={`px-3 py-3 rounded-xl flex items-center justify-between group transition-colors mt-1.5 ${rowBg}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                        term.target_language ===
                        'marathi'
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      {term.target_language ===
                      'marathi'
                        ? 'MAR'
                        : 'HIN'}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            darkMode
                              ? 'text-zinc-200'
                              : 'text-zinc-700'
                          }`}
                        >
                          {
                            term.source_term
                          }
                        </span>

                        <span
                          className={
                            muted
                          }
                        >
                          →
                        </span>

                        <span className="text-sm font-semibold text-indigo-400">
                          {
                            term.target_term
                          }
                        </span>
                      </div>

                      <p
                        className={`text-[10px] mt-0.5 ${muted}`}
                      >
                        {
                          term.domain
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleDelete(
                        term.id
                      )
                    }
                    className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title={t(
                      'stm.removeWord'
                    )}
                  >
                    <Trash2
                      size={17}
                    />
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>
    </>
  );
}