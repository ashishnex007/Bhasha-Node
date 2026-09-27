"""
Bhasha Node - SQLite Persistence Layer
Manages jobs, inference history, and STM dictionary terms.
Thread-safe via check_same_thread=False.
"""
import sqlite3
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager
from config import DB_PATH


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, db_path: Path | str = DB_PATH):
        self.db_path = str(db_path)
        self._create_tables()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _create_tables(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id       TEXT PRIMARY KEY,
                    type         TEXT NOT NULL,
                    target_language TEXT NOT NULL,
                    status       TEXT NOT NULL DEFAULT 'queued',
                    progress     INTEGER NOT NULL DEFAULT 0,
                    stage        TEXT NOT NULL DEFAULT 'Queued',
                    error        TEXT,
                    created_at   TEXT NOT NULL,
                    completed_at TEXT,
                    result_json  TEXT
                );

                CREATE TABLE IF NOT EXISTS inferences (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id          TEXT,
                    input_type      TEXT NOT NULL,
                    original_text   TEXT,
                    translated_text TEXT,
                    audio_url       TEXT,
                    video_url       TEXT,
                    file_name       TEXT,
                    target_language TEXT NOT NULL,
                    created_at      TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
                );

                CREATE TABLE IF NOT EXISTS stm_terms (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_term     TEXT NOT NULL,
                    target_term     TEXT NOT NULL,
                    target_language TEXT NOT NULL,
                    domain          TEXT DEFAULT 'agriculture',
                    created_at      TEXT NOT NULL
                );
            """)
            # Existing installations already have jobs. Add metadata in place.
            columns = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
            for name, sql_type in {
                "source_filename": "TEXT", "source_media_path": "TEXT",
                "source_media_type": "TEXT", "source_language": "TEXT",
                "updated_at": "TEXT", "source_text": "TEXT",
            }.items():
                if name not in columns:
                    conn.execute(f"ALTER TABLE jobs ADD COLUMN {name} {sql_type}")

    # ==========================================
    # JOBS
    # ==========================================
    def create_job(self, job_type: str, target_language: str,
                   source_filename: str = "", source_media_path: str = "",
                   source_media_type: str = "", source_text: str = "",
                   source_language: str = "") -> str:
        job_id = str(uuid.uuid4())
        now = _now_iso()
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO jobs (job_id, type, target_language, created_at, updated_at,
                   source_filename, source_media_path, source_media_type, source_text, source_language)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, job_type, target_language, now, now,
                 source_filename, source_media_path, source_media_type, source_text, source_language),
            )
        return job_id

    def set_source(self, job_id: str, path: str, filename: str, media_type: str):
        with self._conn() as conn:
            conn.execute("""UPDATE jobs SET source_media_path=?, source_filename=?,
                           source_media_type=?, updated_at=? WHERE job_id=?""",
                         (path, filename, media_type, _now_iso(), job_id))

    def update_job_progress(self, job_id: str, progress: int, stage: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET progress=?, stage=?, status='processing', updated_at=? WHERE job_id=?",
                (progress, stage, _now_iso(), job_id),
            )

    def complete_job(self, job_id: str, result: dict):
        with self._conn() as conn:
            conn.execute(
                """UPDATE jobs SET status='complete', progress=100, stage='Complete',
                   completed_at=?, updated_at=?, source_language=?, result_json=? WHERE job_id=?""",
                (_now_iso(), _now_iso(), result.get("detected_source_language"),
                 json.dumps(result, ensure_ascii=False), job_id),
            )

    def fail_job(self, job_id: str, error: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET status='error', stage='Failed', error=?, completed_at=?, updated_at=? WHERE job_id=?",
                (error, _now_iso(), _now_iso(), job_id),
            )

    def get_job(self, job_id: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            if d.get("result_json"):
                d["result"] = json.loads(d["result_json"])
            else:
                d["result"] = None
            return d

    def list_jobs(self, limit: int = 50, offset: int = 0) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute("""SELECT job_id, type, status, stage, source_filename,
                source_language, target_language, created_at, completed_at
                FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?""",
                (limit, offset)).fetchall()
            return [dict(row) for row in rows]

    def delete_job(self, job_id: str) -> bool:
        with self._conn() as conn:
            row = conn.execute("SELECT status FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row or row["status"] in ("processing", "queued"):
                return False
            conn.execute("DELETE FROM inferences WHERE job_id=?", (job_id,))
            conn.execute("DELETE FROM jobs WHERE job_id=?", (job_id,))
            return True

    def update_translation(self, job_id: str, translated_text: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute("SELECT result_json, status FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row or row["status"] != "complete" or not row["result_json"]:
                return None
            result = json.loads(row["result_json"])
            result["translated_text"] = translated_text
            result["reviewed_at"] = _now_iso()
            for key in ("quality_score", "quality_metric", "quality_reference", "quality_evaluated_at"):
                result.pop(key, None)
            conn.execute("UPDATE jobs SET result_json=?, updated_at=? WHERE job_id=?",
                         (json.dumps(result, ensure_ascii=False), _now_iso(), job_id))
            conn.execute("UPDATE inferences SET translated_text=? WHERE job_id=?",
                         (translated_text, job_id))
            return result

    def save_quality(self, job_id: str, score: float, reference_text: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute("SELECT result_json, status FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row or row["status"] != "complete" or not row["result_json"]:
                return None
            result = json.loads(row["result_json"])
            result.update({"quality_score": score, "quality_metric": "IndicCOMET",
                           "quality_reference": reference_text, "quality_evaluated_at": _now_iso()})
            conn.execute("UPDATE jobs SET result_json=?, updated_at=? WHERE job_id=?",
                         (json.dumps(result, ensure_ascii=False), _now_iso(), job_id))
            return result

    # ==========================================
    # INFERENCE HISTORY
    # ==========================================
    def save_inference(self, job_id: str | None, input_type: str, original_text: str,
                       translated_text: str, target_language: str,
                       audio_url: str = "", video_url: str = "", file_name: str = ""):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO inferences
                   (job_id, input_type, original_text, translated_text, audio_url, video_url, file_name, target_language, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, input_type, original_text, translated_text, audio_url, video_url, file_name, target_language, _now_iso()),
            )

    def get_history(self, limit: int = 50, offset: int = 0) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM inferences ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_history_count(self) -> int:
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM inferences").fetchone()
            return row["cnt"]

    def delete_inference(self, inference_id: int):
        with self._conn() as conn:
            conn.execute("DELETE FROM inferences WHERE id=?", (inference_id,))

    # ==========================================
    # STM TERMS
    # ==========================================
    def add_stm_term(self, source_term: str, target_term: str, target_language: str, domain: str = "agriculture"):
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO stm_terms (source_term, target_term, target_language, domain, created_at) VALUES (?, ?, ?, ?, ?)",
                (source_term, target_term, target_language, domain, _now_iso()),
            )

    def get_stm_terms(self, target_language: str = "") -> list[dict]:
        with self._conn() as conn:
            if target_language:
                rows = conn.execute(
                    "SELECT * FROM stm_terms WHERE target_language=? ORDER BY created_at DESC",
                    (target_language,),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM stm_terms ORDER BY created_at DESC").fetchall()
            return [dict(r) for r in rows]

    def delete_stm_term(self, term_id: int):
        with self._conn() as conn:
            conn.execute("DELETE FROM stm_terms WHERE id=?", (term_id,))

    # ==========================================
    # KNOWLEDGE BASE INDEXING
    # ==========================================
    def get_all_inferences_for_indexing(self) -> list[dict]:
        """
        Return every inference record that has useful text content.
        Used by KnowledgeBase.rebuild_from_history() to populate the FAISS index.
        """
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT id, job_id, input_type, original_text, translated_text,
                          file_name, target_language, created_at
                   FROM inferences
                   WHERE original_text IS NOT NULL AND original_text != ''
                   ORDER BY created_at ASC"""
            ).fetchall()
            return [dict(r) for r in rows]

    # ==========================================
    # CRASH RECOVERY
    # ==========================================
    def get_stuck_jobs(self) -> list[dict]:
        """
        Find jobs that are still 'processing' or 'queued' — these are
        leftovers from a server crash and should be re-queued on startup.
        """
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT job_id, type, target_language, status, stage, source_media_path,
                   source_text, source_language FROM jobs WHERE status IN ('processing', 'queued')"""
            ).fetchall()
            return [dict(r) for r in rows]


# Singleton instance
db = Database()
