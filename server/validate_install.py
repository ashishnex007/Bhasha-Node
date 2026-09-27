"""Lightweight offline installation check. Never loads the large models."""
import importlib.util
import json
from pathlib import Path

from config import (FFMPEG_BIN, TESSERACT_BIN, POPPLER_BIN, MODELS_DIR, FASTTEXT_MODEL_PATH,
                    QWEN_MODEL_PATH, INDIC_COMET_CHECKPOINT, LANGUAGE_CONFIG)


def validate() -> dict:
    checks = {}
    for module in ("fastapi", "uvicorn", "faster_whisper", "transformers", "torch",
                   "pytesseract", "pdf2image", "fasttext", "faiss",
                   "sentence_transformers", "llama_cpp", "comet"):
        checks[f"python:{module}"] = importlib.util.find_spec(module) is not None
    checks["tool:ffmpeg"] = Path(FFMPEG_BIN).is_file()
    checks["tool:tesseract"] = Path(TESSERACT_BIN).is_file()
    checks["tool:poppler"] = bool(POPPLER_BIN and (Path(POPPLER_BIN) / "pdftoppm.exe").is_file())
    checks["model:qwen"] = QWEN_MODEL_PATH.is_file()
    checks["model:fasttext"] = FASTTEXT_MODEL_PATH.is_file()
    checks["model:indic-comet"] = INDIC_COMET_CHECKPOINT.is_file()
    checks["model:indic-comet-hparams"] = (INDIC_COMET_CHECKPOINT.parent.parent / "hparams.yaml").is_file()
    hub = MODELS_DIR / "huggingface" / "hub"
    for name in ("ai4bharat--indictrans2-en-indic-dist-200M",
                 "ai4bharat--indictrans2-indic-en-dist-200M",
                 "ai4bharat--indictrans2-indic-indic-dist-320M",
                 "Systran--faster-whisper-small",
                 "sentence-transformers--all-MiniLM-L6-v2"):
        checks[f"model:{name}"] = (hub / f"models--{name}" / "snapshots").is_dir()
    for entry in LANGUAGE_CONFIG.values():
        if entry["tts"]:
            name = f"facebook--mms-tts-{entry['tts']}"
            checks[f"model:{name}"] = (hub / f"models--{name}" / "snapshots").is_dir()
        if entry["ocr"]:
            tessdata = MODELS_DIR.parent.parent / "tools" / "tesseract" / "tessdata"
            checks[f"ocr:{entry['ocr']}"] = (tessdata / f"{entry['ocr']}.traineddata").is_file()
    return {"ready": all(checks.values()), "checks": checks}


if __name__ == "__main__":
    print(json.dumps(validate(), indent=2))
