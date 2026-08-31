import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  Square,
  Volume2,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Database,
  ChevronDown,
  ChevronRight,
  FileText,
  Video,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Zap,
  Info,
  BookOpen,
  Brain,
} from 'lucide-react';

import {
  askKnowledge,
  rebuildKnowledgeIndex,
  fetchKnowledgeStatus,
  synthesizeChatAudio,
  submitAudioJob,
  pollJob,
  type KnowledgeSource,
  type KnowledgeStatusResponse,
} from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detected_language?: string;
  sources?: KnowledgeSource[];
  audio_url?: string | null;
  latency_sec?: number;
  model_used?: string;
  timestamp: string;
}

interface KnowledgeAssistantProps {
  darkMode: boolean;
}

const EXAMPLE_QUESTIONS = [
  {
    lang: 'mr',
    label: 'Marathi मराठी',
    text: 'शेतीमध्ये सेंद्रिय खतांचा वापर कसा करावा आणि त्याचे काय फायदे आहेत?',
    category: 'माती व खते (Soil & Fertilizer)',
  },
  {
    lang: 'hi',
    label: 'Hindi हिन्दी',
    text: 'मेरी गाय का दूध अचानक कम हो गया है, मुझे क्या उपाय करना चाहिए?',
    category: 'पशुपालन (Dairy & Livestock)',
  },
  {
    lang: 'en',
    label: 'English',
    text: 'What are the best irrigation and pest management practices for cotton crops?',
    category: 'Crop Care & Irrigation',
  },
  {
    lang: 'mr',
    label: 'Marathi मराठी',
    text: 'दुग्ध व्यवसायासाठी हिरवा चारा साठवणूक (मूरघास) कशी करावी?',
    category: 'चारा नियोजन (Silage & Fodder)',
  },
];

/** Split a Qwen3 reply into its <think>…</think> block and the clean answer. */
function parseThinkBlock(raw: string): { think: string | null; answer: string } {
  const match = raw.match(/^<think>([\s\S]*?)<\/think>\s*/i);
  if (match) {
    return { think: match[1].trim(), answer: raw.slice(match[0].length).trim() };
  }
  // Handle unclosed <think> (model cut off mid-stream)
  const openOnly = raw.match(/^<think>([\s\S]*)$/i);
  if (openOnly) {
    return { think: openOnly[1].trim(), answer: '' };
  }
  return { think: null, answer: raw.trim() };
}

