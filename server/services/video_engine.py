"""
Bhasha Node - Video Translation Pipeline (v2 — Resumable + Chunked TTS)

6-layer pipeline with per-job caching:
  L1  Extract audio from video          → cache/{job_id}/L1_audio.wav
  L2  Transcribe with Faster-Whisper    → cache/{job_id}/L2_segments.json
  L3  Translate segments + build SRT    → cache/{job_id}/L3_srt.srt + L3_translations.json
  L4  Synthesize TTS (chunked)          → cache/{job_id}/L4_tts.wav
  L5  Remux video with subs + voiceover → outputs/final_output_{lang}.mp4

On re-run (e.g. after crash), each layer checks its cache file and skips if valid.
TTS is chunked at sentence boundaries so VITS never gets a token-bomb.
"""
import os
import re
import json
import time
import math
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Callable, List, Tuple

from services.asr_engine import ASRService
from services.translation_engine import TranslationService
from services.tts_engine import TTSService


# ── Sentence splitter for chunked TTS ────────────────────────────
# Splits on period, exclamation, question mark, Devanagari danda (।),
# keeping chunks under a safe character limit for VITS.
_SENTENCE_RE = re.compile(r'(?<=[।.!?])\s+')
_MAX_TTS_CHUNK_CHARS = 300  # VITS is comfortable with ~300 chars


def _split_for_tts(text: str) -> List[str]:
    """Split text into sentence-sized chunks safe for VITS synthesis."""
    sentences = _SENTENCE_RE.split(text.strip())
    chunks: List[str] = []
    current = ""
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        candidate = (current + " " + sent).strip() if current else sent
        if len(candidate) <= _MAX_TTS_CHUNK_CHARS:
            current = candidate
        else:
            if current:
                chunks.append(current)
            # If a single sentence exceeds the limit, include it as-is
            # (VITS will truncate but won't OOM)
            current = sent
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text.strip()]


