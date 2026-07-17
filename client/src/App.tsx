import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Mic, Video, Sun, Moon, UploadCloud, 
  Settings, CheckCircle, Image as ImageIcon, 
  Volume2, Languages, Cpu, Activity, AlertTriangle, Square
} from 'lucide-react';

type FileCategory = 'text' | 'audio' | 'video' | 'image' | null;
type ProcessingStatus = 'idle' | 'analyzing' | 'processing' | 'complete' | 'error';

interface PipelineResult {
  original_text?: string;
  translated_text?: string;
  audio_url?: string;
  video_url?: string;
  transcription?: string;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  
  // Unified State
  const [file, setFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState<FileCategory>(null);
  const [rawText, setRawText] = useState('');
  const [targetLang, setTargetLang] = useState('marathi');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [logs, setLogs] = useState<string[]>(['System initialized. Awaiting payload.']);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // ==========================================
  // MICROPHONE RECORDING LOGIC
  // ==========================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'live_recording.webm', { type: 'audio/webm' });
        
        setFile(audioFile);
        setFileCategory('audio');
        setStatus('idle');
        addLog('Live audio footprint captured. Ready for Whisper ASR.');
        
        // Release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      addLog('Microphone hardware engaged. Recording stream...');
    } catch (err) {
      console.error(err);
      alert("Microphone access denied. Check your browser permissions.");
      addLog('ERROR: Hardware permission denied for microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ==========================================
  // CORE PIPELINE LOGIC
  // ==========================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    setFile(selected);
    setStatus('analyzing');
    setResult(null);
    setRawText('');
    addLog(`Ingesting file: ${selected.name} (${(selected.size / 1024).toFixed(1)} KB)`);

    if (selected.type.startsWith('video/')) {
      setFileCategory('video');
      addLog('Video payload detected. Routing to Demuxer -> STT -> Translation -> TTS -> Remux.');
    } else if (selected.type.startsWith('audio/')) {
      setFileCategory('audio');
      addLog('Audio payload detected. Routing to Whisper ASR pipeline.');
    } else if (selected.type.startsWith('image/') || selected.type === 'application/pdf') {
      setFileCategory('image');
      addLog('Visual payload detected. Routing to Tesseract OCR.');
    } else {
      setFileCategory('text');
      const reader = new FileReader();
      reader.onload = (event) => setRawText(event.target?.result as string);
      reader.readAsText(selected);
      addLog('Text payload detected. Ready for Translation & TTS.');
    }
    
    setTimeout(() => setStatus('idle'), 600);
  };

  const executePipeline = async () => {
    if (!file && !rawText.trim()) return alert("Provide an input payload first.");
    
    setStatus('processing');
    addLog(`Initiating INT8 local pipeline for ${targetLang.toUpperCase()} target...`);
    
    try {
      if (fileCategory === 'video' && file) {
        addLog('Uploading video payload. CPU utilization will spike.');
        const formData = new FormData();
        formData.append('target_language', targetLang);
        formData.append('video_file', file);

        const response = await fetch('http://127.0.0.1:8000/process-video', {
          method: 'POST', body: formData,
        });
        
        if (!response.ok) throw new Error("FastAPI Video endpoint failed.");
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setResult(data);
        addLog('Video processing complete. Subtitles burned and audio remuxed.');

      } else if (fileCategory === 'audio' && file) {
        // NEW: LIVE AUDIO INTEGRATION
        addLog('Transmitting raw audio footprint to local Whisper ASR.');
        const formData = new FormData();
        formData.append('target_language', targetLang);
        formData.append('audio_file', file);

        const response = await fetch('http://127.0.0.1:8000/process-audio', {
          method: 'POST', body: formData,
        });
        
        if (!response.ok) throw new Error("FastAPI Audio endpoint failed.");
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setResult(data);
        addLog('ASR to TTS pipeline execution complete.');

      } else if (fileCategory === 'text' || (!file && rawText.trim())) {
        const payloadText = rawText || "Extracted text fallback";
        const response = await fetch('http://127.0.0.1:8000/process-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: payloadText, target_language: targetLang }),
        });
        
        if (!response.ok) throw new Error("FastAPI connection refused.");
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setResult(data);
        addLog('Inference complete. Output generated successfully.');
        
      } else {
        // PDF / IMAGE FALLBACK
        addLog(`Simulating ${fileCategory} processing (Tesseract OCR not yet wired)...`);
        await new Promise(res => setTimeout(res, 3000));
        setResult({
          translated_text: `[Simulated ${targetLang} OCR translation for ${file?.name}]`,
          audio_url: "" 
        });
        addLog('Simulated processing complete.');
      }
      setStatus('complete');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      addLog(`ERROR: ${error.message}`);
    }
  };