export default function KnowledgeAssistant({ darkMode }: KnowledgeAssistantProps) {
  const { t } = useLanguage();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('baif_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedThink, setExpandedThink] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);

  // Status & Index info
  const [status, setStatus] = useState<KnowledgeStatusResponse | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  // Audio Recording for Mic Input
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Save conversation history to local storage
  useEffect(() => {
    localStorage.setItem('baif_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Load Status on Mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await fetchKnowledgeStatus();
      setStatus(data);
    } catch (e) {
      console.warn('Failed to load KB status', e);
    }
  };

  // Scroll to bottom when new messages appear
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputQuery]);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setRebuildMsg(null);
    try {
      const res = await rebuildKnowledgeIndex();
      setRebuildMsg(res.message);
      await loadStatus();
    } catch (e: any) {
      setRebuildMsg(`Rebuild failed: ${e.message}`);
    } finally {
      setIsRebuilding(false);
      setTimeout(() => setRebuildMsg(null), 4000);
    }
  };

  const handleSend = async (queryOverride?: string) => {
    const query = (queryOverride || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsgId = String(Date.now());
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    // Build past history (last 6 messages)
    const historyPayload = newMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await askKnowledge(query, historyPayload, true);

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: response.answer,
        detected_language: response.detected_language,
        sources: response.sources,
        audio_url: response.audio_url,
        latency_sec: response.latency_sec,
        model_used: response.model_used,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Error: ${err.message || 'Could not retrieve knowledge. Please ensure the server is running.'}`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      loadStatus();
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation?')) {
      setMessages([]);
      localStorage.removeItem('baif_chat_history');
    }
  };

  const toggleSourceExpand = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleThinkExpand = (id: string) => {
    setExpandedThink((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePlayTTS = async (msg: ChatMessage) => {
    if (playingAudioId === msg.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }

    let url = msg.audio_url;

    if (!url) {
      setAudioLoadingId(msg.id);
      try {
        const lang = msg.detected_language || 'hi';
        // Strip <think> block — TTS should only speak the clean answer
        const { answer: ttsText } = parseThinkBlock(msg.content);
        const res = await synthesizeChatAudio(ttsText || msg.content, lang);
        url = res.audio_url;
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, audio_url: url } : m))
        );
      } catch (e: any) {
        alert(`TTS Error: ${e.message}`);
        setAudioLoadingId(null);
        return;
      } finally {
        setAudioLoadingId(null);
      }
    }

    if (url) {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.onended = () => setPlayingAudioId(null);
      audioPlayerRef.current.onerror = () => setPlayingAudioId(null);
      audioPlayerRef.current.play();
      setPlayingAudioId(msg.id);
    }
  };

  // ==========================================
  // MICROPHONE SPEECH-TO-TEXT (ASR)
  // ==========================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], 'mic_question.webm', { type: blob.type });

        setIsTranscribing(true);
        try {
          // Submit audio job to transcribe via existing ASR
          const submitRes = await submitAudioJob(file, 'english');
          const pollInterval = setInterval(async () => {
            try {
              const jobStatus = await pollJob(submitRes.job_id);
              if (jobStatus.status === 'complete') {
                clearInterval(pollInterval);
                setIsTranscribing(false);
                const transcript = jobStatus.result?.original_text || jobStatus.result?.translated_text;
                if (transcript && transcript.trim()) {
                  setInputQuery(transcript.trim());
                  // Automatically trigger ask with the speech transcript
                  handleSend(transcript.trim());
                }
              } else if (jobStatus.status === 'error') {
                clearInterval(pollInterval);
                setIsTranscribing(false);
                alert('Could not transcribe speech. Please try typing.');
              }
            } catch {
              clearInterval(pollInterval);
              setIsTranscribing(false);
            }
          }, 1000);
        } catch (e: any) {
          setIsTranscribing(false);
          alert(`Speech recognition failed: ${e.message}`);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Styles
  const border = darkMode ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const cardBg = darkMode ? 'bg-[#111118]' : 'bg-white';
  const muted = darkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto animate-fadeUp">
      {/* ==========================================
          HEADER & KNOWLEDGE STATUS BAR
          ========================================== */}
      <div className={`p-4 rounded-2xl border ${border} ${cardBg} mb-4 shadow-sm shrink-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Agricultural Knowledge Assistant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Offline Qwen3-4B
                </span>
              </div>
              <p className={`text-xs ${muted}`}>
                Grounded answers from your processed agricultural documents in English, हिन्दी, & मराठी.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${border} ${darkMode ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
              <Database size={13} className="text-indigo-400" />
              <span className="font-semibold">{status?.indexed_chunks ?? 0}</span>
              <span className={muted}>chunks</span>
            </div>

            <button
              onClick={handleRebuild}
              disabled={isRebuilding}
              title="Re-index all documents in the database into the FAISS vector store"
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isRebuilding
                  ? 'opacity-60 cursor-not-allowed'
                  : darkMode
                  ? 'hover:bg-white/[0.06] text-zinc-300'
                  : 'hover:bg-black/[0.04] text-zinc-700'
              } ${border}`}
            >
              {isRebuilding ? (
                <>
                  <Loader2 size={13} className="animate-spin text-indigo-400" />
                  Indexing...
                </>
              ) : (
                <>
                  <RotateCcw size={13} />
                  Re-index KB
                </>
              )}
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors ${border}`}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Model Missing Notice */}
        {status && !status.model_available && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
            <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold">Model File Required:</span> Place{' '}
              <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px] text-amber-200">
                Qwen3-4B-Q4_K_M.gguf
              </code>{' '}
              into <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px]">server/models/</code> to
              enable local LLM reasoning. The assistant will currently extract matching passages directly.
            </div>
          </div>
        )}

        {/* Rebuild Message feedback */}
        {rebuildMsg && (
          <div className="mt-2 text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            {rebuildMsg}
          </div>
        )}
      </div>

      {/* ==========================================
          CHAT MESSAGE FEED
          ========================================== */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 rounded-2xl border ${border} ${cardBg} mb-4 scrollbar-thin`}>
        {messages.length === 0 ? (
          /* Empty State / Welcome Hero */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center shadow-lg">
              <Bot size={36} />
            </div>

            <div className="max-w-md space-y-1.5">
              <h3 className="text-lg font-bold">Ask anything about your agricultural knowledge</h3>
              <p className={`text-xs ${muted}`}>
                Questions are answered strictly from the knowledge indexed in your Bhasha Node database. No hallucinations.
              </p>
            </div>

            <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {EXAMPLE_QUESTIONS.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(ex.text)}
                  className={`p-3.5 rounded-xl border text-left transition-all group ${border} ${
                    darkMode
                      ? 'bg-white/[0.02] hover:bg-indigo-600/[0.08] hover:border-indigo-500/40'
                      : 'bg-black/[0.01] hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-indigo-400">{ex.label}</span>
                    <span className={`text-[9px] ${muted}`}>{ex.category}</span>
                  </div>
                  <p className="text-xs font-medium line-clamp-2 group-hover:text-indigo-400 transition-colors">
                    {ex.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isPlaying = playingAudioId === msg.id;
            const isAudioLoading = audioLoadingId === msg.id;
            const sourcesExpanded = !!expandedSources[msg.id];
            const thinkExpanded = !!expandedThink[msg.id];
            const { think, answer: cleanAnswer } = parseThinkBlock(msg.content);

            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeUp`}>
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-2`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-4 rounded-2xl ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-600/20'
                        : `${darkMode ? 'bg-white/[0.04] text-zinc-100' : 'bg-zinc-100 text-zinc-900'} rounded-tl-sm border ${border}`
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {isUser ? msg.content : (cleanAnswer || msg.content)}
                    </p>

                    {/* Assistant Metadata Badges */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.06] text-[11px]">
                        {msg.detected_language && (
                          <span className={`px-2 py-0.5 rounded-md font-semibold ${
                            darkMode ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {msg.detected_language === 'mr'
                              ? 'Marathi मराठी'
                              : msg.detected_language === 'hi'
                              ? 'Hindi हिन्दी'
                              : 'English'}
                          </span>
                        )}

                        {msg.latency_sec !== undefined && (
                          <span className={`flex items-center gap-1 font-mono ${muted}`}>
                            <Clock size={10} />
                            {msg.latency_sec}s
                          </span>
                        )}

                        {/* Audio TTS Button for Marathi & Hindi */}
                        {(msg.detected_language === 'mr' || msg.detected_language === 'hi') && (
                          <button
                            onClick={() => handlePlayTTS(msg)}
                            disabled={isAudioLoading}
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                              isPlaying
                                ? 'bg-amber-500 text-white'
                                : darkMode
                                ? 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]'
                                : 'bg-black/[0.05] text-zinc-700 hover:bg-black/[0.08]'
                            }`}
                          >
                            {isAudioLoading ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Volume2 size={11} />
                            )}
                            {isPlaying ? 'Pause Voice' : 'Listen Voice'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AI Reasoning (think block) Collapsible */}
                  {!isUser && think && (
                    <div className={`p-2.5 rounded-xl border ${border} ${
                      darkMode ? 'bg-violet-950/20 border-violet-500/20' : 'bg-violet-50 border-violet-200'
                    }`}>
                      <button
                        onClick={() => toggleThinkExpand(msg.id)}
                        className={`w-full flex items-center justify-between text-xs font-semibold transition-colors ${
                          darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Brain size={13} />
                          AI Reasoning Trace
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            darkMode ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-600'
                          }`}>internal</span>
                        </span>
                        {thinkExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {thinkExpanded && (
                        <div className={`mt-2.5 pt-2 border-t ${
                          darkMode ? 'border-violet-500/20' : 'border-violet-200'
                        }`}>
                          <p className={`text-[11px] leading-relaxed whitespace-pre-wrap font-mono ${
                            darkMode ? 'text-violet-300/70' : 'text-violet-700/80'
                          }`}>
                            {think}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grounded Sources Collapsible */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className={`p-2.5 rounded-xl border ${border} ${darkMode ? 'bg-black/20' : 'bg-white'}`}>
                      <button
                        onClick={() => toggleSourceExpand(msg.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} />
                          Verified Grounded Sources ({msg.sources.length})
                        </span>
                        {sourcesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {sourcesExpanded && (
                        <div className="mt-2.5 space-y-2 pt-2 border-t border-white/[0.05]">
                          {msg.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              className={`p-2 rounded-lg border text-xs ${border} ${
                                darkMode ? 'bg-white/[0.02]' : 'bg-black/[0.01]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 font-semibold">
                                <span className="flex items-center gap-1.5 text-zinc-300 truncate max-w-[240px]">
                                  {src.input_type === 'video' ? (
                                    <Video size={12} className="text-rose-400 shrink-0" />
                                  ) : src.input_type === 'audio' ? (
                                    <Music size={12} className="text-amber-400 shrink-0" />
                                  ) : (
                                    <FileText size={12} className="text-emerald-400 shrink-0" />
                                  )}
                                  {src.source}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[10px]">
                                  {src.score}% match
                                </span>
                              </div>
                              <p className={`text-[11px] leading-relaxed italic ${muted}`}>
                                "{src.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`text-[10px] ${muted} ${isUser ? 'text-right' : 'text-left'} px-1`}>
                    {msg.timestamp}
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Thinking Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-fadeUp">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bot size={18} />
            </div>
            <div className={`p-4 rounded-2xl rounded-tl-sm border ${border} ${darkMode ? 'bg-white/[0.04]' : 'bg-zinc-100'} flex items-center gap-3`}>
              <Loader2 size={18} className="animate-spin text-indigo-400" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold">Retrieving agricultural knowledge & reasoning...</p>
                <p className={`text-[10px] ${muted}`}>Grounding strictly from indexed documents via Qwen3-4B</p>
              </div>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* ==========================================
          INPUT BAR (Text + Mic + Send)
          ========================================== */}
      <div className={`p-3 rounded-2xl border ${border} ${cardBg} shadow-lg shrink-0`}>
        {/* Recording active state */}
        {isRecording ? (
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-xs font-bold text-red-400">
                Listening to farmer... ({recordSeconds}s)
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-md"
            >
              <Square size={12} fill="currentColor" />
              Stop & Ask
            </button>
          </div>
        ) : isTranscribing ? (
          <div className="flex items-center justify-center gap-2.5 p-3 text-xs font-semibold text-indigo-400">
            <Loader2 size={16} className="animate-spin" />
            Transcribing speech with Faster-Whisper...
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Microphone Button */}
            <button
              onClick={startRecording}
              disabled={isLoading}
              title="Speak question in English, Marathi, or Hindi"
              className={`p-3 rounded-xl border transition-all ${border} ${
                darkMode
                  ? 'hover:bg-white/[0.06] text-amber-400 hover:border-amber-500/40'
                  : 'hover:bg-amber-50 text-amber-600 hover:border-amber-300'
              }`}
            >
              <Mic size={18} />
            </button>

            {/* Textarea Input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask an agricultural question in English, हिन्दी, or मराठी... (Press Enter to send)"
              className={`flex-1 p-2.5 text-sm rounded-xl outline-none resize-none bg-transparent ${
                darkMode ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-zinc-900 placeholder:text-zinc-400'
              }`}
            />

            {/* Send Button */}
            <button
              onClick={() => handleSend()}
              disabled={!inputQuery.trim() || isLoading}
              className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all ${
                !inputQuery.trim() || isLoading
                  ? `${darkMode ? 'bg-white/[0.04] text-zinc-600' : 'bg-black/[0.04] text-zinc-400'} cursor-not-allowed`
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