class VideoService:
    def __init__(self, asr: ASRService, translator: TranslationService,
                 tts: TTSService, stm=None):
        self.asr = asr
        self.translator = translator
        self.tts = tts
        self.stm = stm  # optional STM service for word corrections

    @staticmethod
    def format_srt_time(seconds: float) -> str:
        """Converts float seconds to SRT time format HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds - math.floor(seconds)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    # ══════════════════════════════════════════════════════════════
    #  MAIN ENTRY POINT
    # ══════════════════════════════════════════════════════════════
    def process_video(
        self,
        input_video: str,
        target_lang_code: str,
        tts_lang_code: str,
        progress_callback: Optional[Callable] = None,
        job_id: str = "",
    ) -> Tuple[str, str]:
        """
        Full video pipeline with layer caching.
        Returns (output_filename, combined_translated_text).
        """
        start_time = time.time()
        print(f"--- STARTING VIDEO PIPELINE: {input_video} (job={job_id}) ---")

        def _progress(percent: int, stage: str):
            if progress_callback:
                progress_callback(percent, stage)

        # ── Set up paths ──────────────────────────────────────────
        out_dir = Path("outputs")
        out_dir.mkdir(exist_ok=True)

        # Per-job cache directory for resumability
        cache_dir = out_dir / f"cache_{job_id}" if job_id else out_dir / "cache_temp"
        cache_dir.mkdir(exist_ok=True)

        # Layer cache paths
        l1_audio       = str(cache_dir / "L1_audio.wav")
        l2_segments    = str(cache_dir / "L2_segments.json")
        l3_srt         = str(cache_dir / "L3_srt.srt")
        l3_translations = str(cache_dir / "L3_translations.json")
        l4_tts         = str(cache_dir / "L4_tts.wav")

        output_filename = f"final_output_{job_id}_{target_lang_code}.mp4" if job_id else f"final_output_{target_lang_code}.mp4"
        output_video    = str(out_dir / output_filename)

        try:
            # ── L1: Extract Audio ─────────────────────────────────
            if os.path.exists(l1_audio):
                print("[L1] CACHED — Skipping audio extraction.")
            else:
                print("[L1/6] Extracting audio footprint...")
                _progress(10, "Extracting Audio")
                subprocess.run([
                    "ffmpeg", "-y", "-i", input_video, "-vn",
                    "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                    l1_audio,
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"[L1] Audio extracted → {l1_audio}")

            # ── L2: Transcribe with Whisper ───────────────────────
            # L2 cache stores both segments and the detected language tag
            l2_lang_cache = str(cache_dir / "L2_lang.txt")
            if os.path.exists(l2_segments) and os.path.exists(l2_lang_cache):
                print("[L2] CACHED — Skipping transcription.")
                with open(l2_segments, "r", encoding="utf-8") as f:
                    segments = json.load(f)
                with open(l2_lang_cache, "r") as f:
                    whisper_lang = f.read().strip()  # e.g. 'mr', 'hi', 'en'
            else:
                print("[L2/6] Transcribing with Faster-Whisper...")
                _progress(25, "Transcribing (Whisper)")
                segments, whisper_lang = self.asr.transcribe_with_timestamps(l1_audio)
                with open(l2_segments, "w", encoding="utf-8") as f:
                    json.dump(segments, f, ensure_ascii=False, indent=2)
                with open(l2_lang_cache, "w") as f:
                    f.write(whisper_lang)
                print(f"[L2] Transcription cached ({len(segments)} segments, lang='{whisper_lang}') -> {l2_segments}")

            # ── L3: Translate segments + build SRT ────────────────
            if os.path.exists(l3_srt) and os.path.exists(l3_translations):
                print("[L3] CACHED — Skipping translation.")
                with open(l3_translations, "r", encoding="utf-8") as f:
                    full_translated_text = json.load(f)
            else:
                print("[L3/6] Translating and building SRT subtitle file...")
                _progress(45, "Translating & Building SRT")

                # Map from IndicTrans2 code → DB language key
                _trans_to_db = {"mar_Deva": "marathi", "hin_Deva": "hindi", "eng_Latn": "english"}
                stm_db_key = _trans_to_db.get(target_lang_code, target_lang_code)

                # Use Whisper's own detected language as authoritative source tag.
                # This avoids text-based detection breaking when Whisper
                # hallucinates a different script (e.g. Kannada for Marathi audio).
                _WHISPER_TO_FLORES = {
                    "mr": "mar_Deva",
                    "hi": "hin_Deva",
                    "en": "eng_Latn",
                }
                video_src_lang = _WHISPER_TO_FLORES.get(whisper_lang)
                if not video_src_lang:
                    # Fallback to text-based detection for unsupported codes
                    combined_orig_sample = " ".join([s.get("text", "") for s in segments[:10]])
                    video_src_lang = self.translator._detect_src_lang(combined_orig_sample, target_lang_code)
                    print(f"[L3] Whisper lang '{whisper_lang}' not mapped, text-detected: '{video_src_lang}'")
                else:
                    print(f"[L3] Whisper source language: '{whisper_lang}' -> FLORES tag: '{video_src_lang}' -> target '{target_lang_code}'")

                srt_content = ""
                full_translated_text = []

                for index, segment in enumerate(segments, start=1):
                    seg_text = segment["text"]
                    translated_chunk = self.translator.translate(
                        seg_text, target_lang=target_lang_code, src_lang=video_src_lang
                    )
                    # Apply word dictionary corrections (oracle approach)
                    if self.stm:
                        translator_fn = lambda w: self.translator.translate(
                            w, target_lang=target_lang_code, src_lang=video_src_lang
                        )
                        translated_chunk = self.stm.apply_corrections(
                            seg_text, translated_chunk, stm_db_key, translator_fn
                        )
                    full_translated_text.append(translated_chunk)

                    start_str = self.format_srt_time(segment["start"])
                    end_str = self.format_srt_time(segment["end"])
                    srt_content += f"{index}\n{start_str} --> {end_str}\n{translated_chunk}\n\n"

                with open(l3_srt, "w", encoding="utf-8") as f:
                    f.write(srt_content)
                with open(l3_translations, "w", encoding="utf-8") as f:
                    json.dump(full_translated_text, f, ensure_ascii=False, indent=2)
                print(f"[L3] SRT + translations cached → {l3_srt}")

            combined_translation = " ".join(full_translated_text)

            # ── L4: Chunked TTS Synthesis ─────────────────────────
            tts_success = False
            if os.path.exists(l4_tts):
                print("[L4] CACHED — Skipping TTS synthesis.")
                tts_success = True
            elif tts_lang_code:
                print("[L4/6] Synthesizing native voiceover (chunked)...")
                _progress(65, "Synthesizing Voice")
                try:
                    tts_success = self._chunked_tts(
                        combined_translation, tts_lang_code, l4_tts, cache_dir
                    )
                except Exception as e:
                    print(f"[L4] TTS synthesis failed (non-fatal): {e}")
                    print("[L4] Continuing without voiceover — subtitles will still be burned.")
                    tts_success = False

            # ── L5: Remux final video ─────────────────────────────
            print("[L5/6] Remuxing final video (This will tax the CPU)...")
            _progress(80, "Remuxing Video")

            # Remove old output if it exists
            if os.path.exists(output_video):
                os.remove(output_video)

            safe_srt_path = l3_srt.replace("\\", "/")

            if tts_success and os.path.exists(l4_tts):
                # Full remux: subtitles + new voiceover
                subprocess.run([
                    "ffmpeg", "-y",
                    "-i", input_video,
                    "-i", l4_tts,
                    "-vf", f"subtitles={safe_srt_path}",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-c:a", "aac",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    "-shortest",
                    output_video,
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                # Fallback: subtitles only (no voiceover)
                print("[L5] No TTS audio — producing subtitled video only.")
                subprocess.run([
                    "ffmpeg", "-y",
                    "-i", input_video,
                    "-vf", f"subtitles={safe_srt_path}",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-c:a", "copy",
                    output_video,
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            _progress(95, "Finalizing")
            elapsed = time.time() - start_time
            print(f"--- VIDEO PIPELINE COMPLETE in {elapsed:.2f}s ---")

            # Clean up cache dir on success (artifacts are in outputs/)
            self._cleanup_cache(cache_dir)

            original_text = " ".join([s.get("text", "") for s in segments])
            return output_filename, combined_translation, original_text

        except Exception as e:
            # On failure, cache is preserved for resumability
            print(f"[VIDEO] Pipeline error (cache preserved at {cache_dir}): {e}")
            raise

    # ══════════════════════════════════════════════════════════════
    #  CHUNKED TTS — prevents OOM on long videos
    # ══════════════════════════════════════════════════════════════
    def _chunked_tts(
        self,
        text: str,
        lang_code: str,
        output_path: str,
        cache_dir: Path,
    ) -> bool:
        """
        Split text into sentence-sized chunks, synthesize each independently,
        then concatenate with FFmpeg. Returns True on success.
        """
        chunks = _split_for_tts(text)
        print(f"[TTS] Splitting into {len(chunks)} chunks for safe synthesis...")

        if len(chunks) == 1:
            # Short text — synthesize directly
            self.tts.generate_voice(chunks[0], lang_code=lang_code, output_file=output_path)
            return True

        # Generate individual chunk WAVs
        chunk_dir = cache_dir / "tts_chunks"
        chunk_dir.mkdir(exist_ok=True)
        chunk_paths: List[str] = []
        concat_list_path = str(chunk_dir / "concat.txt")

        for i, chunk in enumerate(chunks):
            chunk_wav = str(chunk_dir / f"chunk_{i:04d}.wav")

            # Skip already-synthesized chunks (resumability within TTS)
            if os.path.exists(chunk_wav) and os.path.getsize(chunk_wav) > 100:
                chunk_paths.append(chunk_wav)
                continue

            try:
                self.tts.generate_voice(chunk, lang_code=lang_code, output_file=chunk_wav)
                chunk_paths.append(chunk_wav)
            except Exception as e:
                print(f"[TTS] Warning: Chunk {i} failed ({e}), skipping...")
                # Skip this chunk but don't abort the entire TTS
                continue

        if not chunk_paths:
            print("[TTS] All chunks failed — no audio produced.")
            return False

        # Write FFmpeg concat demuxer file using absolute paths with forward-slashes
        with open(concat_list_path, "w", encoding="utf-8") as f:
            for p in chunk_paths:
                # ffmpeg concat demuxer requires absolute paths with forward slashes
                abs_p = os.path.abspath(p).replace("\\", "/")
                f.write(f"file '{abs_p}'\n")

        # Concatenate all chunk WAVs into one.
        # Re-encode to PCM 16-bit 22050Hz mono so mismatched sample rates
        # (e.g. MMS-TTS mar=16kHz, eng=16kHz) merge cleanly.
        concat_abs = os.path.abspath(concat_list_path).replace("\\", "/")
        result = subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", concat_abs,
            "-ar", "22050", "-ac", "1", "-sample_fmt", "s16",
            output_path,
        ], capture_output=True, text=True)

        if result.returncode != 0:
            print(f"[TTS] FFmpeg concat stderr: {result.stderr[-500:]}")
            raise subprocess.CalledProcessError(result.returncode, "ffmpeg", result.stderr)

        print(f"[TTS] Combined {len(chunk_paths)} chunks -> {output_path}")
        return True

    # ══════════════════════════════════════════════════════════════
    #  CACHE CLEANUP
    # ══════════════════════════════════════════════════════════════
    @staticmethod
    def _cleanup_cache(cache_dir: Path):
        """Remove the per-job cache directory after successful completion."""
        try:
            if cache_dir.exists():
                shutil.rmtree(cache_dir)
                print(f"[CACHE] Cleaned up {cache_dir}")
        except Exception as e:
            print(f"[CACHE] Warning: Could not clean up {cache_dir}: {e}")