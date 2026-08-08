import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileText, Mic, Video, Image as ImageIcon,
  Square, CheckCircle, Send, X
} from 'lucide-react';

type FileCategory = 'text' | 'audio' | 'video' | 'ocr' | null;

interface IngestionFormProps {
  darkMode: boolean;
  onSubmit: (payload: {
    type: FileCategory;
    file: File | null;
    rawText: string;
    targetLanguage: string;
  }) => void;
  isDisabled: boolean;
}

export default function IngestionForm({ darkMode, onSubmit, isDisabled }: IngestionFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState<FileCategory>(null);
  const [rawText, setRawText] = useState('');
  const [targetLang, setTargetLang] = useState('marathi');
  const [isDragging, setIsDragging] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const categorizeFile = (f: File): FileCategory => {
    if (f.type.startsWith('video/')) return 'video';
    if (f.type.startsWith('audio/')) return 'audio';
    if (f.type.startsWith('image/') || f.type === 'application/pdf') return 'ocr';
    return 'text';
  };

  const handleFile = (f: File) => {
    const cat = categorizeFile(f);
    setFile(f);
    setFileCategory(cat);
    if (cat === 'text') {
      const reader = new FileReader();
      reader.onload = (e) => setRawText(e.target?.result as string);
      reader.readAsText(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ---- Recording ----
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordSeconds(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        setFile(audioFile);
        setFileCategory('audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250); // collect data every 250ms for reliability
      setIsRecording(true);

      // Start visual timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      alert("Microphone access denied. Check browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    const type = file ? fileCategory : (rawText.trim() ? 'text' : null);
    if (!type) return;
    onSubmit({ type, file, rawText, targetLanguage: targetLang });
  };

  const clearPayload = () => {
    setFile(null);
    setFileCategory(null);
    setRawText('');
    setRecordSeconds(0);
  };

  const hasPayload = !!file || rawText.trim().length > 0;
  const bg = darkMode ? 'bg-[#111118]' : 'bg-white';
  const border = darkMode ? 'border-white/[0.06]' : 'border-black/[0.06]';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className="space-y-5 stagger">

      {/* ==========================================
          UPLOAD ZONE (shown when no file selected)
          ========================================== */}
      {!file && (
        <div className="animate-fadeUp">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isRecording && fileInputRef.current?.click()}
            className={`relative border rounded-xl p-8 flex flex-col items-center text-center transition-all cursor-pointer ${border} ${
              isDragging
                ? 'border-indigo-500/50 bg-indigo-500/[0.03]'
                : `${bg} hover:border-indigo-500/30`
            }`}
          >
            <input ref={fileInputRef} type="file" onChange={handleFileInput} className="hidden"
              accept=".txt,.pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.wav,.mp3,.aac,.m4a,.flac,.ogg,.wma,.webm,.mp4,.mov,.avi,.wmv,.mkv,.flv" />

            <UploadCloud size={24} className={`mb-3 ${muted}`} />
            <p className="text-sm font-medium mb-1">Drop a file here or click to browse</p>
            <p className={`text-xs ${muted}`}>Documents, scanned PDFs, audio, or video</p>

            <div className="flex items-center gap-2 mt-4">
              {[
                { icon: <FileText size={12} />, label: '.txt' },
                { icon: <ImageIcon size={12} />, label: '.pdf' },
                { icon: <Mic size={12} />, label: '.wav' },
                { icon: <Video size={12} />, label: '.mp4' },
              ].map((t, i) => (
                <span key={i} className={`text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1 ${
                  darkMode ? 'bg-white/[0.03] text-zinc-500' : 'bg-black/[0.02] text-zinc-400'
                }`}>{t.icon} {t.label}</span>
              ))}
            </div>
          </div>

          {/* ---- Recording Button ---- */}
          <div className="flex justify-center mt-4">
            {!isRecording ? (
              <button
                onClick={(e) => { e.stopPropagation(); startRecording(); }}
                className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border ${
                  darkMode
                    ? 'border-white/[0.06] text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.04]'
                    : 'border-black/[0.06] text-zinc-500 hover:text-red-500 hover:border-red-500/20 hover:bg-red-50'
                }`}
              >
                <Mic size={13} /> Record Audio
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {/* Live Timer Display */}
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-3 w-3 rounded-full bg-red-500 animate-pulse-ring" />
                    <span className="relative h-3 w-3 rounded-full bg-red-500" />
                  </div>
                  <span className={`text-2xl font-mono font-bold tabular-nums ${
                    darkMode ? 'text-zinc-200' : 'text-zinc-800'
                  }`}>{formatTime(recordSeconds)}</span>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${
                    darkMode ? 'text-red-400/70' : 'text-red-500/70'
                  }`}>Recording</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); stopRecording(); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500 text-white flex items-center gap-2 hover:bg-red-600 transition-colors shadow-sm"
                >
                  <Square size={11} fill="currentColor" /> Stop
                </button>
              </div>
            )}
          </div>

          {/* ---- Separator ---- */}
          <div className="flex items-center gap-3 my-5">
            <div className={`h-px flex-1 ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
            <span className={`text-[10px] font-medium uppercase tracking-widest ${muted}`}>Or enter text</span>
            <div className={`h-px flex-1 ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
          </div>

          {/* ---- Raw Text Area ---- */}
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste or type English text here..."
            rows={3}
            className={`w-full p-4 rounded-xl border text-sm outline-none resize-none transition-all focus:ring-1 focus:ring-indigo-500/30 ${border} ${
              darkMode
                ? 'bg-[#111118] text-zinc-200 placeholder:text-zinc-600'
                : 'bg-white text-zinc-800 placeholder:text-zinc-400'
            }`}
          />
          {rawText.trim() && (
            <div className="flex justify-between items-center mt-1.5">
              <span className={`text-[10px] font-mono ${muted}`}>{rawText.length} chars</span>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          FILE PREVIEW (shown when file is selected)
          ========================================== */}
      {file && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fadeUp ${border} ${bg}`}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
            darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.02]'
          }`}>
            {fileCategory === 'video' ? <Video size={16} className="text-rose-500" /> :
             fileCategory === 'audio' ? <Mic size={16} className="text-amber-500" /> :
             fileCategory === 'ocr' ? <ImageIcon size={16} className="text-emerald-500" /> :
             <FileText size={16} className="text-indigo-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className={`text-[10px] font-mono ${muted}`}>
              {fileCategory?.toUpperCase()} · {(file.size / 1024).toFixed(0)} KB
              {fileCategory === 'audio' && recordSeconds > 0 && ` · ${formatTime(recordSeconds)}`}
            </p>
            {fileCategory === 'audio' && (
              <audio controls src={URL.createObjectURL(file)} className="w-full h-8 mt-2" />
            )}
          </div>
          <button onClick={clearPayload} className={`p-1.5 rounded-md transition-colors ${
            darkMode ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]' : 'text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.03]'
          }`}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==========================================
          LANGUAGE + SUBMIT
          ========================================== */}
      {hasPayload && (
        <div className="space-y-4 animate-fadeUp">
          {/* Language Selector */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-2 ${muted}`}>
              Target Language
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'marathi', script: 'मराठी' },
                { key: 'hindi', script: 'हिन्दी' },
              ] as const).map(({ key, script }) => (
                <button
                  key={key}
                  onClick={() => setTargetLang(key)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    targetLang === key
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : `${border} ${darkMode ? 'text-zinc-300 hover:bg-white/[0.02]' : 'text-zinc-700 hover:bg-black/[0.01]'}`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">{key}</span>
                    {targetLang === key && <CheckCircle size={13} className="opacity-70" />}
                  </div>
                  <span className={`text-[10px] ${targetLang === key ? 'text-indigo-200' : muted}`}>
                    {script} · Devanagari
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              isDisabled
                ? `${darkMode ? 'bg-white/[0.04] text-zinc-600' : 'bg-black/[0.03] text-zinc-400'} cursor-not-allowed`
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.99]'
            }`}
          >
            <Send size={14} />
            Process
          </button>
        </div>
      )}
    </div>
  );
}
