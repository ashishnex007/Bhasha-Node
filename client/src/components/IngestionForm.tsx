import React, {
  useState,
  useRef,
  useEffect,
} from 'react';

import {
  UploadCloud,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  Square,
  CheckCircle,
  Send,
  X,
  Languages,
  Loader2,
} from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';
import { detectLanguage, type LanguageCapability } from '../services/api';

type FileCategory =
  | 'text'
  | 'audio'
  | 'video'
  | 'ocr'
  | null;

interface IngestionFormProps {
  darkMode: boolean;

  onSubmit: (payload: {
    type: FileCategory;
    file: File | null;
    rawText: string;
    targetLanguage: string;
    sourceLanguage?: string;
  }) => void;

  isDisabled: boolean;
  detectedLanguage?: string;
  capabilities: LanguageCapability[];
}

export default function IngestionForm({
  darkMode,
  onSubmit,
  isDisabled,
  detectedLanguage,
  capabilities,
}: IngestionFormProps) {
  const { t } = useLanguage();
  const languageLabel = (key: string, name: string) => ['english', 'hindi', 'marathi'].includes(key) ? t(`stm.${key}`) : name;

  const [file, setFile] =
    useState<File | null>(null);

  const [fileCategory, setFileCategory] =
    useState<FileCategory>(null);

  const [rawText, setRawText] =
    useState('');

  const [targetLang, setTargetLang] =
    useState('marathi');

  const [isDragging, setIsDragging] =
    useState(false);

  const [liveDetectedLang, setLiveDetectedLang] =
    useState<string | undefined>(undefined);
  const [sourceOverride, setSourceOverride] = useState('');
  const [detectionUnavailable, setDetectionUnavailable] = useState(false);


  const [
    audioPreviewUrl,
    setAudioPreviewUrl,
  ] = useState<string | undefined>(undefined);

  const effectiveLang =
    sourceOverride || liveDetectedLang || detectedLanguage;

  useEffect(() => {
    if (!rawText.trim()) return;
    let active = true;
    const timer = setTimeout(() => {
      detectLanguage(rawText).then(result => {
        if (active) {
          setLiveDetectedLang(result.available ? result.language : undefined);
          setDetectionUnavailable(!result.available);
        }
      }).catch(() => { if (active) setDetectionUnavailable(true); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [rawText]);

  const [isRecording, setIsRecording] =
    useState(false);

  const [recordSeconds, setRecordSeconds] =
    useState(0);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const audioChunksRef =
    useRef<Blob[]>([]);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(
          audioPreviewUrl
        );
      }
    };
  }, [audioPreviewUrl]);

  const categorizeFile = (
    f: File
  ): FileCategory => {
    if (f.type.startsWith('video/'))
      return 'video';

    if (f.type.startsWith('audio/'))
      return 'audio';

    if (
      f.type.startsWith('image/') ||
      f.type === 'application/pdf'
    ) {
      return 'ocr';
    }

    return 'text';
  };

  const handleFile = (f: File) => {
    const cat = categorizeFile(f);

    setFile(f);
    setFileCategory(cat);
    setRawText('');
    setLiveDetectedLang(undefined);
    setDetectionUnavailable(false);

    if (cat === 'text') {
      const reader = new FileReader();

      reader.onload = (e) => {
        const text =
          e.target?.result as string;

        setRawText(text);
        setLiveDetectedLang(undefined);
      };

      reader.readAsText(f);
    }

  };

  const handleDrop = (
    e: React.DragEvent
  ) => {
    e.preventDefault();
    setIsDragging(false);

    const f =
      e.dataTransfer.files?.[0];

    if (f) handleFile(f);
  };

  const handleFileInput = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];

    if (f) handleFile(f);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;

    return `${m}:${sec
      .toString()
      .padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          { audio: true }
        );

      const mediaRecorder =
        new MediaRecorder(stream, {
          mimeType:
            'audio/webm;codecs=opus',
        });

      mediaRecorderRef.current =
        mediaRecorder;

      audioChunksRef.current = [];

      setRecordSeconds(0);

      mediaRecorder.ondataavailable = (
        e
      ) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(
            e.data
          );
        }
      };

      mediaRecorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(
            timerRef.current
          );

          timerRef.current = null;
        }

        const audioBlob = new Blob(
          audioChunksRef.current,
          {
            type: 'audio/webm',
          }
        );

        const audioFile = new File(
          [audioBlob],
          'recording.webm',
          {
            type: 'audio/webm',
          }
        );

        const previewUrl =
          URL.createObjectURL(
            audioBlob
          );

        setAudioPreviewUrl(
          previewUrl
        );

        setFile(audioFile);
        setFileCategory('audio');

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      };

      mediaRecorder.start();

      setIsRecording(true);

      timerRef.current =
        setInterval(() => {
          setRecordSeconds(
            (prev) => prev + 1
          );
        }, 1000);
    } catch {
      alert(
        'Microphone access denied. Please check browser permissions.'
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      isRecording
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    const type = file
      ? fileCategory
      : rawText.trim()
      ? 'text'
      : null;

    if (!type) return;

    onSubmit({
      type,
      file,
      rawText,
      targetLanguage: targetLang,
      sourceLanguage: sourceOverride,
    });
  };

  const clearPayload = () => {

    if (audioPreviewUrl) {
      URL.revokeObjectURL(
        audioPreviewUrl
      );
    }

    setFile(null);
    setFileCategory(null);
    setRawText('');
    setRecordSeconds(0);
    setLiveDetectedLang(undefined);
    setSourceOverride('');
    setAudioPreviewUrl(undefined);
  };

  const hasPayload =
    !!file ||
    rawText.trim().length > 0;

  const muted = darkMode
    ? 'text-zinc-500'
    : 'text-zinc-400';

  const fileTypeIcon =
    fileCategory === 'video' ? (
      <Video
        size={28}
        className="text-rose-500"
      />
    ) : fileCategory === 'audio' ? (
      <Mic
        size={28}
        className="text-amber-500"
      />
    ) : fileCategory === 'ocr' ? (
      <ImageIcon
        size={28}
        className="text-emerald-500"
      />
    ) : (
      <FileText
        size={28}
        className="text-indigo-500"
      />
    );

  const fileTypeLabel =
    fileCategory === 'video'
      ? t('ingestion.video')
      : fileCategory === 'audio'
      ? `${t('ingestion.audio')} / ${t(
          'ingestion.recordVoice'
        )}`
      : fileCategory === 'ocr'
      ? t('ingestion.pdfImage')
      : t('ingestion.text');

  return (
    <div className="space-y-5 stagger">
      {!file && (
        <div className="animate-fadeUp">
          {/* Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() =>
              setIsDragging(false)
            }
            onDrop={handleDrop}
            onClick={() =>
              !isRecording &&
              fileInputRef.current?.click()
            }
            className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/[0.06]'
                : `${
                    darkMode
                      ? 'border-white/[0.08] hover:border-indigo-500/40 bg-[#111118]'
                      : 'border-black/[0.08] hover:border-indigo-400/50 bg-white'
                  }`
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              className="hidden"
              accept=".txt,.pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.wav,.mp3,.aac,.m4a,.flac,.ogg,.wma,.webm,.mp4,.mov,.avi,.wmv,.mkv,.flv"
            />

            <UploadCloud
              size={48}
              className={`mb-4 ${
                isDragging
                  ? 'text-indigo-500'
                  : muted
              }`}
            />

            <p className="text-base font-bold mb-1.5">
              {t('ingestion.dropFile')}
            </p>

            <p
              className={`text-sm ${muted}`}
            >
              {t('ingestion.pickDevice')}
            </p>

            <div className="flex items-center gap-3 mt-5 flex-wrap justify-center">
              {[
                {
                  icon: <FileText size={18} />,
                  label: t(
                    'ingestion.text'
                  ),
                  color:
                    'text-indigo-500 bg-indigo-500/10',
                },
                {
                  icon: (
                    <ImageIcon size={18} />
                  ),
                  label: t(
                    'ingestion.pdfImage'
                  ),
                  color:
                    'text-emerald-500 bg-emerald-500/10',
                },
                {
                  icon: <Mic size={18} />,
                  label: t(
                    'ingestion.audio'
                  ),
                  color:
                    'text-amber-500 bg-amber-500/10',
                },
                {
                  icon: <Video size={18} />,
                  label: t(
                    'ingestion.video'
                  ),
                  color:
                    'text-rose-500 bg-rose-500/10',
                },
              ].map((item, i) => (
                <span
                  key={i}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${item.color}`}
                >
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Recording */}
          <div className="flex justify-center mt-5">
            {!isRecording ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRecording();
                }}
                className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all border-2 ${
                  darkMode
                    ? 'border-white/[0.08] text-zinc-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.05]'
                    : 'border-black/[0.08] text-zinc-500 hover:text-red-500 hover:border-red-400/40 hover:bg-red-50'
                }`}
              >
                <Mic size={20} />
                {t(
                  'ingestion.recordVoice'
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-4 w-4 rounded-full bg-red-500 animate-pulse-ring" />
                    <span className="relative h-4 w-4 rounded-full bg-red-500" />
                  </div>

                  <span
                    className={`text-3xl font-mono font-bold tabular-nums ${
                      darkMode
                        ? 'text-zinc-200'
                        : 'text-zinc-800'
                    }`}
                  >
                    {formatTime(
                      recordSeconds
                    )}
                  </span>

                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      darkMode
                        ? 'text-red-400/80'
                        : 'text-red-500/80'
                    }`}
                  >
                    {t(
                      'ingestion.recording'
                    )}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stopRecording();
                  }}
                  className="px-6 py-3 rounded-2xl text-sm font-bold bg-red-500 text-white flex items-center gap-2.5 hover:bg-red-600 transition-colors shadow-md"
                >
                  <Square
                    size={16}
                    fill="currentColor"
                  />
                  {t(
                    'ingestion.stopRecording'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3 my-6">
            <div
              className={`h-px flex-1 ${
                darkMode
                  ? 'bg-white/[0.05]'
                  : 'bg-black/[0.05]'
              }`}
            />

            <span
              className={`text-xs font-bold uppercase tracking-widest ${muted}`}
            >
              {t(
                'ingestion.typePaste'
              )}
            </span>

            <div
              className={`h-px flex-1 ${
                darkMode
                  ? 'bg-white/[0.05]'
                  : 'bg-black/[0.05]'
              }`}
            />
          </div>

          {/* Text */}
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setLiveDetectedLang(undefined);
              setDetectionUnavailable(false);
            }}
            placeholder={t(
              'ingestion.placeholder'
            )}
            rows={4}
            className={`w-full p-4 rounded-2xl border-2 text-sm outline-none resize-none transition-all focus:ring-2 focus:ring-indigo-500/20 ${
              darkMode
                ? 'border-white/[0.07] bg-[#111118] text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40'
                : 'border-black/[0.07] bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-indigo-400/50'
            }`}
          />

          {rawText.trim() && (
            <p
              className={`text-xs font-mono mt-1.5 ${muted}`}
            >
              {rawText.length}{' '}
              {t(
                'ingestion.characters'
              )}
            </p>
          )}
        </div>
      )}

      {/* File Preview */}
      {file && (
        <div
          className={`p-5 rounded-2xl border-2 flex items-center gap-4 animate-fadeUp ${
            darkMode
              ? 'border-white/[0.07] bg-[#111118]'
              : 'border-black/[0.07] bg-white'
          }`}
        >
          <div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
              darkMode
                ? 'bg-white/[0.05]'
                : 'bg-black/[0.03]'
            }`}
          >
            {fileTypeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">
              {file.name}
            </p>

            <p
              className={`text-xs mt-0.5 ${muted}`}
            >
              {fileTypeLabel} ·{' '}
              {(file.size / 1024).toFixed(0)} KB

              {fileCategory === 'audio' &&
                recordSeconds > 0 &&
                ` · ${formatTime(
                  recordSeconds
                )}`}
            </p>

            {fileCategory === 'audio' &&
              audioPreviewUrl && (
                <audio
                  key={audioPreviewUrl}
                  controls
                  src={audioPreviewUrl}
                  className="w-full h-9 mt-2"
                />
              )}
          </div>

          <button
            onClick={clearPayload}
            className={`p-2 rounded-xl transition-colors ${
              darkMode
                ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04]'
            }`}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Language + Submit */}
      {hasPayload && (
        <div className="space-y-4 animate-fadeUp">
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-widest mb-3 ${muted}`}
            >
              {t(
                'ingestion.translateTo'
              )}
            </label>

            {(effectiveLang || rawText.trim()) && (
              <div
                className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs font-semibold w-fit ${
                  darkMode
                    ? 'bg-indigo-500/[0.12] text-indigo-300 border border-indigo-500/20'
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                }`}
              >
                {!effectiveLang && !detectionUnavailable ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}

                {t(
                  sourceOverride ? 'ingestion.selectedSource' : 'ingestion.detectedSource'
                )}{' '}

                {(() => {
                  const language = capabilities.find(lang => lang.iso === effectiveLang);
                  return language ? languageLabel(language.key, language.name) : effectiveLang || (detectionUnavailable ? t('ingestion.detectionUnavailable') : t('ingestion.detecting'));
                })()}
              </div>
            )}

            <label className="block text-base font-semibold mb-4">{t('ingestion.sourceOverride')}
              <select className={`block mt-2 rounded-xl px-4 py-3 min-h-12 border-2 w-full text-base font-medium focus:ring-2 focus:ring-indigo-500/30 ${darkMode ? 'bg-[#111118] border-white/[0.12] text-zinc-100' : 'bg-white border-black/[0.12] text-zinc-900'}`} value={sourceOverride} onChange={event => setSourceOverride(event.target.value)}>
                <option value="">{t('ingestion.autoDetect')}</option>
                {capabilities.filter(lang => lang.translation && (fileCategory !== 'ocr' || lang.ocr)).map(lang => <option key={lang.key} value={lang.iso}>{languageLabel(lang.key, lang.name)}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-h-64 overflow-y-auto custom-scrollbar">
              {capabilities.filter(lang => lang.translation && (!['audio', 'video'].includes(fileCategory || '') || lang.tts)).map(
                ({key, native_name: script, name: native, iso: srcCode, tts}) => {
                  const isSourceLang =
                    effectiveLang ===
                    srcCode;

                  return (
                    <button
                      key={key}
                      onClick={() =>
                        !isSourceLang &&
                        setTargetLang(
                          key
                        )
                      }
                      disabled={
                        isSourceLang
                      }
                      title={
                        isSourceLang
                          ? `Source is already ${native}`
                          : undefined
                      }
                      style={{
                        display:
                          isSourceLang
                            ? 'none'
                            : undefined,
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        targetLang === key
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : `${
                              darkMode
                                ? 'border-white/[0.07] text-zinc-300 hover:bg-white/[0.03]'
                                : 'border-black/[0.07] text-zinc-700 hover:bg-black/[0.02]'
                            }`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold">
                          {languageLabel(key, native)}
                        </span>

                        {targetLang ===
                          key && (
                          <CheckCircle
                            size={20}
                            className="opacity-80"
                          />
                        )}
                      </div>

                      <span
                        className={`text-lg font-semibold ${
                          targetLang === key
                            ? 'text-indigo-200'
                            : muted
                        }`}
                      >
                        {script}
                      </span>
                      {!tts && <span className="block text-[10px] mt-1 opacity-70">{t('ingestion.noVoice')}</span>}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isDisabled || !capabilities.length || effectiveLang === capabilities.find(lang => lang.key === targetLang)?.iso}
            id="btn-submit"
            className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 transition-all ${
              isDisabled
                ? `${
                    darkMode
                      ? 'bg-white/[0.04] text-zinc-600'
                      : 'bg-black/[0.03] text-zinc-400'
                  } cursor-not-allowed`
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 active:scale-[0.99]'
            }`}
          >
            <Send size={20} />
            {t(
              'ingestion.startTranslation'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
