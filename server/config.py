"""
Bhasha Node - Central Configuration
All paths, constants, language mappings, and model identifiers.
"""
import os
from pathlib import Path

# ==========================================
# DIRECTORY STRUCTURE
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "bhasha_node.db"

# Ensure directories exist
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# ==========================================
# CORS & SERVER
# ==========================================
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000
BASE_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"

# ==========================================
# LANGUAGE MAPPINGS
# ==========================================
LANGUAGE_CONFIG = {
    "marathi": {"trans": "mar_Deva", "tts": "mar", "label": "मराठी"},
    "hindi":   {"trans": "hin_Deva", "tts": "hin", "label": "हिन्दी"},
}

# ==========================================
# MODEL IDENTIFIERS (100% Local / HuggingFace Cache)
# ==========================================
ASR_MODEL_SIZE = "small"
ASR_DEVICE = "cpu"
ASR_COMPUTE_TYPE = "int8"

TRANSLATION_MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"

TTS_MODELS = {
    "mar": "facebook/mms-tts-mar",
    "hin": "facebook/mms-tts-hin",
}

# ==========================================
# PROCESSING LIMITS
# ==========================================
MAX_UPLOAD_SIZE_MB = 500
MAX_TEXT_LENGTH = 50000
FFMPEG_AUDIO_PARAMS = ["-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1"]
