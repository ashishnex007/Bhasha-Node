"""
Bhasha Node - FastAPI Application Entrypoint
Assembles all routers, initializes ML services, mounts static outputs,
and starts the background job worker.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS, OUTPUT_DIR

# ==========================================
# APP FACTORY
# ==========================================
app = FastAPI(
    title="Bhasha Node - Offline AI Engine",
    description="Enterprise air-gapped multimodal AI pipeline for rural environments.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# MOUNT ROUTERS (before static files)
# ==========================================
from routers import jobs, history, stm, system

app.include_router(jobs.router)
app.include_router(history.router)
app.include_router(stm.router)
app.include_router(system.router)

# ==========================================
# INITIALIZE ML SERVICES ON STARTUP
# ==========================================
@app.on_event("startup")
def startup_event():
    """
    Load all ML models into memory and register them with the job worker.
    This runs once at server boot — models stay resident in RAM.
    """
    print("\n" + "=" * 60)
    print("  BHASHA NODE v2.0 — INITIALIZING AI CORE")
    print("=" * 60)

    from services.translation_engine import TranslationService
    from services.tts_engine import TTSService
    from services.asr_engine import ASRService
    from services.video_engine import VideoService
    from services.ocr_engine import OCRService
    from services.stm_engine import STMService
    from services.system_engine import SystemService
    from task_queue.job_worker import worker

    print("\n[1/6] Loading Translation Service (IndicTrans2 200M)...")
    translator = TranslationService()

    print("[2/6] Loading TTS Service (Meta MMS VITS mar/hin)...")
    tts = TTSService()

    print("[3/6] Loading ASR Service (Faster-Whisper INT8 Small)...")
    asr = ASRService()

    print("[4/6] Loading Video Service (FFmpeg pipeline)...")
    video_engine = VideoService(asr=asr, translator=translator, tts=tts)

    print("[5/6] Loading OCR Service (Tesseract)...")
    ocr_engine = OCRService()

    print("[6/6] Loading STM & System Telemetry...")
    stm_service = STMService()
    system_service = SystemService()

    # Register services with routers that need them
    stm.init(stm_service)
    system.init(system_service)

    # Register all services with the background job worker
    worker.register_services(
        asr=asr,
        translator=translator,
        tts=tts,
        video_engine=video_engine,
        ocr_engine=ocr_engine,
        stm_engine=stm_service,
    )

    print("\n" + "=" * 60)
    print("  AI CORE READY — All models loaded into local memory")
    print("=" * 60 + "\n")


# ==========================================
# STATIC FILE SERVING (must be last — catch-all mount)
# ==========================================
app.mount("/", StaticFiles(directory=str(OUTPUT_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)