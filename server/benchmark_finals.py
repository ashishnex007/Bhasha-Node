"""Sequential local pipeline benchmark. Run with --full for video and Qwen."""
import argparse
import gc
import json
import os
import threading
import time
import uuid
from pathlib import Path

import psutil

from config import OUTPUT_DIR, APP_ROOT, INDIC_COMET_CHECKPOINT


process = psutil.Process(os.getpid())
measurements = []


def current_rss():
    processes = [process] + process.children(recursive=True)
    return sum(item.memory_info().rss for item in processes if item.is_running())


def measure(name, action):
    stop = threading.Event()
    peak = [current_rss()]

    def sample():
        while not stop.wait(0.05):
            try:
                peak[0] = max(peak[0], current_rss())
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    sampler = threading.Thread(target=sample, daemon=True)
    sampler.start()
    start = time.monotonic()
    cpu_start = process.cpu_times()
    error = None
    try:
        action()
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        stop.set()
        sampler.join()
    seconds = time.monotonic() - start
    cpu_end = process.cpu_times()
    record = {
        "stage": name, "seconds": round(seconds, 2),
        "peak_ram_gb": round(max(peak[0], current_rss()) / 1024 ** 3, 3),
        "cpu_percent_of_machine": round(
            ((cpu_end.user + cpu_end.system) - (cpu_start.user + cpu_start.system))
            / max(seconds, 0.01) / (psutil.cpu_count() or 1) * 100, 1),
        "status": "ok" if error is None else "failed", "error": error,
    }
    measurements.append(record)
    print(json.dumps(record, ensure_ascii=False), flush=True)


def main(full, qwen_only=False, video_only=False):
    from services.translation_engine import TranslationService
    from services.tts_engine import TTSService
    from services.asr_engine import ASRService
    from services.ocr_engine import OCRService
    from services.video_engine import VideoService
    from services.qwen_engine import QwenEngine

    if qwen_only:
        qwen = QwenEngine()
        measure("Qwen Q&A isolated", lambda: qwen.generate_grounded_answer(
            "What helps crops grow?", [{"source": "benchmark", "text": "Clean water helps crops grow."}]))
        report = OUTPUT_DIR / "benchmark_qwen_isolated.json"
        report.write_text(json.dumps(measurements, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Report: {report}", flush=True)
        return
    if video_only:
        translator = TranslationService()
        asr = ASRService()
        tts = TTSService()
        video = VideoService(asr, translator, tts)
        measure("video", lambda: video.process_video(
            str(APP_ROOT / "files" / "Video" / "test_short.mp4"),
            "mar_Deva", "mar", job_id="bench_0759c8a4"))
        report = OUTPUT_DIR / "benchmark_video.json"
        report.write_text(json.dumps(measurements, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Report: {report}", flush=True)
        return

    services = {}
    measure("initialize translation", lambda: services.update(translator=TranslationService()))
    measure("initialize ASR", lambda: services.update(asr=ASRService()))
    measure("initialize TTS", lambda: services.update(tts=TTSService()))
    if "translator" in services:
        measure("text translation", lambda: services["translator"].translate(
            "Farmers need clean water for their crops.", target_lang="mar_Deva", src_lang="eng_Latn"))
    measure("OCR", lambda: OCRService().extract(str(APP_ROOT / "files" / "Text" / "PDF" / "english.pdf"), "marathi"))
    if "asr" in services:
        measure("ASR", lambda: services["asr"].transcribe(str(APP_ROOT / "files" / "Audio" / "output_hindi.wav")))
    if "tts" in services:
        measure("TTS", lambda: services["tts"].generate_voice(
            "शेतात स्वच्छ पाणी वापरा.", "mar", str(OUTPUT_DIR / "benchmark_voice.wav")))
    if full and all(key in services for key in ("translator", "asr", "tts")):
        video = VideoService(services["asr"], services["translator"], services["tts"])
        measure("video", lambda: video.process_video(
            str(APP_ROOT / "files" / "Video" / "test_short.mp4"),
            "mar_Deva", "mar", job_id="bench_" + uuid.uuid4().hex[:8]))
    if full:
        qwen = QwenEngine()
        measure("Qwen Q&A", lambda: qwen.generate_grounded_answer(
            "What helps crops grow?", [{"source": "benchmark", "text": "Clean water helps crops grow."}]))
    if not INDIC_COMET_CHECKPOINT.is_file():
        measurements.append({"stage": "IndicCOMET", "status": "unavailable",
                             "reason": "Local checkpoint is missing"})
    report = OUTPUT_DIR / "benchmark_report.json"
    report.write_text(json.dumps(measurements, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report: {report}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--qwen-only", action="store_true")
    parser.add_argument("--video-only", action="store_true")
    args = parser.parse_args()
    main(args.full, args.qwen_only, args.video_only)
