import os
import re
from dotenv import load_dotenv
load_dotenv()   # loads .env

import time
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from huggingface_hub import login

class TranslationService:
    def __init__(self):
        print("[LOAD] Booting Translation Engine (IndicTrans2 - 3 models)...")
        HF_TOKEN = os.getenv("HF_TOKEN")
        if not HF_TOKEN:
            raise RuntimeError("HF_TOKEN not found in environment")
        login(token=HF_TOKEN)

        # -- Model 1: English -> Indic  (loaded eagerly - most common direction) --
        self._en_indic_name = "ai4bharat/indictrans2-en-indic-dist-200M"
        self.tokenizer = AutoTokenizer.from_pretrained(
            self._en_indic_name, trust_remote_code=True
        )
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            self._en_indic_name, trust_remote_code=True
        )

        # -- Model 2: Indic -> English  (lazy-loaded on first use) --
        self._indic_en_name = "ai4bharat/indictrans2-indic-en-dist-200M"
        self._indic_en_tokenizer = None
        self._indic_en_model = None

        # -- Model 3: Indic -> Indic    (lazy-loaded on first use) --
        self._indic_indic_name = "ai4bharat/indictrans2-indic-indic-dist-320M"
        self._indic_indic_tokenizer = None
        self._indic_indic_model = None

        print("[LOAD] Translation Engine ready (en-indic loaded; indic-en + indic-indic lazy).")

    # ==========================================
    # LAZY LOADERS
    # ==========================================

    def _get_indic_en(self):
        """Lazy-load the Indic->English model on first use."""
        if self._indic_en_model is None:
            print("[LOAD] Loading Indic->English model (first use)...")
            self._indic_en_tokenizer = AutoTokenizer.from_pretrained(
                self._indic_en_name, trust_remote_code=True
            )
            self._indic_en_model = AutoModelForSeq2SeqLM.from_pretrained(
                self._indic_en_name, trust_remote_code=True
            )
            print("[LOAD] Indic->English model loaded.")
        return self._indic_en_tokenizer, self._indic_en_model

    def _get_indic_indic(self):
        """Lazy-load the Indic->Indic model on first use."""
        if self._indic_indic_model is None:
            print("[LOAD] Loading Indic->Indic model (first use)...")
            self._indic_indic_tokenizer = AutoTokenizer.from_pretrained(
                self._indic_indic_name, trust_remote_code=True
            )
            self._indic_indic_model = AutoModelForSeq2SeqLM.from_pretrained(
                self._indic_indic_name, trust_remote_code=True
            )
            print("[LOAD] Indic->Indic model loaded.")
        return self._indic_indic_tokenizer, self._indic_indic_model

    # ==========================================
    # LANGUAGE DETECTION (script-based & linguistic)
    # ==========================================

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
        Determine source language code from the input script and linguistic markers.
        Accurately differentiates Marathi (mar_Deva) from Hindi (hin_Deva).
        """
        if not self._is_devanagari(text):
            return "eng_Latn"

        # Distinct Marathi vs Hindi grammatical vocabulary
        marathi_markers = {'आहे', 'नाही', 'होते', 'आणि', 'च्या', 'तील', 'वरून', 'झाले', 'केले', 'करावे', 'यांचे', 'त्यांचे', 'म्हणून', 'कसा', 'कशी', 'कसे', 'आहेत', 'करणे', 'पाहिजे', 'शेती', 'गाई', 'पाणी', 'दुग्ध', 'पिकांचे', 'रोगाचे'}
        hindi_markers = {'है', 'हैं', 'नहीं', 'और', 'का', 'की', 'के', 'में', 'से', 'को', 'था', 'थी', 'थे', 'होगा', 'होगी', 'करना', 'चाहिए', 'किया', 'गया', 'इस', 'उस', 'पर', 'वाले', 'वाली'}

        words = set(re.findall(r'[\u0900-\u097F]+', text))
        mr_matches = len(words & marathi_markers)
        hi_matches = len(words & hindi_markers)

        if mr_matches > hi_matches:
            return "mar_Deva"
        elif hi_matches > mr_matches:
            return "hin_Deva"

        # Fallback to fastText LID
        try:
            from ftlangdetect import detect
            res = detect(text.replace("\n", " "))
            lang = res.get("lang")
            if lang == "mr":
                return "mar_Deva"
            elif lang == "hi":
                return "hin_Deva"
        except Exception:
            pass

        # Disambiguate by target
        if target_lang == "mar_Deva":
            return "hin_Deva"
        elif target_lang == "hin_Deva":
            return "mar_Deva"

        return "mar_Deva" if mr_matches >= hi_matches else "hin_Deva"

    # ==========================================
    # PUBLIC TRANSLATE API
    # ==========================================

    def translate(self, text: str, target_lang: str, src_lang: str | None = None) -> str:
        """
        Translate *text* to *target_lang*.

        target_lang options:
          'mar_Deva'  — Marathi  (uses en-indic or indic-indic model)
          'hin_Deva'  — Hindi    (uses en-indic or indic-indic model)
          'eng_Latn'  — English  (uses indic-en model)
        """
        start_time = time.time()
        chunks = self._split_to_chunks(text)
        translated_parts = [self._translate_one(c, target_lang, src_lang=src_lang) for c in chunks]
        translation = " ".join(translated_parts)
        elapsed = time.time() - start_time
        print(
            f"[SUCCESS] {target_lang} Translation completed "
            f"({len(chunks)} chunk(s)) in {elapsed:.2f}s"
        )
        return translation

    # ==========================================
    # INTERNAL: MODEL ROUTING
    # ==========================================

    def _translate_one(self, text: str, target_lang: str, src_lang: str | None = None) -> str:
        """Translate a single chunk, routing to the correct model based on script."""
        resolved_src = src_lang or self._detect_src_lang(text, target_lang)

        if resolved_src == "eng_Latn":
            # English → Indic  (en-indic model, loaded at startup)
            tokenizer, model = self.tokenizer, self.model
        elif target_lang == "eng_Latn":
            # Indic → English  (indic-en model)
            tokenizer, model = self._get_indic_en()
        else:
            # Indic → Indic   (indic-indic model)
            tokenizer, model = self._get_indic_indic()

        formatted = f"{resolved_src} {target_lang} {text}"
        inputs = tokenizer(
            formatted, return_tensors="pt", padding=True, truncation=True
        )
        with torch.no_grad():
            outputs = model.generate(
                **inputs, max_new_tokens=512, use_cache=False
            )
        return tokenizer.decode(outputs[0], skip_special_tokens=True)

    # ==========================================
    # CHUNKING
    # ==========================================
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
        if len(text) <= self._MAX_CHUNK_CHARS:
            return [text]

        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        chunks: list = []
        current = ""

        for para in paragraphs:
            candidate = (current + "\n" + para).strip() if current else para
            if len(candidate) <= self._MAX_CHUNK_CHARS:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                if len(para) <= self._MAX_CHUNK_CHARS:
                    current = para
                else:
                    sentence_chunks = self._split_paragraph(para)
                    chunks.extend(sentence_chunks[:-1])
                    current = sentence_chunks[-1] if sentence_chunks else ""

        if current.strip():
            chunks.append(current.strip())

        return chunks if chunks else [text]

    def _split_paragraph(self, para: str) -> list:
        """Split a single paragraph on sentence-ending punctuation."""
        import re
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