  const resetWorkspace = () => {
    setFile(null);
    setFileCategory(null);
    setRawText('');
    setResult(null);
    setStatus('idle');
    addLog('Workspace cleared.');
  };

  // ==========================================
  // UI RENDER
  // ==========================================
  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* LEFT PANEL: Telemetry */}
      <aside className={`w-80 flex flex-col border-r shadow-xl z-10 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-6 flex items-center justify-between border-b border-inherit">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/20">B</div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">BAIF Edge</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Node Active</p>
              </div>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg transition-all ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="p-6 border-b border-inherit space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Local Compute</h3>
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium flex items-center gap-2"><Cpu size={14} className="text-indigo-500"/> RAM (INT8)</span>
              <span className="text-xs font-mono">4.2 / 16 GB</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '25%' }}></div></div>
            
            <div className="flex justify-between items-center mt-4 mb-2">
              <span className="text-sm font-medium flex items-center gap-2"><Activity size={14} className="text-emerald-500"/> CPU Threading</span>
              <span className="text-xs font-mono">{status === 'processing' ? '98%' : '2%'}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5"><div className={`bg-emerald-500 h-1.5 rounded-full transition-all duration-500 ${status === 'processing' ? 'w-[98%]' : 'w-[2%]'}`}></div></div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Event Queue</h3>
          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] text-slate-400 pr-2 custom-scrollbar">
            {logs.map((log, i) => (
              <div key={i} className={`border-l-2 pl-2 ${i === 0 ? (status === 'error' ? 'border-rose-500 text-rose-500' : 'border-indigo-500 text-slate-800 dark:text-slate-300') : 'border-slate-300 dark:border-slate-700'}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className={`h-20 px-10 flex items-center justify-between border-b shrink-0 ${darkMode ? 'border-slate-800/50 bg-slate-900/50 backdrop-blur-md' : 'border-slate-200 bg-white/50 backdrop-blur-md'}`}>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Unified Ingestion Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">Drop any agricultural manual, field audio, or drone video below.</p>
          </div>
          {file && (
             <button onClick={resetWorkspace} className="text-sm font-semibold text-slate-500 hover:text-rose-500 transition-colors">
               Clear Workspace ×
             </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-10 pb-32">
          <div className="max-w-5xl mx-auto space-y-8">
            {!file && !rawText && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`relative group border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center transition-all ${
                  darkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-indigo-500' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500'
                }`}>
                  <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="h-20 w-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Secure Local Ingestion</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-500">
                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800"><FileText size={20} className="text-indigo-500"/> Docs (.txt)</div>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800"><ImageIcon size={20} className="text-emerald-500"/> Scans (.pdf)</div>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800"><Mic size={20} className="text-amber-500"/> Voice (.wav)</div>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800"><Video size={20} className="text-rose-500"/> Video (.mp4)</div>
                  </div>
                  
                  {/* LIVE RECORDING MODULE */}
                  <div className="flex flex-col items-center gap-4 z-20">
                    <div className="flex items-center gap-4">
                      {!isRecording ? (
                        <button 
                          onClick={startRecording}
                          className="px-6 py-2.5 rounded-full font-bold text-sm bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all flex items-center gap-2 shadow-sm"
                        >
                          <Mic size={16} /> Record Field Audio
                        </button>
                      ) : (
                        <button 
                          onClick={stopRecording}
                          className="px-6 py-2.5 rounded-full font-bold text-sm bg-rose-600 text-white border border-rose-700 hover:bg-rose-700 transition-all flex items-center gap-2 animate-pulse shadow-lg shadow-rose-600/30"
                        >
                          <Square size={16} fill="currentColor" /> Stop Recording
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">OR PASTE RAW TEXT</span>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                  </div>
                  <textarea 
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Enter English source context directly..."
                    className={`w-full h-32 p-5 rounded-2xl border outline-none text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-900 border-slate-700 focus:border-indigo-500 text-slate-200' : 'bg-white border-slate-300 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {(file || rawText) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                <div className="lg:col-span-5 space-y-6">
                  <div className={`p-6 rounded-3xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {fileCategory === 'video' ? <Video className="text-rose-500" /> : 
                         fileCategory === 'audio' ? <Mic className="text-amber-500" /> : 
                         fileCategory === 'image' ? <ImageIcon className="text-emerald-500" /> : 
                         <FileText className="text-indigo-500" />}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-lg truncate">{file ? file.name : "Direct Text Input"}</h3>
                        <p className="text-xs text-slate-500 font-mono">{fileCategory?.toUpperCase()} PAYLOAD DEPLOYED</p>

                        {/* AUDIO PREVIEW PLAYER */}
                        {fileCategory === 'audio' && file && (
                           <audio controls src={URL.createObjectURL(file)} className="w-full h-8 outline-none mt-2 opacity-80" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Target Demographics</label>
                        <div className="grid grid-cols-2 gap-3">
                          {['marathi', 'hindi'].map(lang => (
                            <div 
                              key={lang} 
                              onClick={() => setTargetLang(lang)}
                              className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                                targetLang === lang 
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                  : `${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold capitalize">{lang}</span>
                                {targetLang === lang && <CheckCircle size={16} opacity={0.8} />}
                              </div>
                              <span className={`text-[10px] ${targetLang === lang ? 'text-indigo-200' : 'text-slate-400'}`}>Devanagari Base</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={executePipeline} 
                        disabled={status === 'processing' || status === 'analyzing'}
                        className={`w-full py-4 rounded-2xl font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-3 ${
                          status === 'processing' || status === 'analyzing'
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95'
                        }`}
                      >
                        {status === 'processing' ? <><Settings className="animate-spin" size={18}/> Executing Layers...</> : 'Commence Inference'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className={`h-full min-h-100 p-8 rounded-3xl border flex flex-col transition-all ${
                    status === 'processing' ? (darkMode ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200') :
                    result ? (darkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-emerald-200') :
                    (darkMode ? 'bg-slate-900/50 border-slate-800 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')
                  }`}>
                    
                    {status === 'idle' && !result && (
                      <div className="m-auto text-center opacity-50">
                        <Cpu size={48} className="mx-auto mb-4 text-slate-400" />
                        <h3 className="font-bold text-lg">Inference Engine Ready</h3>
                        <p className="text-sm">Configure parameters and commence.</p>
                      </div>
                    )}

                    {status === 'processing' && (
                      <div className="m-auto text-center w-full max-w-md">
                        <div className="relative h-24 w-24 mx-auto mb-8">
                          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-slate-800"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                          <Settings size={32} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
                        </div>
                        <h3 className="font-bold text-xl mb-2 text-indigo-600 dark:text-indigo-400">Processing Node Active</h3>
                        <p className="text-sm font-mono opacity-70 mb-6">Demuxing, translating, and remuxing matrix...</p>
                      </div>
                    )}

                    {status === 'complete' && result && (
                      <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-inherit">
                          <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                            <CheckCircle size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">Synthesis Complete</h3>
                            <p className="text-xs text-slate-500 font-mono">100% OFFLINE EXTRACTION</p>
                          </div>
                        </div>

                        <div className="flex-1 space-y-6">
                          {result.video_url ? (
                            <div>
                              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                <Video size={14} /> Demuxed & Translated Video
                              </label>
                              <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <video controls src={result.video_url} className="w-full rounded-lg shadow-md bg-black" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                  <Languages size={14} /> Regional Text Output
                                </label>
                                <div className={`w-full p-6 rounded-2xl text-lg font-medium leading-relaxed border ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                                  {result.translated_text}
                                </div>
                              </div>
                              {(result.audio_url || fileCategory !== 'text') && (
                                <div>
                                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                    <Volume2 size={14} /> Acoustic VITS Profile
                                  </label>
                                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                    {result.audio_url ? (
                                      <audio controls src={result.audio_url} className="w-full h-12" />
                                    ) : (
                                      <div className="flex items-center justify-center h-12 text-sm text-slate-500 font-mono">
                                        [Audio Stream Mock - API Disconnected]
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {status === 'error' && (
                      <div className="m-auto text-center">
                        <AlertTriangle size={48} className="mx-auto mb-4 text-rose-500" />
                        <h3 className="font-bold text-xl text-rose-500">Pipeline Failure</h3>
                        <p className="text-sm opacity-70 mt-2 max-w-sm mx-auto">Check FastAPI and FFmpeg server logs.</p>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}