import React, {
  useState,
  useEffect,
} from 'react';

import {
  X,
  Clock,
  Trash2,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  ChevronRight,
} from 'lucide-react';

import {
  fetchHistory,
  deleteInference,
} from '../services/api';

import type {
  InferenceRecord,
} from '../services/api';

import { useLanguage } from '../i18n/LanguageContext';

interface HistoryDrawerProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord: (
    record: InferenceRecord
  ) => void;
}

const TYPE_ICON: Record<
  string,
  React.ReactNode
> = {
  text: (
    <FileText
      size={18}
      className="text-indigo-500"
    />
  ),
  audio: (
    <Mic
      size={18}
      className="text-amber-500"
    />
  ),
  video: (
    <Video
      size={18}
      className="text-rose-500"
    />
  ),
  ocr: (
    <ImageIcon
      size={18}
      className="text-emerald-500"
    />
  ),
};

export default function HistoryDrawer({
  darkMode,
  isOpen,
  onClose,
  onSelectRecord,
}: HistoryDrawerProps) {
  const { t } =
    useLanguage();

  const [records, setRecords] =
    useState<InferenceRecord[]>(
      []
    );

  const [total, setTotal] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (isOpen) {
      load();
    }
  }, [isOpen]);

  const load = async () => {
    setLoading(true);

    try {
      const data =
        await fetchHistory(
          50,
          0
        );

      setRecords(data.items);
      setTotal(data.total);
    } catch {
      // offline
    }

    setLoading(false);
  };

  const handleDelete = async (
    id: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    await deleteInference(id);

    setRecords((prev) =>
      prev.filter(
        (r) => r.id !== id
      )
    );

    setTotal(
      (prev) => prev - 1
    );
  };

  const fmt = (iso: string) => {
    try {
      return new Date(
        iso
      ).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getTypeLabel = (
    type: string
  ) => {
    switch (type) {
      case 'text':
        return t('history.text');

      case 'audio':
        return t('history.audio');

      case 'video':
        return t('history.video');

      case 'ocr':
        return t(
          'history.imagePdf'
        );

      default:
        return type;
    }
  };

  const bg = darkMode
    ? 'bg-[#0c0c14]'
    : 'bg-white';

  const border = darkMode
    ? 'border-white/[0.06]'
    : 'border-black/[0.06]';

  const muted = darkMode
    ? 'text-zinc-500'
    : 'text-zinc-400';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm z-50 transition-transform duration-200 ease-out ${
          isOpen
            ? 'translate-x-0'
            : 'translate-x-full'
        } ${bg} shadow-2xl flex flex-col`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${border}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Clock
                size={20}
                className="text-indigo-400"
              />
            </div>

            <div>
              <h2 className="text-base font-bold">
                {t(
                  'history.title'
                )}
              </h2>

              <p
                className={`text-xs mt-0.5 ${muted}`}
              >
                {total}{' '}
                {t(
                  'history.savedTranslations'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
              darkMode
                ? 'hover:bg-white/[0.06] text-zinc-400'
                : 'hover:bg-black/[0.04] text-zinc-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {loading ? (
            <p
              className={`text-sm text-center py-14 ${muted} animate-pulse`}
            >
              {t(
                'history.loading'
              )}
            </p>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Clock
                size={36}
                className={muted}
              />

              <p
                className={`text-sm text-center ${muted}`}
              >
                {t(
                  'history.empty'
                )}
              </p>
            </div>
          ) : (
            records.map((rec) => (
              <button
                key={rec.id}
                onClick={() =>
                  onSelectRecord(
                    rec
                  )
                }
                className={`w-full text-left p-4 rounded-2xl transition-colors group flex items-start gap-3 ${
                  darkMode
                    ? 'hover:bg-white/[0.04]'
                    : 'hover:bg-black/[0.02]'
                }`}
              >
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    darkMode
                      ? 'bg-white/[0.05]'
                      : 'bg-black/[0.03]'
                  }`}
                >
                  {TYPE_ICON[
                    rec.input_type
                  ] || (
                    <FileText
                      size={18}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {rec.file_name ||
                      (rec.original_text
                        ?.substring(
                          0,
                          30
                        ) +
                          '…') ||
                      t(
                        'history.textInput'
                      )}
                  </p>

                  <p
                    className={`text-xs mt-0.5 ${muted}`}
                  >
                    {getTypeLabel(
                      rec.input_type
                    )}{' '}
                    →{' '}
                    {
                      rec.target_language
                    }{' '}
                    ·{' '}
                    {fmt(
                      rec.created_at
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) =>
                      handleDelete(
                        rec.id,
                        e
                      )
                    }
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title={t(
                      'history.delete'
                    )}
                  >
                    <Trash2
                      size={15}
                    />
                  </button>

                  <ChevronRight
                    size={16}
                    className={muted}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}