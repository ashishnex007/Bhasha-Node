"""
Bhasha Node - Async Job Queue Worker
Background thread processing heavy audio/video/OCR tasks
without blocking the FastAPI main thread.
Uses SQLite as the job state store (no Redis/Celery dependency).
"""
import os
import shutil
import subprocess
import threading
import time
import traceback
from queue import Queue
from pathlib import Path

from config import OUTPUT_DIR, LANGUAGE_CONFIG, FFMPEG_AUDIO_PARAMS, BASE_URL, FFMPEG_BIN, POPPLER_BIN
from db.database import db


def _model_label(detected_src: str, tgt_lang_code: str) -> str:
    """Return a short human-readable label for the model that will be used."""
    if detected_src == "en":
        return "IndicTrans2 EN->Indic 200M"
    elif tgt_lang_code == "eng_Latn":
        return "IndicTrans2 Indic->EN 200M"
    else:
        return "IndicTrans2 Indic->Indic 320M"


def _translation_source_code(detected_src: str) -> str | None:
    return next((entry["trans"] for entry in LANGUAGE_CONFIG.values()
                 if entry["iso"] == detected_src), None)


def _require_source_code(detected_src: str) -> str:
    code = _translation_source_code(detected_src)
    if not code:
        raise ValueError(f"Detected source language '{detected_src}' is not supported. Choose a supported source language.")
    return code


def _source_url(job_id: str) -> str | None:
    job = db.get_job(job_id)
    relative = job.get("source_media_path") if job else None
    return f"{BASE_URL}/{relative}" if relative else None



