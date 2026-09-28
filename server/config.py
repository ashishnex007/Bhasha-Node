"""
Bhasha Node - Central Configuration
All paths, constants, language mappings, and model identifiers.
"""
import os
import sys
import shutil
from pathlib import Path

# Model libraries must never attempt to download assets at runtime.
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

# Force UTF-8 on Windows stdout/stderr to prevent charmap/cp1252 encoding crashes
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ==========================================
# DIRECTORY STRUCTURE
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
APP_VERSION = "2.1.0"
APP_ROOT = BASE_DIR.parent
USER_DATA_ROOT = Path(os.environ["BHASHA_DATA_DIR"]) if os.environ.get("BHASHA_DATA_DIR") else BASE_DIR
OUTPUT_DIR = USER_DATA_ROOT / "outputs"
DATA_DIR = USER_DATA_ROOT / "data"
MODELS_DIR = BASE_DIR / "models"
DB_PATH = DATA_DIR / "bhasha_node.db"
TOOLS_DIR = APP_ROOT / "tools"

def _find_tool(local_paths: list[Path], system_name: str) -> str:
    for candidate in local_paths:
        if candidate.is_file():
            return str(candidate)
    return shutil.which(system_name) or system_name

FFMPEG_BIN = _find_tool([TOOLS_DIR / "ffmpeg" / "bin" / "ffmpeg.exe",
                         TOOLS_DIR / "ffmpeg.exe"], "ffmpeg")
TESSERACT_BIN = _find_tool([TOOLS_DIR / "tesseract" / "tesseract.exe",
                            Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")], "tesseract")
POPPLER_BIN = next((str(p) for p in [TOOLS_DIR / "poppler" / "bin",
                      Path(r"C:\Program Files\poppler\bin")] if p.is_dir()), None)

# Model paths
FASTTEXT_MODEL_PATH = MODELS_DIR / "lid.176.bin"

# Ensure directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

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
SERVER_PORT = int(os.environ.get("BHASHA_PORT", "8000"))
BASE_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"

# ==========================================
# LANGUAGE MAPPINGS
# ==========================================
LANGUAGE_CONFIG = {
    "marathi": {"trans": "mar_Deva", "tts": "mar", "ocr": "mar", "iso": "mr", "name": "Marathi", "label": "मराठी"},
    "hindi":   {"trans": "hin_Deva", "tts": "hin", "ocr": "hin", "iso": "hi", "name": "Hindi", "label": "हिन्दी"},
    "english": {"trans": "eng_Latn", "tts": "eng", "ocr": "eng", "iso": "en", "name": "English", "label": "English"},
    "assamese": {"trans": "asm_Beng", "tts": None, "ocr": None, "iso": "as", "name": "Assamese", "label": "অসমীয়া"},
    "bengali": {"trans": "ben_Beng", "tts": None, "ocr": None, "iso": "bn", "name": "Bengali", "label": "বাংলা"},
    "bodo": {"trans": "brx_Deva", "tts": None, "ocr": None, "iso": "brx", "name": "Bodo", "label": "बड़ो"},
    "dogri": {"trans": "doi_Deva", "tts": None, "ocr": None, "iso": "doi", "name": "Dogri", "label": "डोगरी"},
    "gujarati": {"trans": "guj_Gujr", "tts": None, "ocr": None, "iso": "gu", "name": "Gujarati", "label": "ગુજરાતી"},
    "kannada": {"trans": "kan_Knda", "tts": None, "ocr": None, "iso": "kn", "name": "Kannada", "label": "ಕನ್ನಡ"},
    "kashmiri": {"trans": "kas_Arab", "tts": None, "ocr": None, "iso": "ks", "name": "Kashmiri", "label": "کٲشُر"},
    "konkani": {"trans": "gom_Deva", "tts": None, "ocr": None, "iso": "gom", "name": "Konkani", "label": "कोंकणी"},
    "maithili": {"trans": "mai_Deva", "tts": None, "ocr": None, "iso": "mai", "name": "Maithili", "label": "मैथिली"},
    "malayalam": {"trans": "mal_Mlym", "tts": None, "ocr": None, "iso": "ml", "name": "Malayalam", "label": "മലയാളം"},
    "manipuri": {"trans": "mni_Beng", "tts": None, "ocr": None, "iso": "mni", "name": "Manipuri", "label": "মৈতৈলোন্"},
    "nepali": {"trans": "npi_Deva", "tts": None, "ocr": None, "iso": "ne", "name": "Nepali", "label": "नेपाली"},
    "odia": {"trans": "ory_Orya", "tts": None, "ocr": None, "iso": "or", "name": "Odia", "label": "ଓଡ଼ିଆ"},
    "punjabi": {"trans": "pan_Guru", "tts": None, "ocr": None, "iso": "pa", "name": "Punjabi", "label": "ਪੰਜਾਬੀ"},
    "sanskrit": {"trans": "san_Deva", "tts": None, "ocr": None, "iso": "sa", "name": "Sanskrit", "label": "संस्कृतम्"},
    "santali": {"trans": "sat_Olck", "tts": None, "ocr": None, "iso": "sat", "name": "Santali", "label": "ᱥᱟᱱᱛᱟᱲᱤ"},
    "sindhi": {"trans": "snd_Arab", "tts": None, "ocr": None, "iso": "sd", "name": "Sindhi", "label": "سنڌي"},
    "tamil": {"trans": "tam_Taml", "tts": None, "ocr": None, "iso": "ta", "name": "Tamil", "label": "தமிழ்"},
    "telugu": {"trans": "tel_Telu", "tts": None, "ocr": None, "iso": "te", "name": "Telugu", "label": "తెలుగు"},
    "urdu": {"trans": "urd_Arab", "tts": None, "ocr": None, "iso": "ur", "name": "Urdu", "label": "اردو"},
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

TTS_MODELS = {entry["tts"]: f"facebook/mms-tts-{entry['tts']}"
              for entry in LANGUAGE_CONFIG.values() if entry["tts"]}

# ==========================================
# PROCESSING LIMITS
# ==========================================
MAX_UPLOAD_SIZE_MB = 500
MAX_TEXT_LENGTH = 50000
QUALITY_MEMORY_LIMIT_GB = float(os.environ.get("BHASHA_QUALITY_MEMORY_LIMIT_GB", "0"))
FFMPEG_AUDIO_PARAMS = ["-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1"]

# ==========================================
# BHASHA AGENT (Qwen3-4B RAG)
# ==========================================
QWEN_MODEL_PATH    = MODELS_DIR / "Qwen3-4B-Q4_K_M.gguf"
INDIC_COMET_CHECKPOINT = MODELS_DIR / "indic-comet" / "checkpoints" / "model.ckpt"
QWEN_N_CTX         = 2048    # bounded context to limit local RAM
QWEN_N_THREADS     = 4       # CPU inference threads
QWEN_MAX_TOKENS    = 512     # max tokens in a single answer
QWEN_TOP_K_CHUNKS  = 5       # FAISS retrieval depth

KB_INDEX_PATH      = DATA_DIR / "kb.faiss"
KB_META_PATH       = DATA_DIR / "kb_meta.json"
EMBED_MODEL_NAME   = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_CACHE_DIR    = str(MODELS_DIR / "embeddings")   # local cache for the embedder
