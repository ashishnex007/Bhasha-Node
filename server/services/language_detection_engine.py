"""Offline language detection using the bundled FastText model."""
from functools import lru_cache

from config import FASTTEXT_MODEL_PATH, LANGUAGE_CONFIG

_SUPPORTED = {entry["iso"] for entry in LANGUAGE_CONFIG.values()}


@lru_cache(maxsize=1)
def _model():
    import fasttext

    if not FASTTEXT_MODEL_PATH.is_file():
        raise FileNotFoundError(f"Bundled language model is missing: {FASTTEXT_MODEL_PATH}")
    return fasttext.load_model(str(FASTTEXT_MODEL_PATH))


def detect_local(text: str) -> dict:
    normalized = " ".join(text.split())
    if not normalized:
        return {"language": "en", "score": None, "available": False, "supported": True}
    try:
        labels, scores = _model().predict(normalized, k=1)
        language = labels[0].removeprefix("__label__")
        return {"language": language, "score": float(scores[0]),
                "available": True, "supported": language in _SUPPORTED}
    except Exception as exc:
        print(f"[LID] Local language detection failed: {exc}")
        return {"language": "en", "score": None, "available": False, "supported": True}


class LanguageDetectionService:
    """Returns ISO-639-1 codes and genuine FastText prediction scores."""

    def __init__(self):
        print("[LOAD] Booting Language Detection Engine (local FastText)...")
        self._loaded = detect_local("hello")["available"]
        print("[LOAD] Language Detection Engine ready." if self._loaded else
              "[LID] Local model unavailable; language detection will use a fallback.")

    def detect(self, text: str) -> str:
        return self.detect_with_score(text)["language"]

    def detect_with_score(self, text: str) -> dict:
        return detect_local(text)
