"""
Bhasha Node - Language Detection Engine
Uses Meta's fastText lid.176.ftz model via ftlangdetect.
Ships with pre-built wheels for Python 3.9-3.13 on Windows (no C++ build required).
Model is loaded once on startup and stays resident in memory.
"""
from config import FASTTEXT_MODEL_PATH

# Languages we care about — anything else maps to "en" (treat as English)
_SUPPORTED = {"hi", "mr"}


class LanguageDetectionService:
    """
    Lightweight source language identifier.
    Returns ISO-639-1 codes: 'hi' (Hindi), 'mr' (Marathi), 'en' (English/other).
    """

    def __init__(self):
        print("[LOAD] Booting Language Detection Engine (fastText lid.176.ftz)...")
        self._loaded = self._init_model()
        print("[LOAD] Language Detection Engine ready.")

    # ==========================================
    # MODEL BOOTSTRAP
    # ==========================================
    def _init_model(self) -> bool:
        """
        Prime the ftlangdetect cache. The library bundles lid.176.ftz internally
        so no manual download is needed. We run a dummy detect to force model load
        at startup rather than on first real request.
        """
        try:
            from ftlangdetect import detect as _detect
            _detect("hello")  # warm up — loads model into C++ runtime
            self._detect_fn = _detect
            return True
        except Exception as e:
            print(f"[LID] Warning: fasttext-langdetect failed to load: {e}")
            print("[LID] Language detection will default to 'en' for all inputs.")
            self._detect_fn = None
            return False

    # ==========================================
    # PUBLIC API
    # ==========================================
    def detect(self, text: str) -> str:
        """
        Detect the dominant language of the input text.

        Args:
            text: Raw input string (any script/language).

        Returns:
            ISO-639-1 code: 'hi', 'mr', or 'en' (default for all other languages).
        """
        if not text or not text.strip() or not self._detect_fn:
            return "en"

        try:
            # ftlangdetect returns {'lang': 'hi', 'score': 0.99...}
            result = self._detect_fn(text.strip().replace("\n", " "), low_memory=False)
            lang_code = result.get("lang", "en").lower()
            detected = lang_code if lang_code in _SUPPORTED else "en"
            return detected
        except Exception as e:
            print(f"[LID] Detection failed: {e}")
            return "en"
