import {useEffect, useState} from 'react';
import type {JobStatus, LanguageCapability, PipelineResult} from '../services/api';
import {addSTMTerm, saveResultEdit, evaluateJob} from '../services/api';

interface Props {
  job: JobStatus;
  languages: LanguageCapability[];
  onUpdated: (job: JobStatus) => void;
  onBack: () => void;
  onRetry: (targetLanguage: string) => Promise<void>;
}

function name(code: string | undefined, languages: LanguageCapability[]) {
  return languages.find(lang => lang.key === code || lang.iso === code || lang.translation_code === code)?.name || code || 'Unknown';
}

function SourcePreview({job}: {job: JobStatus}) {
  const result: PipelineResult = job.result || {status: ''};
  const [page, setPage] = useState(1);
  const url = result.source_url;
  const file = job.source_filename?.toLowerCase() || '';
  if (job.type === 'video') return url ? <video controls preload="metadata" src={url} /> : <p>Original video is unavailable for this older result.</p>;
  if (job.type === 'audio') return url ? <audio controls src={url} /> : <p>Original audio is unavailable for this older result.</p>;
  if (job.type === 'ocr' && url && file.endsWith('.pdf')) return <><div className="pdf-controls"><span>Page {page}{result.page_count ? ` of ${result.page_count}` : ''}</span><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button disabled={!!result.page_count && page >= result.page_count} onClick={() => setPage(value => value + 1)}>Next</button></div><iframe title="Original PDF" src={`${url}#page=${page}`} className="pdf-preview" /></>;
  if (job.type === 'ocr' && url) return <img src={url} alt="Original document" className="image-preview" />;
  return null;
}

function TargetPreview({job}: {job: JobStatus}) {
  const result: PipelineResult = job.result || {status: ''};
  if (job.type === 'video') return result.video_url ? <video controls preload="metadata" src={result.video_url} /> : <p>Translated video is unavailable.</p>;
  if (job.type === 'audio') return result.audio_url ? <audio controls src={result.audio_url} /> : <p>Voice output is unavailable for this language.</p>;
  return result.audio_url ? <audio controls src={result.audio_url} /> : null;
}

export default function ResultComparison({job, languages, onUpdated, onBack, onRetry}: Props) {
  const result: PipelineResult = job.result || {status: ''};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(result.translated_text || '');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [retryTarget, setRetryTarget] = useState(job.target_language);
  useEffect(() => {
    setDraft(result.translated_text || '');
    setRetryTarget(job.target_language);
    setEditing(false);
    setMessage('');
    setReference('');
  }, [job.job_id, result.translated_text, job.target_language]);
  const sourceName = name(job.source_language || result.detected_source_language, languages);
  const targetName = name(job.target_language, languages);
  const save = async () => {
    try {
      const updated = await saveResultEdit(job.job_id, draft);
      onUpdated({...job, result: updated});
      setEditing(false); setMessage('Correction saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save correction.'); }
  };
  const saveMemory = async () => {
    const translation = editing ? draft : result.translated_text || '';
    if (!result.original_text || !translation.trim()) return;
    try { await addSTMTerm(result.original_text, translation, job.target_language); setMessage('Saved to Translation Memory.'); }
    catch { setMessage('Could not save to Translation Memory.'); }
  };
  const downloadText = () => {
    const blob = new Blob([`Source (${sourceName})\n${result.original_text || ''}\n\nTarget (${targetName})\n${editing ? draft : result.translated_text || ''}`], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `translation-${job.job_id}.txt`; anchor.click(); URL.revokeObjectURL(url);
  };
  const evaluate = async () => {
    setEvaluating(true); setMessage('');
    try {
      const updated = await evaluateJob(job.job_id, reference);
      onUpdated({...job, result: updated});
      setMessage('IndicCOMET evaluation saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Quality evaluation is unavailable.'); }
    finally { setEvaluating(false); }
  };

  return <section className="result-page">
    <button type="button" className="text-button" onClick={onBack}>← Back to translations</button>
    <h1>Translation complete</h1>
    <p className="language-pair">Source language: <strong>{sourceName}</strong> <span aria-hidden="true">→</span> Target language: <strong>{targetName}</strong></p>
    {job.source_filename && <p className="subtle">{job.source_filename}</p>}
    <div className="comparison-grid">
      <section className="comparison-pane">
        <h2>Source <small>{sourceName}</small></h2>
        <SourcePreview job={job} />
        {result.original_text && <div className="comparison-text"><h3>{job.type === 'audio' || job.type === 'video' ? 'Transcript' : job.type === 'ocr' ? 'Extracted text' : 'Original text'}</h3><p>{result.original_text}</p></div>}
        {result.source_url && <a href={result.source_url} download className="text-button">Download original</a>}
      </section>
      <section className="comparison-pane">
        <h2>Target <small>{targetName}</small></h2>
        <TargetPreview job={job} />
        {(result.translated_text || editing) && <div className="comparison-text">
          <h3>Translation</h3>
          {editing ? <textarea aria-label="Edit translation" value={draft} onChange={event => setDraft(event.target.value)} rows={8} /> : <p>{result.translated_text}</p>}
          <div className="result-actions">
            {editing ? <><button onClick={() => void save()}>Save correction</button><button onClick={() => {setDraft(result.translated_text || ''); setEditing(false);}}>Cancel</button></> : <button onClick={() => setEditing(true)}>Edit translation</button>}
            <button onClick={() => void navigator.clipboard.writeText(editing ? draft : result.translated_text || '')}>Copy text</button>
          </div>
        </div>}
      </section>
    </div>
    <div className="result-actions result-downloads">
      {result.translated_text && <button onClick={downloadText}>Download text</button>}
      {result.audio_url && <a href={result.audio_url} download>Download audio</a>}
      {result.video_url && <a href={result.video_url} download>Download video</a>}
      {result.subtitle_url && <a href={result.subtitle_url} download>Download subtitles</a>}
      {result.subtitle_vtt_url && <a href={result.subtitle_vtt_url} download>Download WebVTT</a>}
      {result.original_text && <button onClick={() => void saveMemory()}>Save to Translation Memory</button>}
    </div>
    <div className="retry-box"><label htmlFor="retry-target">Translate this source again to</label><select id="retry-target" value={retryTarget} onChange={event => setRetryTarget(event.target.value)}>{languages.filter(lang => lang.translation).map(lang => <option key={lang.key} value={lang.key}>{lang.name}</option>)}</select><button className="secondary-button" onClick={() => void onRetry(retryTarget)}>Translate again</button></div>
    {result.quality_score != null && <p className="quality">Translation Quality · {result.quality_metric || 'IndicCOMET'}: {result.quality_score.toFixed(3)}<small>Automatic metric estimate, not a guarantee of correctness.</small></p>}
    {result.original_text && result.translated_text && <details className="quality-request"><summary>Check translation quality with a trusted reference</summary><p>IndicCOMET compares this result with a trusted translation. It is an automatic estimate, not a guarantee.</p><textarea rows={4} aria-label="Trusted reference translation" placeholder="Paste a trusted translation" value={reference} onChange={event => setReference(event.target.value)}/><button className="secondary-button" disabled={!reference.trim() || evaluating} onClick={() => void evaluate()}>{evaluating ? 'Evaluating locally…' : 'Evaluate quality'}</button></details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
