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

from config import OUTPUT_DIR, LANGUAGE_CONFIG, FFMPEG_AUDIO_PARAMS, BASE_URL
from db.database import db


def _model_label(detected_src: str, tgt_lang_code: str) -> str:
    """Return a short human-readable label for the model that will be used."""
    if detected_src == "en":
        return "IndicTrans2 EN→Indic 200M"
    elif tgt_lang_code == "eng_Latn":
        return "IndicTrans2 Indic→EN 200M"
    else:
        return "IndicTrans2 Indic→Indic 320M"



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
               file_path: str = "", raw_text: str = ""):
        """Enqueue a new job for background processing."""
        self._queue.put({
            "job_id": job_id,
            "type": job_type,
            "target_language": target_language,
            "file_path": file_path,
            "raw_text": raw_text,
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
                self._process_text(job_id, job["raw_text"], target_lang, config)
            elif job_type == "audio":
                self._process_audio(job_id, job["file_path"], target_lang, config)
            elif job_type == "video":
                self._process_video(job_id, job["file_path"], target_lang, config)
            elif job_type == "ocr":
                self._process_ocr(job_id, job["file_path"], target_lang, config)
            else:
                db.fail_job(job_id, f"Unknown job type: {job_type}")
        except Exception as e:
            traceback.print_exc()
            db.fail_job(job_id, str(e))

    # ==========================================
    # TEXT PIPELINE
    # ==========================================
    def _process_text(self, job_id: str, text: str, target_lang: str, config: dict):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 20, "Translating Text")

            # Detect language of source text using fastText
            detected_lang = "en"
            lang_detector = self._services.get("lang_detector")
            if lang_detector:
                detected_lang = lang_detector.detect(text)
                print(f"[LID] Text job {job_id}: detected source language = '{detected_lang}'")

            # Pick model label based on script
            model_used = _model_label(detected_lang, config["trans"])

            # Translate the full text normally
            translated = self._services["translator"].translate(text, target_lang=config["trans"])

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
                output_filename = f"output_{job_id}_{target_lang}.wav"
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
    def _process_audio(self, job_id: str, file_path: str, target_lang: str, config: dict):
        import time as _time
        t0 = _time.time()
        clean_audio = str(OUTPUT_DIR / f"clean_{job_id}.wav")

        try:
            db.update_job_progress(job_id, 10, "Normalizing Audio")
            subprocess.run(
                ["ffmpeg", "-y", "-i", file_path] + FFMPEG_AUDIO_PARAMS + [clean_audio],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

            db.update_job_progress(job_id, 30, "Transcribing (Whisper)")
            english_text = self._services["asr"].transcribe(clean_audio)

            if not english_text or english_text.isspace():
                db.fail_job(job_id, "Audio contained no recognizable speech.")
                return

            # Detect language of transcribed text
            detected_lang = "en"
            lang_detector = self._services.get("lang_detector")
            if lang_detector:
                detected_lang = lang_detector.detect(english_text)
                print(f"[LID] Audio job {job_id}: detected source language = '{detected_lang}'")

            model_used = _model_label(detected_lang, config["trans"])

            db.update_job_progress(job_id, 55, "Translating")
            translated = self._services["translator"].translate(english_text, target_lang=config["trans"])
            translator_fn = lambda w: self._services["translator"].translate(w, target_lang=config["trans"])
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
                output_filename = f"output_audio_{job_id}_{target_lang}.wav"
                output_path = str(OUTPUT_DIR / output_filename)
                self._services["tts"].generate_voice(translated, lang_code=config["tts"], output_file=output_path)
                result["audio_url"] = f"{BASE_URL}/{output_filename}"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "audio", english_text, translated, target_lang,
                              audio_url=result.get("audio_url"),
                              file_name=os.path.basename(file_path))
        finally:
            for f in [file_path, clean_audio]:
                if os.path.exists(f):
                    os.remove(f)

    # ==========================================
    # VIDEO PIPELINE
    # ==========================================
    def _process_video(self, job_id: str, file_path: str, target_lang: str, config: dict):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 5, "Extracting Audio")
            result_filename, translated_script, original_text = self._services["video"].process_video(
                input_video=file_path,
                target_lang_code=config["trans"],
                tts_lang_code=config["tts"] or "",
                progress_callback=lambda p, s: db.update_job_progress(job_id, p, s),
                job_id=job_id,
            )

            # Detect source language from the original transcribed audio segments
            detected_lang = "mr"
            lang_detector = self._services.get("lang_detector")
            if lang_detector and original_text:
                detected_lang = lang_detector.detect(original_text)
                print(f"[LID] Video job {job_id}: detected source language = '{detected_lang}'")

            model_used = _model_label(detected_lang, config["trans"])

            result: dict = {
                "status": "success",
                "original_text": original_text,
                "translated_text": translated_script,
                "video_url": f"{BASE_URL}/{result_filename}",
                "detected_source_language": detected_lang,
                "model_used": model_used,
            }

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "video", original_text, translated_script, target_lang,
                              video_url=result["video_url"],
                              file_name=os.path.basename(file_path))

            # Only delete input file on successful completion
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            # On failure, preserve input file for potential resume
            raise

    # ==========================================
    # OCR PIPELINE
    # ==========================================
    def _process_ocr(self, job_id: str, file_path: str, target_lang: str, config: dict):
        import time as _time
        t0 = _time.time()
        try:
            db.update_job_progress(job_id, 10, "OCR Extraction")
            extracted_text = self._services["ocr"].extract(file_path, target_lang)

            if not extracted_text or extracted_text.isspace():
                db.fail_job(job_id, "OCR extracted no readable text from the document.")
                return

            # Detect source language of extracted text
            detected_lang = "en"
            lang_detector = self._services.get("lang_detector")
            if lang_detector:
                detected_lang = lang_detector.detect(extracted_text)

            model_used = _model_label(detected_lang, config["trans"])

            db.update_job_progress(job_id, 40, "Translating")
            translated = self._services["translator"].translate(extracted_text, target_lang=config["trans"])
            translator_fn = lambda w: self._services["translator"].translate(w, target_lang=config["trans"])
            translated = self._services["stm"].apply_corrections(extracted_text, translated, target_lang, translator_fn)

            db.update_job_progress(job_id, 70, "Synthesizing Voice")

            result: dict = {
                "status": "success",
                "original_text": extracted_text,
                "translated_text": translated,
                "detected_source_language": detected_lang,
                "model_used": model_used,
            }

            if config["tts"]:
                output_filename = f"output_ocr_{job_id}_{target_lang}.wav"
                output_path = str(OUTPUT_DIR / output_filename)
                self._services["tts"].generate_voice(translated, lang_code=config["tts"], output_file=output_path)
                result["audio_url"] = f"{BASE_URL}/{output_filename}"

            result["inference_time_sec"] = round(_time.time() - t0, 2)
            db.complete_job(job_id, result)
            db.save_inference(job_id, "ocr", extracted_text, translated, target_lang,
                              audio_url=result.get("audio_url"),
                              file_name=os.path.basename(file_path))
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

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

            # For video jobs, the input file may still exist
            # The layer cache will let it resume from where it left off
            file_path = ""
            if job_type in ("video", "audio", "ocr"):
                # Try to find the original input file in outputs/
                for f in os.listdir(str(OUTPUT_DIR)):
                    if f.startswith(f"temp_input_{job_id}_"):
                        file_path = str(OUTPUT_DIR / f)
                        break

                if not file_path:
                    print(f"[QUEUE] Job {job_id} ({job_type}): input file missing, marking failed.")
                    db.fail_job(job_id, "Input file lost during crash — cannot resume.")
                    continue

            print(f"[QUEUE] Re-queuing {job_type} job {job_id} → {target_lang}")
            db.update_job_progress(job_id, 0, "Re-queued (resuming)")
            self.submit(job_id, job_type, target_lang, file_path=file_path)


# Singleton instance
worker = JobWorker()
