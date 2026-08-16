import os
from dotenv import load_dotenv
load_dotenv()   # loads .env

import time
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from huggingface_hub import login

class TranslationService:
    def __init__(self):
        print("[LOAD] Booting Translation Engine (IndicTrans2)...")
        # Authentication required for gated AI4Bharat model
        HF_TOKEN = os.getenv("HF_TOKEN")

        if not HF_TOKEN:
            raise RuntimeError("HF_TOKEN not found in environment")

        login(token=HF_TOKEN)

        # English → Indic model (always loaded)
        self.model_name = "ai4bharat/indictrans2-en-indic-dist-200M"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name, trust_remote_code=True)

        # Indic → Indic model (lazy-loaded on first use to save startup time)
        self._indic_indic_model_name = "ai4bharat/indictrans2-indic-indic-dist-200M"
        self._indic_indic_tokenizer = None
        self._indic_indic_model = None

    def _get_indic_indic(self):
        """Lazy-load the Indic→Indic model on first use."""
        if self._indic_indic_model is None:
            print("[LOAD] Loading Indic→Indic Translation Engine (first use)...")
            self._indic_indic_tokenizer = AutoTokenizer.from_pretrained(
                self._indic_indic_model_name, trust_remote_code=True
            )
            self._indic_indic_model = AutoModelForSeq2SeqLM.from_pretrained(
                self._indic_indic_model_name, trust_remote_code=True
            )
            print("[LOAD] Indic→Indic model loaded.")
        return self._indic_indic_tokenizer, self._indic_indic_model

    @staticmethod
    def _is_devanagari(text: str) -> bool:
        """Check if text is predominantly Devanagari script."""
        if not text:
            return False
        alpha_chars = [c for c in text if c.isalpha()]
        if not alpha_chars:
            return False
        devanagari = sum(1 for c in alpha_chars if '\u0900' <= c <= '\u097F')
        return devanagari / len(alpha_chars) > 0.3

    def _detect_src_lang(self, text: str, target_lang: str) -> str:
        """
        Auto-detect source language from script.
        If text is Devanagari → infer Hindi or Marathi based on target.
        Otherwise → English.
        """
        if self._is_devanagari(text):
            # Devanagari source: if translating TO Marathi, source must be Hindi & vice versa
            if target_lang == "mar_Deva":
                return "hin_Deva"
            elif target_lang == "hin_Deva":
                return "mar_Deva"
            # Fallback: assume Hindi source for any other Indic target
            return "hin_Deva"
        return "eng_Latn"


    def translate(self, text: str, target_lang: str) -> str:
        """target_lang options: 'mar_Deva' (Marathi), 'hin_Deva' (Hindi)"""
        start_time = time.time()

        chunks = self._split_to_chunks(text)
        translated_parts = []

        for i, chunk in enumerate(chunks):
            part = self._translate_one(chunk, target_lang)
            translated_parts.append(part)

        translation = " ".join(translated_parts)
        elapsed = time.time() - start_time
        print(f"[SUCCESS] {target_lang} Translation completed "
              f"({len(chunks)} chunk(s)) in {elapsed:.2f}s")
        return translation

    # ── Internal helpers ──────────────────────────────────────

    def _translate_one(self, text: str, target_lang: str) -> str:
        """Translate a single chunk, auto-picking the correct model."""
        src_lang = self._detect_src_lang(text, target_lang)

        if src_lang == "eng_Latn":
            tokenizer = self.tokenizer
            model = self.model
        else:
            tokenizer, model = self._get_indic_indic()

        formatted = f"{src_lang} {target_lang} {text}"
        inputs = tokenizer(
            formatted, return_tensors="pt", padding=True, truncation=True
        )
        with torch.no_grad():
            outputs = model.generate(
                **inputs, max_new_tokens=512, use_cache=False
            )
        return tokenizer.decode(outputs[0], skip_special_tokens=True)


    # ── Chunk size limit ──────────────────────────────────────
    # The IndicTrans2 tokenizer window is 512 tokens.
    # Devanagari ≈ 2–3 chars/token, Latin ≈ 4 chars/token.
    # 800 chars is a safe ceiling that stays well within 512 tokens
    # for any script while keeping chunk count low on CPU.
    _MAX_CHUNK_CHARS = 800

    def _split_to_chunks(self, text: str) -> list:
        """
        Split *text* into pieces that each fit within _MAX_CHUNK_CHARS.
        Tries to break on paragraph boundaries first, then sentences,
        keeping chunks as large as possible so we make fewer model calls.
        """
        # Fast path: if the whole text fits, don't chunk at all
        if len(text) <= self._MAX_CHUNK_CHARS:
            return [text]

        # 1) Split into paragraphs (double newline or single newline)
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

        chunks: list = []
        current = ""

        for para in paragraphs:
            candidate = (current + "\n" + para).strip() if current else para

            if len(candidate) <= self._MAX_CHUNK_CHARS:
                current = candidate
            else:
                # Current paragraph alone might be too long → split on sentences
                if current:
                    chunks.append(current)
                if len(para) <= self._MAX_CHUNK_CHARS:
                    current = para
                else:
                    # Break this huge paragraph into sentence-level chunks
                    sentence_chunks = self._split_paragraph(para)
                    chunks.extend(sentence_chunks[:-1])
                    current = sentence_chunks[-1] if sentence_chunks else ""

        if current.strip():
            chunks.append(current.strip())

        return chunks if chunks else [text]

    def _split_paragraph(self, para: str) -> list:
        """Split a single paragraph on sentence-ending punctuation."""
        import re
        # Split on .  !  ?  ।  (Devanagari danda) keeping the delimiter
        sentences = re.split(r'(?<=[।.!?])\s+', para)
        chunks: list = []
        current = ""
        for sent in sentences:
            candidate = (current + " " + sent).strip() if current else sent
            if len(candidate) <= self._MAX_CHUNK_CHARS:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                current = sent
        if current.strip():
            chunks.append(current.strip())
        return chunks if chunks else [para]