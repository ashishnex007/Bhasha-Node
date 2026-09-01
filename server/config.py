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
MODELS_DIR = BASE_DIR / "models"
DB_PATH = DATA_DIR / "bhasha_node.db"

# Model paths
FASTTEXT_MODEL_PATH = MODELS_DIR / "lid.176.ftz"

# Ensure directories exist
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

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
    "english": {"trans": "eng_Latn", "tts": "eng", "label": "English"},
}

# ==========================================
# MODEL IDENTIFIERS (100% Local / HuggingFace Cache)
# ==========================================
ASR_MODEL_SIZE = "small"
ASR_DEVICE = "cpu"
ASR_COMPUTE_TYPE = "int8"

TRANSLATION_MODEL          = "ai4bharat/indictrans2-en-indic-dist-200M"
TRANSLATION_MODEL_INDIC_EN = "ai4bharat/indictrans2-indic-en-dist-200M"
TRANSLATION_MODEL_INDIC_INDIC = "ai4bharat/indictrans2-indic-indic-dist-320M"

TTS_MODELS = {
    "mar": "facebook/mms-tts-mar",
    "hin": "facebook/mms-tts-hin",
    "eng": "facebook/mms-tts-eng",
}

# ==========================================
# PROCESSING LIMITS
# ==========================================
MAX_UPLOAD_SIZE_MB = 500
MAX_TEXT_LENGTH = 50000
FFMPEG_AUDIO_PARAMS = ["-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1"]

# ==========================================
# KNOWLEDGE ASSISTANT (Qwen3-4B RAG)
# ==========================================
QWEN_MODEL_PATH    = MODELS_DIR / "Qwen3-4B-Q4_K_M.gguf"
QWEN_N_CTX         = 4096    # context window tokens
QWEN_N_THREADS     = 4       # CPU inference threads
QWEN_MAX_TOKENS    = 512     # max tokens in a single answer
QWEN_TOP_K_CHUNKS  = 5       # FAISS retrieval depth

KB_INDEX_PATH      = DATA_DIR / "kb.faiss"
KB_META_PATH       = DATA_DIR / "kb_meta.json"
EMBED_MODEL_NAME   = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_CACHE_DIR    = str(MODELS_DIR / "embeddings")   # local cache for the embedder
