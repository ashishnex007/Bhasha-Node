"""
Bhasha Node - Agricultural Knowledge Base Service (FAISS Vector Store)
Indexes all processed documents/audio/video transcriptions from SQLite inferences.
Performs semantic similarity search to provide grounded context for Qwen3-4B.
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional

from config import (
    KB_INDEX_PATH,
    KB_META_PATH,
    EMBED_MODEL_NAME,
    EMBED_CACHE_DIR,
    QWEN_TOP_K_CHUNKS,
)
from db.database import db


class KnowledgeBase:
    def __init__(self):
        self.index_path = str(KB_INDEX_PATH)
        self.meta_path = str(KB_META_PATH)
        self._embedder = None
        self._index = None
        self._chunks_meta: List[Dict[str, Any]] = []
        
        # Load existing index & metadata if present
        self._load_index()

    def _get_embedder(self):
        """Lazy load SentenceTransformer model."""
        if self._embedder is None:
            print(f"[LOAD] Loading Embedding Engine ({EMBED_MODEL_NAME})...")
            from sentence_transformers import SentenceTransformer
            os.makedirs(EMBED_CACHE_DIR, exist_ok=True)
            self._embedder = SentenceTransformer(
                EMBED_MODEL_NAME,
                cache_folder=EMBED_CACHE_DIR
            )
            print("[LOAD] Embedding Engine ready.")
        return self._embedder

    def _load_index(self):
        """Load index and metadata from disk if they exist."""
        try:
            import faiss
            if os.path.exists(self.index_path) and os.path.exists(self.meta_path):
                self._index = faiss.read_index(self.index_path)
                with open(self.meta_path, "r", encoding="utf-8") as f:
                    self._chunks_meta = json.load(f)
                print(f"[KB] Loaded FAISS index with {len(self._chunks_meta)} chunks from disk.")
            else:
                self._index = None
                self._chunks_meta = []
        except Exception as e:
            print(f"[KB] Notice: Could not load existing FAISS index ({e}). A new one will be created upon indexing.")
            self._index = None
            self._chunks_meta = []

    def _save_index(self):
        """Save index and metadata to disk."""
        if self._index is None or not self._chunks_meta:
            return
        try:
            import faiss
            os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
            faiss.write_index(self._index, self.index_path)
            with open(self.meta_path, "w", encoding="utf-8") as f:
                json.dump(self._chunks_meta, f, ensure_ascii=False, indent=2)
            print(f"[KB] Successfully saved {len(self._chunks_meta)} chunks to {self.index_path}")
        except Exception as e:
            print(f"[KB] Error saving FAISS index to disk: {e}")

    @staticmethod
    def _chunk_text(text: str, max_chunk_chars: int = 450, overlap_chars: int = 50) -> List[str]:
        """Break text into manageable chunks respecting sentence/paragraph boundaries."""
        if not text or not text.strip():
            return []
        
        text = text.strip()
        if len(text) <= max_chunk_chars:
            return [text]

        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        chunks = []
        current_chunk = ""

        for p in paragraphs:
            if len(p) <= max_chunk_chars:
                if len(current_chunk) + len(p) + 1 <= max_chunk_chars:
                    current_chunk = f"{current_chunk}\n{p}".strip() if current_chunk else p
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = p
            else:
                # Break long paragraph by sentences
                import re
                sentences = re.split(r'(?<=[.!?।])\s+', p)
                for s in sentences:
                    s = s.strip()
                    if not s:
                        continue
                    if len(current_chunk) + len(s) + 1 <= max_chunk_chars:
                        current_chunk = f"{current_chunk} {s}".strip() if current_chunk else s
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = s

        if current_chunk:
            chunks.append(current_chunk)

        return chunks if chunks else [text]

    def rebuild_from_history(self) -> int:
        """
        Scan all completed inferences in the database, chunk and embed them,
        and build a fresh FAISS index.
        """
        import faiss
        records = db.get_all_inferences_for_indexing()
        if not records:
            print("[KB] No inference records found in database to index.")
            self._index = None
            self._chunks_meta = []
            return 0

        embedder = self._get_embedder()
        all_chunks_text = []
        all_chunks_meta = []

        for rec in records:
            source_name = rec.get("file_name") or f"Record #{rec.get('id')}"
            input_type = rec.get("input_type", "document")
            created_at = rec.get("created_at", "")
            target_lang = rec.get("target_language", "")

            # Index original text
            orig = (rec.get("original_text") or "").strip()
            if orig:
                chunks = self._chunk_text(orig)
                for idx, c in enumerate(chunks):
                    all_chunks_text.append(c)
                    all_chunks_meta.append({
                        "id": len(all_chunks_meta),
                        "inference_id": rec.get("id"),
                        "source": source_name,
                        "input_type": input_type,
                        "text": c,
                        "content_type": "original",
                        "target_language": target_lang,
                        "created_at": created_at,
                        "chunk_index": idx + 1,
                        "total_chunks": len(chunks)
                    })

            # Index translated text (if distinctly different)
            trans = (rec.get("translated_text") or "").strip()
            if trans and trans != orig:
                chunks_trans = self._chunk_text(trans)
                for idx, c in enumerate(chunks_trans):
                    all_chunks_text.append(c)
                    all_chunks_meta.append({
                        "id": len(all_chunks_meta),
                        "inference_id": rec.get("id"),
                        "source": f"{source_name} (Translated to {target_lang})",
                        "input_type": input_type,
                        "text": c,
                        "content_type": "translated",
                        "target_language": target_lang,
                        "created_at": created_at,
                        "chunk_index": idx + 1,
                        "total_chunks": len(chunks_trans)
                    })

        if not all_chunks_text:
            return 0

        print(f"[KB] Generating embeddings for {len(all_chunks_text)} chunks...")
        embeddings = embedder.encode(all_chunks_text, batch_size=32, show_progress_bar=False, normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype=np.float32)

        dimension = embeddings.shape[1]
        # Inner Product with normalized embeddings = Cosine Similarity
        index = faiss.IndexFlatIP(dimension)
        index.add(embeddings)

        self._index = index
        self._chunks_meta = all_chunks_meta
        self._save_index()
        print(f"[KB] Rebuild complete: {len(all_chunks_meta)} chunks indexed.")
        return len(all_chunks_meta)

    def search(self, query: str, top_k: int = QWEN_TOP_K_CHUNKS) -> List[Dict[str, Any]]:
        """
        Search knowledge base for chunks matching query.
        Returns list of metadata dicts with 'similarity' score.
        """
        if self._index is None or not self._chunks_meta:
            # Auto-attempt build from DB if empty
            count = self.rebuild_from_history()
            if count == 0 or self._index is None:
                return []

        embedder = self._get_embedder()
        q_emb = embedder.encode([query], normalize_embeddings=True)
        q_emb = np.array(q_emb, dtype=np.float32)

        k = min(top_k, len(self._chunks_meta))
        if k <= 0:
            return []

        scores, indices = self._index.search(q_emb, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self._chunks_meta):
                continue
            chunk = dict(self._chunks_meta[idx])
            chunk["score"] = float(score)
            results.append(chunk)

        return results

    def get_stats(self) -> Dict[str, Any]:
        """Return knowledge base size and status."""
        doc_ids = set(c.get("inference_id") for c in self._chunks_meta if c.get("inference_id"))
        return {
            "indexed_chunks": len(self._chunks_meta),
            "indexed_documents": len(doc_ids),
            "is_ready": self._index is not None and len(self._chunks_meta) > 0,
            "index_path": self.index_path,
        }
