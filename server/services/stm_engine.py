"""
Bhasha Node - Semantic Translation Memory (STM)
Uses simple string matching against a local SQLite dictionary for
domain-specific agricultural term enforcement.
Faiss vector search is available as an optional upgrade when
sentence-transformers is installed.
"""
import re
from db.database import db


class STMService:
    """
    Post-processes translated text to enforce domain-specific terminology.
    Reads correction pairs from the SQLite stm_terms table and applies
    find-and-replace on translated output.
    """

    def __init__(self):
        print("[LOAD] STM (Semantic Translation Memory) engine ready.")

    def apply_corrections(self, translated_text: str, target_language: str) -> str:
        """
        Applies all STM term corrections for the given target language.
        This is a post-processing step after IndicTrans2 inference.
        """
        terms = db.get_stm_terms(target_language=target_language)
        if not terms:
            return translated_text

        corrected = translated_text
        applied_count = 0

        for term in terms:
            source = term["source_term"]
            target = term["target_term"]
            # Case-insensitive replacement for English source terms
            pattern = re.compile(re.escape(source), re.IGNORECASE)
            new_text = pattern.sub(target, corrected)
            if new_text != corrected:
                applied_count += 1
                corrected = new_text

        if applied_count > 0:
            print(f"[STM] Applied {applied_count} domain corrections for {target_language}")

        return corrected

    def add_term(self, source_term: str, target_term: str, target_language: str, domain: str = "agriculture"):
        """Add a new correction term to the STM dictionary."""
        db.add_stm_term(source_term, target_term, target_language, domain)
        print(f"[STM] Added term: '{source_term}' -> '{target_term}' ({target_language})")

    def get_terms(self, target_language: str = "") -> list[dict]:
        """Retrieve all STM terms, optionally filtered by language."""
        return db.get_stm_terms(target_language)

    def delete_term(self, term_id: int):
        """Remove a term from the STM dictionary."""
        db.delete_stm_term(term_id)
        print(f"[STM] Deleted term ID: {term_id}")
