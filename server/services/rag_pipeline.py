"""
Bhasha Node - Multilingual Agricultural RAG Orchestrator
Coordinates:
1. Source Language Detection (fastText)
2. Question Translation (Indic -> EN via IndicTrans2)  [for FAISS semantic search]
3. Semantic Vector Search (FAISS Knowledge Base)
4. Context-Grounded LLM Reasoning (Qwen3-4B GGUF)    [replies directly in farmer's language]
5. STM Word Corrections
6. Native TTS Voice Synthesis (Meta MMS VITS for Hindi/Marathi)

Note: EN->Indic back-translation via IndicTrans2 is intentionally skipped.
Qwen3-4B is instructed via system prompt to reply directly in Hindi/Marathi,
eliminating ~60-120s of translation latency and peak RAM pressure.
"""
import os
import time
import uuid
from typing import List, Dict, Any, Optional

from config import BASE_URL, OUTPUT_DIR, LANGUAGE_CONFIG
from services.knowledge_base import KnowledgeBase
from services.qwen_engine import QwenEngine
from services.translation_engine import TranslationService
from services.language_detection_engine import LanguageDetectionService
from services.tts_engine import TTSService
from services.stm_engine import STMService


class RAGPipeline:
    def __init__(
        self,
        knowledge_base: KnowledgeBase,
        qwen_engine: QwenEngine,
        translator: TranslationService,
        language_detector: LanguageDetectionService,
        tts: Optional[TTSService] = None,
        stm: Optional[STMService] = None,
    ):
        self.kb = knowledge_base
        self.qwen = qwen_engine
        self.translator = translator
        self.lang_detector = language_detector
        self.tts = tts
        self.stm = stm

    def answer_question(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        generate_audio: bool = False,
    ) -> Dict[str, Any]:
        """
        End-to-end multilingual RAG processing.
        """
        start_time = time.time()
        question = question.strip()
        if not question:
            return {
                "answer": "Please ask a valid question.",
                "detected_language": "en",
                "sources": [],
                "audio_url": None,
                "latency_sec": 0.0,
            }

        # 1. Detect Question Language
        detected_lang = self.lang_detector.detect(question)
        safe_q_preview = question[:60].encode('ascii', 'backslashreplace').decode('ascii')
        print(f"\n[RAG] New Query: '{safe_q_preview}' (Detected Language: {detected_lang})")

        # 2. Translate Question to English if Indic
        if detected_lang in ("hi", "mr"):
            print(f"[RAG] Translating {detected_lang} question to English for semantic search & reasoning...")
            question_en = self.translator.translate(question, target_lang="eng_Latn")
            safe_en = question_en[:60].encode('ascii', 'backslashreplace').decode('ascii')
            print(f"[RAG] Translated Query (EN): '{safe_en}'")
        else:
            question_en = question

        # Translate past history to English if necessary for LLM multi-turn coherence
        history_en = []
        if conversation_history:
            for turn in conversation_history[-6:]:
                role = turn.get("role", "user")
                text = turn.get("content", "")
                history_en.append({"role": role, "content": text})

        # 3. Retrieve Relevant Chunks from FAISS
        retrieval_start = time.time()
        chunks = self.kb.search(question_en)
        print(f"[RAG] Retrieved {len(chunks)} chunks in {time.time() - retrieval_start:.3f}s")

        # 4. Generate Grounded Answer via Qwen3-4B
        # Pass output_language so Qwen replies directly in the farmer's language,
        # avoiding a costly IndicTrans2 EN→Indic back-translation step.
        llm_start = time.time()
        answer_en = self.qwen.generate_grounded_answer(
            question=question_en,
            context_chunks=chunks,
            conversation_history=history_en,
            output_language=detected_lang,  # 'hi', 'mr', or 'en'
        )
        print(f"[RAG] Qwen3-4B generation completed in {time.time() - llm_start:.2f}s")

        # 5. answer is already in the farmer's language (Qwen replied directly).
        # Translation is skipped — this eliminates the ~117s IndicTrans2 EN→Indic step
        # and dramatically reduces peak RAM (prevents OOM crash after Qwen load).
        final_answer = answer_en  # variable name kept for compatibility
        tts_lang_code = None

        if detected_lang == "mr":
            # Apply STM word corrections if available (no full re-translation needed)
            if self.stm:
                # Provide an identity function as trans_fn since answer is already Marathi
                final_answer = self.stm.apply_corrections(answer_en, final_answer, "marathi", lambda w: w)
            tts_lang_code = "mar"

        elif detected_lang == "hi":
            # Apply STM word corrections if available (no full re-translation needed)
            if self.stm:
                final_answer = self.stm.apply_corrections(answer_en, final_answer, "hindi", lambda w: w)
            tts_lang_code = "hin"

        # 6. Synthesize TTS Audio if requested & available
        audio_url = None
        if generate_audio and self.tts and tts_lang_code in ("mar", "hin"):
            try:
                audio_id = str(uuid.uuid4())[:8]
                audio_filename = f"rag_answer_{audio_id}_{tts_lang_code}.wav"
                audio_path = str(OUTPUT_DIR / audio_filename)
                self.tts.generate_voice(final_answer, lang_code=tts_lang_code, output_file=audio_path)
                audio_url = f"{BASE_URL}/{audio_filename}"
            except Exception as e:
                print(f"[RAG] TTS generation error: {e}")

        # Format sources for UI display
        formatted_sources = []
        for c in chunks:
            formatted_sources.append({
                "id": c.get("id"),
                "source": c.get("source", "Indexed Document"),
                "input_type": c.get("input_type", "document"),
                "content_type": c.get("content_type", "original"),
                "score": round(c.get("score", 0.0) * 100, 1),
                "text": c.get("text", "")[:280] + ("..." if len(c.get("text", "")) > 280 else ""),
                "full_text": c.get("text", ""),
            })

        total_latency = round(time.time() - start_time, 2)
        print(f"[RAG] Completed in {total_latency}s | Answer length: {len(final_answer)} chars")

        return {
            "answer": final_answer,
            "detected_language": detected_lang,
            "sources": formatted_sources,
            "audio_url": audio_url,
            "latency_sec": total_latency,
            "model_used": "Qwen3-4B Q4_K_M GGUF (Local CPU)",
        }
