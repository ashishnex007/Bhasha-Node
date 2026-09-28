import {useEffect, useRef, useState} from 'react';
import {detectLanguage, type LanguageCapability} from '../services/api';

export type TaskKind = 'text' | 'ocr' | 'audio' | 'video';

interface Props {
  kind: TaskKind;
  languages: LanguageCapability[];
  onSubmit: (payload: {type: TaskKind; file: File | null; rawText: string; targetLanguage: string; sourceLanguage: string}) => Promise<void>;
}

const accept: Record<TaskKind, string> = {
  text: '.txt',
  ocr: '.pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp',
  audio: '.wav,.mp3,.aac,.m4a,.flac,.ogg,.wma,.webm',
  video: '.mp4,.mov,.avi,.wmv,.mkv,.flv,.webm',
};

export default function TaskForm({kind, languages, onSubmit}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState(() => {
    const remembered = localStorage.getItem('bhasha_target_language');
    return languages.find(lang => lang.key === remembered && lang.translation)?.key ||
      languages.find(lang => lang.translation)?.key || '';
  });
  const [source, setSource] = useState('');
  const [detected, setDetected] = useState<{language: string; score: number | null; available: boolean; supported: boolean} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => { setFile(null); setText(''); setSource(''); setDetected(null); setError(''); }, [kind]);
  useEffect(() => {
    if (kind !== 'text' || text.trim().length < 12) { setDetected(null); return; }
    const timer = setTimeout(() => {
      detectLanguage(text).then(setDetected).catch(() => setDetected(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [kind, text]);

  const selectFile = async (picked: File | null) => {
    if (!picked) return;
    if (kind === 'text') {
      setText(await picked.text());
    } else {
      setFile(picked);
    }
    setError('');
  };

  const toggleRecording = async () => {
    if (recording && recorder.current) { recorder.current.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, {type: mediaRecorder.mimeType});
        setFile(new File([blob], 'recording.webm', {type: blob.type}));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start(); setRecording(true);
    } catch { setError('Microphone access is unavailable. You can upload an audio file instead.'); }
  };

  const submit = async () => {
    if ((kind === 'text' && !text.trim()) || (kind !== 'text' && !file)) {
      setError(kind === 'text' ? 'Enter text to translate.' : 'Choose a file to translate.'); return;
    }
    const resolvedSource = source || (detected?.supported ? detected.language : '');
    if (kind === 'text' && detected && !detected.supported && !source) {
      setError('This detected language is not available. Choose a supported source language.'); return;
    }
    if (kind === 'text' && languages.find(lang => lang.key === target)?.iso === resolvedSource) {
      setError('Choose a target language different from the source.'); return;
    }
    setBusy(true); setError('');
    try { await onSubmit({type: kind, file, rawText: text, targetLanguage: target, sourceLanguage: resolvedSource}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Translation could not start.'); }
    finally { setBusy(false); }
  };

  return <div className="task-form">
    {kind === 'text' ? <>
      <label htmlFor="source-text">Text to translate</label>
      <textarea id="source-text" rows={8} value={text} onChange={event => setText(event.target.value)} placeholder="Type or paste your text here" />
      <label className="upload-small">Or choose a text file<input type="file" accept={accept.text} onChange={event => void selectFile(event.target.files?.[0] || null)} /></label>
    </> : <>
      <label htmlFor="source-file">Choose {kind === 'ocr' ? 'a PDF or image' : kind === 'audio' ? 'an audio file' : 'a video file'}</label>
      <div className="upload-zone" onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); void selectFile(event.dataTransfer.files[0]);}}>
        <input id="source-file" type="file" accept={accept[kind]} onChange={event => void selectFile(event.target.files?.[0] || null)} />
        <span>{file ? file.name : 'Upload a file here or choose one from your device'}</span>
      </div>
      {kind === 'audio' && <button type="button" className="secondary-button" onClick={() => void toggleRecording()}>{recording ? 'Stop recording' : 'Record your voice'}</button>}
    </>}

    {kind === 'text' && <div className="language-row">
      <label htmlFor="source-language">Source language</label>
      <select id="source-language" value={source} onChange={event => setSource(event.target.value)}>
        <option value="">{detected?.supported ? `Detected: ${languages.find(lang => lang.iso === detected.language)?.name || detected.language}` : 'Detect automatically'}</option>
        {languages.map(lang => <option key={lang.iso} value={lang.iso}>{lang.name}</option>)}
      </select>
      {detected?.available && !source && <small>FastText detection{detected.score != null ? ` · ${Math.round(detected.score * 100)}% probability` : ''}. Change it if needed.</small>}
    </div>}
    <div className="language-row">
      <label htmlFor="target-language">Translate to</label>
      <select id="target-language" value={target} onChange={event => {setTarget(event.target.value); localStorage.setItem('bhasha_target_language', event.target.value);}}>
        {languages.filter(lang => lang.translation).map(lang => <option key={lang.key} value={lang.key}>{lang.name} ({lang.native_name})</option>)}
      </select>
      {languages.find(lang => lang.key === target)?.tts === false && <small>Written translation is available. Voice output is unavailable for this language.</small>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Starting…' : 'Translate'}</button>
  </div>;
}