class JobWorker:
    """
    Single background worker thread that pulls jobs from an in-memory
    queue, executes the ML pipeline, and writes results to SQLite.
    """

    def __init__(self):
        self._queue: Queue = Queue()
        self._services: dict = {}
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        print("[QUEUE] Background job worker thread started.")

    def register_services(self, asr, translator, tts, video_engine, ocr_engine, stm_engine,
                          lang_detector=None):
        """Late-bind ML services after they finish loading."""
        self._services = {
            "asr": asr,
            "translator": translator,
            "tts": tts,
            "video": video_engine,
            "ocr": ocr_engine,
            "stm": stm_engine,
            "lang_detector": lang_detector,
        }
        print("[QUEUE] ML services registered with job worker.")

    def submit(self, job_id: str, job_type: str, target_language: str,
               file_path: str = "", raw_text: str = "", source_language: str = ""):
        """Enqueue a new job for background processing."""
        self._queue.put({
            "job_id": job_id,
            "type": job_type,
            "target_language": target_language,
            "file_path": file_path,
            "raw_text": raw_text,
            "source_language": source_language,
        })

    def _run(self):
        """Main worker loop — blocks on queue.get()."""
        while True:
            try:
                job = self._queue.get()
                self._process(job)
            except Exception as e:
                print(f"[QUEUE] Fatal worker error: {e}")
                traceback.print_exc()

    def _process(self, job: dict):
        job_id = job["job_id"]
        job_type = job["type"]
        target_lang = job["target_language"]

        config = LANGUAGE_CONFIG.get(target_lang.lower())
        if not config:
            db.fail_job(job_id, f"Unsupported language: {target_lang}")
            return

        try:
            if job_type == "text":
                self._process_text(job_id, job["raw_text"], target_lang, config,
                                   job.get("source_language", ""))
            elif job_type == "audio":
                self._process_audio(job_id, job["file_path"], target_lang, config, job.get("source_language", ""))
            elif job_type == "video":
                self._process_video(job_id, job["file_path"], target_lang, config, job.get("source_language", ""))
            elif job_type == "ocr":
                self._process_ocr(job_id, job["file_path"], target_lang, config, job.get("source_language", ""))
            else:
                db.fail_job(job_id, f"Unknown job type: {job_type}")
        except Exception as e:
            traceback.print_exc()
            messages = {"text": "The text could not be translated. Please try again.",
                        "audio": "The audio could not be read or translated. Please try another recording.",
                        "video": "The video could not be processed. Please check the file and try again.",
                        "ocr": "The document could not be read. It may be damaged or unclear."}
            db.fail_job(job_id, str(e) if isinstance(e, ValueError) and "source language" in str(e) else messages.get(job_type, "This translation could not be completed."))

    # ==========================================
    # TEXT PIPELINE
    # ==========================================
    def _process_text(self, job_id: str, text: str, target_lang: str, config: dict,
                      source_language: str = ""):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 20, "Translating Text")

            # Detect language of source text using fastText
            detected_lang = "en"
            lang_detector = self._services.get("lang_detector")
            if source_language:
                detected_lang = source_language
            elif lang_detector:
                detected_lang = lang_detector.detect(text)
                print(f"[LID] Text job {job_id}: detected source language = '{detected_lang}'")

            # Pick model label based on script
            source_code = _require_source_code(detected_lang)
            model_used = _model_label(detected_lang, config["trans"])

            # Translate the full text normally
            translated = self._services["translator"].translate(
                text, target_lang=config["trans"], src_lang=source_code)

            # Apply word dictionary corrections
            translator_fn = lambda w: self._services["translator"].translate(w, target_lang=config["trans"])
            translated = self._services["stm"].apply_corrections(text, translated, target_lang, translator_fn)

            db.update_job_progress(job_id, 60, "Synthesizing Voice")

            result: dict = {
                "status": "success",
                "original_text": text,
                "translated_text": translated,
                "detected_source_language": detected_lang,
                "model_used": model_used,
            }

            if config["tts"]:
                output_filename = f"{job_id}/translated.wav"
                output_path = str(OUTPUT_DIR / output_filename)
                self._services["tts"].generate_voice(translated, lang_code=config["tts"], output_file=output_path)
                result["audio_url"] = f"{BASE_URL}/{output_filename}"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "text", text, translated, target_lang,
                              audio_url=result.get("audio_url"))
        except Exception:
            raise

    # ==========================================
    # AUDIO PIPELINE
    # ==========================================
    def _process_audio(self, job_id: str, file_path: str, target_lang: str, config: dict, source_language: str = ""):
        import time as _time
        t0 = _time.time()
        clean_audio = str(OUTPUT_DIR / f"clean_{job_id}.wav")

        try:
            db.update_job_progress(job_id, 10, "Normalizing Audio")
            subprocess.run(
                [FFMPEG_BIN, "-y", "-i", file_path] + FFMPEG_AUDIO_PARAMS + [clean_audio],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

            db.update_job_progress(job_id, 30, "Transcribing (Whisper)")
            english_text = self._services["asr"].transcribe(clean_audio, language=source_language or None)

            if not english_text or english_text.isspace():
                db.fail_job(job_id, "Audio contained no recognizable speech.")
                return

            # Detect language of transcribed text
            detected_lang = source_language or "en"
            lang_detector = self._services.get("lang_detector")
            if lang_detector and not source_language:
                detected_lang = lang_detector.detect(english_text)
                print(f"[LID] Audio job {job_id}: detected source language = '{detected_lang}'")

            model_used = _model_label(detected_lang, config["trans"])
            src_code = _require_source_code(detected_lang)

            db.update_job_progress(job_id, 55, "Translating")
            translated = self._services["translator"].translate(english_text, target_lang=config["trans"], src_lang=src_code)
            translator_fn = lambda w: self._services["translator"].translate(w, target_lang=config["trans"], src_lang=src_code)
            translated = self._services["stm"].apply_corrections(english_text, translated, target_lang, translator_fn)

            db.update_job_progress(job_id, 75, "Synthesizing Voice")

            result: dict = {
                "status": "success",
                "original_text": english_text,
                "translated_text": translated,
                "detected_source_language": detected_lang,
                "model_used": model_used,
            }

            if config["tts"]:
                output_filename = f"{job_id}/translated.wav"
                output_path = str(OUTPUT_DIR / output_filename)
                self._services["tts"].generate_voice(translated, lang_code=config["tts"], output_file=output_path)
                result["audio_url"] = f"{BASE_URL}/{output_filename}"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            result["source_url"] = _source_url(job_id)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "audio", english_text, translated, target_lang,
                              audio_url=result.get("audio_url"),
                              file_name=os.path.basename(file_path))
        finally:
            for f in [clean_audio]:
                if os.path.exists(f):
                    os.remove(f)

    # ==========================================
    # VIDEO PIPELINE
    # ==========================================
    def _process_video(self, job_id: str, file_path: str, target_lang: str, config: dict, source_language: str = ""):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 5, "Extracting Audio")
            result_filename, translated_script, original_text, whisper_lang = self._services["video"].process_video(
                input_video=file_path,
                target_lang_code=config["trans"],
                tts_lang_code=config["tts"] or "",
                progress_callback=lambda p, s: db.update_job_progress(job_id, p, s),
                job_id=job_id,
                source_language=source_language,
            )

            # Detect source language from the original transcribed audio segments
            detected_lang = source_language or whisper_lang
            lang_detector = self._services.get("lang_detector")
            if not detected_lang and lang_detector and original_text:
                detected_lang = lang_detector.detect(original_text)
                print(f"[LID] Video job {job_id}: detected source language = '{detected_lang}'")

            model_used = _model_label(detected_lang, config["trans"])
            src_code = _require_source_code(detected_lang)

            result: dict = {
                "status": "success",
                "original_text": original_text,
                "translated_text": translated_script,
                "video_url": f"{BASE_URL}/{job_id}/translated.mp4",
                "source_url": _source_url(job_id),
                "detected_source_language": detected_lang,
                "model_used": model_used,
            }

            shutil.move(str(OUTPUT_DIR / result_filename), str(OUTPUT_DIR / job_id / "translated.mp4"))
            subtitle_path = OUTPUT_DIR / job_id / "subtitles.srt"
            if subtitle_path.exists():
                result["subtitle_url"] = f"{BASE_URL}/{job_id}/subtitles.srt"
                result["subtitle_vtt_url"] = f"{BASE_URL}/{job_id}/subtitles.vtt"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "video", original_text, translated_script, target_lang,
                              video_url=result["video_url"],
                              file_name=os.path.basename(file_path))

            # Keep source media so this comparison survives browser and server restarts.
        except Exception:
            # On failure, preserve input file for potential resume
            raise

    # ==========================================
    # OCR PIPELINE
    # ==========================================
    def _process_ocr(self, job_id: str, file_path: str, target_lang: str, config: dict, source_language: str = ""):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 10, "OCR Extraction")
            extracted_text = self._services["ocr"].extract(file_path, target_lang)

            if not extracted_text or extracted_text.isspace():
                db.fail_job(job_id, "OCR extracted no readable text from the document.")
                return

            # Detect source language of extracted text
            detected_lang = source_language or "en"
            lang_detector = self._services.get("lang_detector")
            if lang_detector and not source_language:
                detected_lang = lang_detector.detect(extracted_text)

            model_used = _model_label(detected_lang, config["trans"])
            src_code = _require_source_code(detected_lang)

            db.update_job_progress(job_id, 40, "Translating")
            translated = self._services["translator"].translate(extracted_text, target_lang=config["trans"], src_lang=src_code)
            translator_fn = lambda w: self._services["translator"].translate(w, target_lang=config["trans"], src_lang=src_code)
            translated = self._services["stm"].apply_corrections(extracted_text, translated, target_lang, translator_fn)

            db.update_job_progress(job_id, 70, "Synthesizing Voice")

            result: dict = {
                "status": "success",
                "original_text": extracted_text,
                "translated_text": translated,
                "detected_source_language": detected_lang,
                "model_used": model_used,
                "source_url": _source_url(job_id),
            }
            if Path(file_path).suffix.lower() == ".pdf":
                try:
                    from pdf2image import pdfinfo_from_path
                    result["page_count"] = pdfinfo_from_path(
                        file_path, poppler_path=POPPLER_BIN).get("Pages")
                except Exception:
                    pass

            if config["tts"]:
                output_filename = f"{job_id}/translated.wav"
                output_path = str(OUTPUT_DIR / output_filename)
                self._services["tts"].generate_voice(translated, lang_code=config["tts"], output_file=output_path)
                result["audio_url"] = f"{BASE_URL}/{output_filename}"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "ocr", extracted_text, translated, target_lang,
                              audio_url=result.get("audio_url"),
                              file_name=os.path.basename(file_path))
        finally:
            pass

    # ==========================================
    # RESUME STUCK JOBS (crash recovery)
    # ==========================================
    def resume_stuck_jobs(self):
        """
        Find jobs that are still 'processing' (leftover from a server crash)
        and re-enqueue them. Called once at server startup.
        """
        stuck_jobs = db.get_stuck_jobs()
        if not stuck_jobs:
            return

        print(f"[QUEUE] Found {len(stuck_jobs)} stuck job(s) from previous crash — re-queuing...")
        for job in stuck_jobs:
            job_id = job["job_id"]
            job_type = job["type"]
            target_lang = job["target_language"]

            file_path = ""
            if job_type in ("video", "audio", "ocr"):
                relative = job.get("source_media_path")
                if relative:
                    candidate = OUTPUT_DIR / relative
                    if candidate.is_file():
                        file_path = str(candidate)
                if not file_path:
                    # Legacy jobs stored source files at the root of outputs.
                    for f in os.listdir(str(OUTPUT_DIR)):
                        if f.startswith(f"temp_input_{job_id}_"):
                            file_path = str(OUTPUT_DIR / f)
                            break

                if not file_path:
                    print(f"[QUEUE] Job {job_id} ({job_type}): input file missing, marking failed.")
                    db.fail_job(job_id, "Input file lost during crash — cannot resume.")
                    continue
            raw_text = job.get("source_text") or ""
            if job_type == "text" and not raw_text:
                db.fail_job(job_id, "Text was lost during restart. Please submit it again.")
                continue

            print(f"[QUEUE] Re-queuing {job_type} job {job_id} -> {target_lang}")
            db.update_job_progress(job_id, 0, "Re-queued (resuming)")
            self.submit(job_id, job_type, target_lang, file_path=file_path,
                        raw_text=raw_text, source_language=job.get("source_language") or "")


# Singleton instance
worker = JobWorker()
