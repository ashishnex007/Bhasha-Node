import React, { useState, useEffect } from 'react';
import { FileText, Mic, FileAudio, Video, Sun, Moon, UploadCloud, PlayCircle, Settings, CheckCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('tts');
  const [darkMode, setDarkMode] = useState(false);
  
  // TTS Tab State (The actual working backend)
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('marathi');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ translated_text: string; audio_url: string } | null>(null);

  // Sync theme
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Working API Call
  const handleProcessTTS = async () => {
    if (!text.trim()) return alert("Enter text first.");
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, target_language: language }),
      });
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Pipeline failure. Verify FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: 'ocr', label: 'Document OCR', icon: FileText },
    { id: 'tts', label: 'Translation & TTS', icon: FileAudio },
    { id: 'stt', label: 'Audio Transcription', icon: Mic },
    { id: 'video', label: 'Video Processing', icon: Video },
  ];

  return (
    <div className={`flex h-screen font-sans transition-colors duration-200 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar Navigation */}
      <aside className={`w-72 flex flex-col border-r ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-inherit">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Bhasha Node</h1>
            <p className="text-xs text-slate-400">Offline BAIF Engine</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : `${darkMode ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-inherit">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
              darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-yellow-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {darkMode ? <><Sun size={16} /> Light Mode</> : <><Moon size={16} /> Dark Mode</>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <header className={`px-10 py-8 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <h2 className="text-2xl font-bold">{navItems.find(n => n.id === activeTab)?.label}</h2>
          <p className="text-sm text-slate-400 mt-1">Multi-modal local inference pipeline</p>
        </header>

        <div className="p-10 max-w-5xl">
          
          {/* ======================================= */}
          {/* TAB 1: Translation & TTS (FULLY WORKING) */}
          {/* ======================================= */}
          {activeTab === 'tts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Input */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <label className="block text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wide">English Context</label>
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste farming manual text here..."
                  className={`w-full h-40 p-4 rounded-xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'}`}
                />
                
                <label className="block text-xs font-semibold mt-6 mb-3 text-slate-500 uppercase tracking-wide">Target Demographics</label>
                <div className="flex gap-4">
                  {['marathi', 'hindi'].map(lang => (
                    <label key={lang} className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${
                      language === lang ? 'border-indigo-600 bg-indigo-50/10 text-indigo-500 ring-1 ring-indigo-500' : (darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')
                    }`}>
                      <input type="radio" className="hidden" checked={language === lang} onChange={() => setLanguage(lang)} />
                      <span className="text-sm font-semibold capitalize">{lang}</span>
                    </label>
                  ))}
                </div>

                <button onClick={handleProcessTTS} disabled={loading} className="w-full mt-8 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all">
                  {loading ? 'Running Quantized Models...' : 'Execute Translation'}
                </button>
              </div>

              {/* Output */}
              <div className={`p-6 rounded-2xl border flex flex-col ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h3 className="text-xs font-semibold mb-4 text-slate-500 uppercase tracking-wide">Inference Output</h3>
                
                {result ? (
                  <div className="space-y-6">
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-200 text-indigo-900'}`}>
                      <p className="text-lg leading-relaxed">{result.translated_text}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wide">VITS Acoustic Generation</p>
                      <audio controls src={result.audio_url} className="w-full rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                    <Settings size={32} className={loading ? 'animate-spin' : ''} />
                    <span className="mt-4 text-sm">{loading ? 'Synthesizing voice...' : 'Awaiting input data'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* TAB 2, 3, 4: Mock UIs for Presentation   */}
          {/* ======================================= */}
          {activeTab !== 'tts' && (
            <div className={`p-10 rounded-2xl border text-center border-dashed ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-300'}`}>
              <UploadCloud size={48} className={`mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
              <h3 className="text-xl font-bold mb-2">Upload {activeTab === 'ocr' ? 'Scanned Document' : activeTab === 'stt' ? 'Field Audio' : 'Heavy Media File'}</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                {activeTab === 'ocr' && "Extracts Devanagari script natively from scanned PDFs and field manuals using offline Tesseract LSTM."}
                {activeTab === 'stt' && "Transcribes heavy agricultural audio tracks using INT8 quantized Faster-Whisper directly on CPU."}
                {activeTab === 'video' && "Demuxes 200MB+ videos, generates subtitles, and burns in regional language captions entirely offline."}
              </p>
              
              <button className="px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-2">
                <UploadCloud size={18} /> Browse Local Drive
              </button>
              
              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
                <CheckCircle size={14} className="text-emerald-500" /> Endpoint strictly local. Zero data leaves BAIF premises.
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}