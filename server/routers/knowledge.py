"""
Bhasha Node - Knowledge Assistant Router
API endpoints for:
- RAG question answering with grounding & multi-turn history
- Knowledge Base FAISS index rebuilding
- Status and health checking of Qwen3 LLM & Vector Store
- On-demand TTS generation for chat answers
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import BASE_URL, OUTPUT_DIR
from services.rag_pipeline import RAGPipeline
from services.knowledge_base import KnowledgeBase
from services.qwen_engine import QwenEngine
from services.tts_engine import TTSService

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

_rag_pipeline: Optional[RAGPipeline] = None
_kb: Optional[KnowledgeBase] = None
_qwen: Optional[QwenEngine] = None
_tts: Optional[TTSService] = None


def init(
    rag_pipeline: RAGPipeline,
    kb: KnowledgeBase,
    qwen: QwenEngine,
    tts: Optional[TTSService] = None,
):
    global _rag_pipeline, _kb, _qwen, _tts
    _rag_pipeline = rag_pipeline
    _kb = kb
    _qwen = qwen
    _tts = tts


class ChatMessage(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    question: str
    history: Optional[List[ChatMessage]] = []
    generate_audio: bool = False


class TTSRequest(BaseModel):
    text: str
    language: str  # 'hi' or 'mr'


@router.post("/ask")
async def ask_knowledge(request: AskRequest):
    """
    Ask an agricultural question grounded in the indexed documents.
    Supports English, Hindi, and Marathi with automatic translation and grounding.
    """
    if not _rag_pipeline:
        raise HTTPException(status_code=500, detail="Knowledge Assistant RAG pipeline is not initialized.")

    history_dicts = [{"role": m.role, "content": m.content} for m in request.history] if request.history else []
    result = _rag_pipeline.answer_question(
        question=request.question,
        conversation_history=history_dicts,
        generate_audio=request.generate_audio,
    )
    return result


@router.post("/rebuild")
async def rebuild_index():
    """
    Scan all processed documents/inferences in the database and re-build the FAISS index.
    """
    if not _kb:
        raise HTTPException(status_code=500, detail="Knowledge Base service is not initialized.")
    count = _kb.rebuild_from_history()
    return {
        "indexed_chunks": count,
        "message": f"Successfully indexed {count} agricultural knowledge chunks.",
    }


@router.get("/status")
async def get_status():
    """
    Returns current status of the Knowledge Base and Qwen LLM engine.
    """
    if not _kb or not _qwen:
        return {
            "indexed_chunks": 0,
            "indexed_documents": 0,
            "model_available": False,
            "model_loaded": False,
            "model_path": "",
            "is_ready": False,
        }

    stats = _kb.get_stats()
    return {
        "indexed_chunks": stats.get("indexed_chunks", 0),
        "indexed_documents": stats.get("indexed_documents", 0),
        "model_available": _qwen.is_model_available(),
        "model_loaded": _qwen.is_model_loaded(),
        "model_path": _qwen.model_path,
        "is_ready": stats.get("is_ready", False),
    }


@router.post("/tts")
async def synthesize_chat_audio(request: TTSRequest):
    """
    On-demand voice synthesis for a chat response.
    """
    if not _tts:
        raise HTTPException(status_code=500, detail="TTS service is not initialized.")

    lang = request.language.lower()
    tts_code = "mar" if "mar" in lang or lang == "mr" else "hin" if "hin" in lang or lang == "hi" else None
    
    if not tts_code:
        raise HTTPException(status_code=400, detail="TTS is only supported for Hindi ('hi') and Marathi ('mr').")

    try:
        audio_id = str(uuid.uuid4())[:8]
        audio_filename = f"chat_tts_{audio_id}_{tts_code}.wav"
        audio_path = str(OUTPUT_DIR / audio_filename)
        _tts.generate_voice(request.text, lang_code=tts_code, output_file=audio_path)
        return {"audio_url": f"{BASE_URL}/{audio_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice synthesis failed: {str(e)}")
