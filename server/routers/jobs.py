"""
Bhasha Node - Jobs Router
Handles job submission and status polling.
"""
import shutil
import os
import sys
import json
import time
import subprocess
import importlib.util
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import psutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from config import OUTPUT_DIR, LANGUAGE_CONFIG, MAX_UPLOAD_SIZE_MB, INDIC_COMET_CHECKPOINT, BASE_DIR, QUALITY_MEMORY_LIMIT_GB
from db.database import db
from task_queue.job_worker import worker

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _current_media_urls(result: dict | None, request: Request) -> dict | None:
    """Keep saved media usable if the local service is restarted on another port."""
    if not result:
        return result
    origin = urlsplit(str(request.base_url))
    for key in ("source_url", "audio_url", "video_url", "subtitle_url", "subtitle_vtt_url"):
        value = result.get(key)
        if not value:
            continue
        saved = urlsplit(value)
        if saved.hostname in ("127.0.0.1", "localhost"):
            result[key] = urlunsplit((origin.scheme, origin.netloc, saved.path, saved.query, saved.fragment))
    return result

ALLOWED_EXTENSIONS = {
    "audio": {".wav", ".mp3", ".aac", ".m4a", ".flac", ".ogg", ".wma", ".webm"},
    "video": {".mp4", ".mov", ".avi", ".wmv", ".mkv", ".flv", ".webm"},
    "ocr": {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"},
}


def _validate_target(language: str):
    if language.lower() not in LANGUAGE_CONFIG:
        raise HTTPException(400, "This target language is not available.")


async def _save_upload(upload: UploadFile, kind: str, target_language: str, source_language: str = ""):
    _validate_target(target_language)
    if source_language and source_language not in {entry["iso"] for entry in LANGUAGE_CONFIG.values()}:
        raise HTTPException(400, "This source language is not available for translation.")
    if kind == "ocr" and source_language and source_language not in {
        entry["iso"] for entry in LANGUAGE_CONFIG.values() if entry["ocr"]
    }:
        raise HTTPException(400, "OCR is not available for this source language.")
    filename = Path(upload.filename or "").name
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS[kind]:
        raise HTTPException(400, "This file type is not supported for this task.")
    job_id = db.create_job(kind, target_language, source_filename=filename,
                           source_media_type=upload.content_type or "", source_language=source_language)
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    relative = f"{job_id}/source{suffix}"
    path = OUTPUT_DIR / relative
    size = 0
    try:
        with path.open("wb") as stream:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    raise HTTPException(413, "The file is too large to process.")
                stream.write(chunk)
        if not size:
            raise HTTPException(400, "The uploaded file is empty.")
    except Exception:
        path.unlink(missing_ok=True)
        db.fail_job(job_id, "Upload could not be saved.")
        raise
    db.set_source(job_id, relative, filename, upload.content_type or "")
    worker.submit(job_id, kind, target_language, file_path=str(path), source_language=source_language)
    return {"job_id": job_id, "status": "queued"}


class TextJobRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = ""


@router.post("/submit/text")
async def submit_text_job(request: TextJobRequest):
    """Submit a raw text processing job."""
    _validate_target(request.target_language)
    if not request.text.strip():
        raise HTTPException(400, "Enter some text to translate.")
    source_codes = {entry["iso"] for entry in LANGUAGE_CONFIG.values()}
    if request.source_language and request.source_language not in source_codes:
        raise HTTPException(400, "This source language is not available for translation.")
    if request.source_language == LANGUAGE_CONFIG[request.target_language.lower()]["iso"]:
        raise HTTPException(400, "Choose a different target language.")
    job_id = db.create_job("text", request.target_language, source_text=request.text,
                           source_language=request.source_language)
    worker.submit(job_id, "text", request.target_language, raw_text=request.text,
                  source_language=request.source_language)
    return {"job_id": job_id, "status": "queued"}


@router.post("/submit/audio")
async def submit_audio_job(
    target_language: str = Form(...),
    source_language: str = Form(""),
    audio_file: UploadFile = File(...),
):
    """Submit an audio processing job (microphone recording or uploaded file)."""
    return await _save_upload(audio_file, "audio", target_language, source_language)


@router.post("/submit/video")
async def submit_video_job(
    target_language: str = Form(...),
    source_language: str = Form(""),
    video_file: UploadFile = File(...),
):
    """Submit a video processing job."""
    return await _save_upload(video_file, "video", target_language, source_language)


@router.post("/submit/ocr")
async def submit_ocr_job(
    target_language: str = Form(...),
    source_language: str = Form(""),
    ocr_file: UploadFile = File(...),
):
    """Submit a PDF/image OCR processing job."""
    return await _save_upload(ocr_file, "ocr", target_language, source_language)


@router.get("")
async def list_jobs(limit: int = 50, offset: int = 0):
    return {"items": db.list_jobs(min(max(limit, 1), 100), max(offset, 0))}


@router.get("/{job_id}")
async def get_job_status(job_id: str, request: Request):
    """Poll job status by ID."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "Translation not found.")
    job["result"] = _current_media_urls(job["result"], request)
    return job


class TranslationEdit(BaseModel):
    translated_text: str


@router.patch("/{job_id}/result")
async def update_result(job_id: str, edit: TranslationEdit):
    if not edit.translated_text.strip():
        raise HTTPException(400, "The translation cannot be empty.")
    result = db.update_translation(job_id, edit.translated_text)
    if result is None:
        raise HTTPException(409, "Only completed translations can be edited.")
    return result


class RetryRequest(BaseModel):
    target_language: str


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, request: RetryRequest):
    _validate_target(request.target_language)
    previous = db.get_job(job_id)
    if not previous or previous["status"] not in ("complete", "error"):
        raise HTTPException(409, "This translation cannot be processed again yet.")
    source_language = previous.get("source_language") or ""
    if previous["type"] == "text":
        raw_text = previous.get("source_text") or (previous.get("result") or {}).get("original_text")
        if not raw_text:
            raise HTTPException(409, "The source text is unavailable for this older translation.")
        new_id = db.create_job("text", request.target_language, source_text=raw_text,
                               source_language=source_language)
        worker.submit(new_id, "text", request.target_language, raw_text=raw_text,
                      source_language=source_language)
    else:
        relative = previous.get("source_media_path")
        source = (OUTPUT_DIR / relative).resolve() if relative else None
        if not source or not source.is_relative_to(OUTPUT_DIR.resolve()) or not source.is_file():
            raise HTTPException(409, "The original file is unavailable for this older translation.")
        kind = previous["type"]
        new_id = db.create_job(kind, request.target_language,
                               source_filename=previous.get("source_filename") or source.name,
                               source_media_type=previous.get("source_media_type") or "",
                               source_language=source_language)
        destination = OUTPUT_DIR / new_id / f"source{source.suffix.lower()}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        db.set_source(new_id, f"{new_id}/{destination.name}",
                      previous.get("source_filename") or source.name,
                      previous.get("source_media_type") or "")
        worker.submit(new_id, kind, request.target_language, file_path=str(destination), source_language=source_language)
    return {"job_id": new_id, "status": "queued"}


class EvaluateRequest(BaseModel):
    reference_text: str


@router.post("/{job_id}/evaluate")
def evaluate_job(job_id: str, request: EvaluateRequest):
    """Optional reference-based IndicCOMET, isolated from the translation worker."""
    job = db.get_job(job_id)
    if not job or job["status"] != "complete" or not job["result"]:
        raise HTTPException(404, "Completed translation not found.")
    result = job["result"]
    if not request.reference_text.strip() or not result.get("original_text") or not result.get("translated_text"):
        raise HTTPException(400, "A source, translation, and trusted reference are required.")
    if (not INDIC_COMET_CHECKPOINT.is_file() or
            not (INDIC_COMET_CHECKPOINT.parent.parent / "hparams.yaml").is_file() or
            importlib.util.find_spec("comet") is None):
        raise HTTPException(503, "Local IndicCOMET is not installed. The translation remains available.")

    quality_log = OUTPUT_DIR / job_id / "quality.log"
    quality_log.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update({"HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1"})
    payload = {"checkpoint": str(INDIC_COMET_CHECKPOINT), "source": result["original_text"],
               "translation": result["translated_text"], "reference": request.reference_text.strip()}
    with quality_log.open("w", encoding="utf-8") as log:
        process = subprocess.Popen([sys.executable, str(BASE_DIR / "quality_worker.py")],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=log, text=True, encoding="utf-8", env=env)
        assert process.stdin is not None
        process.stdin.write(json.dumps(payload, ensure_ascii=False))
        process.stdin.close()
        started = time.monotonic()
        parent = psutil.Process(os.getpid())
        while process.poll() is None:
            try:
                processes = [parent] + parent.children(recursive=True)
                rss = sum(item.memory_info().rss for item in processes if item.is_running())
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                rss = 0
            if QUALITY_MEMORY_LIMIT_GB > 0 and rss > int(QUALITY_MEMORY_LIMIT_GB * 1024 ** 3):
                process.kill(); process.wait()
                raise HTTPException(503, f"Quality evaluation stopped at the {QUALITY_MEMORY_LIMIT_GB:g} GB safety limit. The translation is saved.")
            if time.monotonic() - started > 300:
                process.kill(); process.wait()
                raise HTTPException(503, "Quality evaluation took too long. The translation is saved.")
            time.sleep(0.2)
        assert process.stdout is not None
        output = process.stdout.read()
    if process.returncode != 0:
        raise HTTPException(503, "Quality evaluation could not run locally. The translation is saved.")
    try:
        score = float(json.loads(output.strip().splitlines()[-1])["score"])
    except (ValueError, KeyError, IndexError, json.JSONDecodeError):
        raise HTTPException(503, "Quality evaluation returned no usable score. The translation is saved.")
    return db.save_quality(job_id, score, request.reference_text.strip())


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "Translation not found.")
    if not db.delete_job(job_id):
        raise HTTPException(409, "This translation is still being processed.")
    job_dir = OUTPUT_DIR / job_id
    if job_dir.is_dir():
        shutil.rmtree(job_dir)
    return {"status": "deleted"}


capabilities_router = APIRouter(prefix="/api", tags=["capabilities"])


@capabilities_router.get("/capabilities")
async def get_capabilities():
    return {"languages": [
        {"key": key, "name": item["name"], "native_name": item["label"],
         "translation_code": item["trans"], "iso": item["iso"],
         "translation": True, "tts": bool(item["tts"]), "ocr": bool(item["ocr"])}
        for key, item in LANGUAGE_CONFIG.items()
    ]}


class DetectRequest(BaseModel):
    text: str


@capabilities_router.post("/languages/detect")
async def detect_language(request: DetectRequest):
    detector = worker._services.get("lang_detector")
    if not detector:
        raise HTTPException(503, "Language detection is starting. Please try again shortly.")
    return detector.detect_with_score(request.text)
