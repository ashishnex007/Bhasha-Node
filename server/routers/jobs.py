"""
Bhasha Node - Jobs Router
Handles job submission and status polling.
"""
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from config import OUTPUT_DIR, LANGUAGE_CONFIG
from db.database import db
from task_queue.job_worker import worker

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class TextJobRequest(BaseModel):
    text: str
    target_language: str


@router.post("/submit/text")
async def submit_text_job(request: TextJobRequest):
    """Submit a raw text processing job."""
    job_id = db.create_job("text", request.target_language)
    worker.submit(job_id, "text", request.target_language, raw_text=request.text)
    return {"job_id": job_id, "status": "queued"}


@router.post("/submit/audio")
async def submit_audio_job(
    target_language: str = Form(...),
    audio_file: UploadFile = File(...),
):
    """Submit an audio processing job (microphone recording or uploaded file)."""
    job_id = db.create_job("audio", target_language)

    # Save uploaded file to outputs dir for the worker
    input_filename = f"temp_input_{job_id}_{audio_file.filename}"
    input_path = str(OUTPUT_DIR / input_filename)
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    worker.submit(job_id, "audio", target_language, file_path=input_path)
    return {"job_id": job_id, "status": "queued"}


@router.post("/submit/video")
async def submit_video_job(
    target_language: str = Form(...),
    video_file: UploadFile = File(...),
):
    """Submit a video processing job."""
    job_id = db.create_job("video", target_language)

    input_filename = f"temp_input_{job_id}_{video_file.filename}"
    input_path = str(OUTPUT_DIR / input_filename)
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(video_file.file, buffer)

    worker.submit(job_id, "video", target_language, file_path=input_path)
    return {"job_id": job_id, "status": "queued"}


@router.post("/submit/ocr")
async def submit_ocr_job(
    target_language: str = Form(...),
    ocr_file: UploadFile = File(...),
):
    """Submit a PDF/image OCR processing job."""
    job_id = db.create_job("ocr", target_language)

    input_filename = f"temp_input_{job_id}_{ocr_file.filename}"
    input_path = str(OUTPUT_DIR / input_filename)
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(ocr_file.file, buffer)

    worker.submit(job_id, "ocr", target_language, file_path=input_path)
    return {"job_id": job_id, "status": "queued"}


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """Poll job status by ID."""
    job = db.get_job(job_id)
    if not job:
        return {"error": "Job not found"}
    return job
