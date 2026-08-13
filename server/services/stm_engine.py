"""
Bhasha Node - Semantic Translation Memory (STM)
Word Dictionary: saves custom word pairs and applies them to translations.

How it works:
  The AI translates the full text first (unchanged).
  Then for each saved word that appeared in the ORIGINAL English text,
  we ask the AI "what would you translate just this word to?" — that gives
  us the exact string to find and replace in the translated output.
  This avoids any placeholder tricks that break with Indic script transliteration.
"""
import re
from db.database import db


class STMService:
    def __init__(self):
        print("[LOAD] STM (Word Dictionary) engine ready.")

    def apply_corrections(self, original_text: str, translated_text: str,
                          target_language: str, translator_fn) -> str:
        """
        Correct saved word pairs in a finished translation.

        Args:
            original_text   — the original English text that was sent to the AI
            translated_text — the AI's translation output
            target_language — DB key: "marathi" or "hindi"
            translator_fn   — callable(word: str) -> str
                              Translates a single word using the same AI model.
                              Pass: lambda w: translator.translate(w, target_lang=config["trans"])

        Returns:
            Corrected translated text with saved word pairs applied.
        """
        terms = db.get_stm_terms(target_language=target_language)
        if not terms:
            return translated_text

        result = translated_text
        applied = 0

        for term in terms:
            source = term["source_term"]
            target = term["target_term"]

            # Only act if this word appears in the original English input
            if not re.search(re.escape(source), original_text, re.IGNORECASE):
                continue

            # Ask the AI what it translates just this one word/phrase to
            try:
                ai_word = translator_fn(source).strip()
                if ai_word and ai_word in result:
                    result = result.replace(ai_word, target)
                    applied += 1
                    print(f"[STM] '{source}' → AI said '{ai_word}' → replaced with '{target}'")
                else:
                    # Fallback: try case-insensitive match
                    pattern = re.compile(re.escape(ai_word), re.IGNORECASE) if ai_word else None
                    if pattern and pattern.search(result):
                        result = pattern.sub(target, result)
                        applied += 1
                        print(f"[STM] '{source}' → AI said '{ai_word}' → replaced with '{target}' (case-insensitive)")
                    else:
                        print(f"[STM] Warning: AI translated '{source}' to '{ai_word}' but not found in output: '{result[:80]}'")
            except Exception as e:
                print(f"[STM] Warning: could not get AI translation for '{source}': {e}")

        if applied > 0:
            print(f"[STM] Applied {applied} word correction(s) for {target_language}")

        return result

    # ── CRUD helpers ──────────────────────────────────────────
    def add_term(self, source_term: str, target_term: str,
                 target_language: str, domain: str = "agriculture"):
        """Add a new word pair to the dictionary."""
        db.add_stm_term(source_term, target_term, target_language, domain)
        print(f"[STM] Added: '{source_term}' → '{target_term}' ({target_language})")

    def get_terms(self, target_language: str = "") -> list[dict]:
        """Return all saved word pairs, optionally filtered by language."""
        return db.get_stm_terms(target_language)

    def delete_term(self, term_id: int):
        """Remove a word pair from the dictionary."""
        db.delete_stm_term(term_id)
        print(f"[STM] Deleted term ID: {term_id}")
