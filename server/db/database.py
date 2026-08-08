"""
Bhasha Node - SQLite Persistence Layer
Manages jobs, inference history, and STM dictionary terms.
Thread-safe via check_same_thread=False.
"""
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager
from config import DB_PATH


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self):
        self.db_path = str(DB_PATH)
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

    # ==========================================
    # JOBS
    # ==========================================
    def create_job(self, job_type: str, target_language: str) -> str:
        job_id = str(uuid.uuid4())[:8]
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO jobs (job_id, type, target_language, created_at) VALUES (?, ?, ?, ?)",
                (job_id, job_type, target_language, _now_iso()),
            )
        return job_id

    def update_job_progress(self, job_id: str, progress: int, stage: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET progress=?, stage=?, status='processing' WHERE job_id=?",
                (progress, stage, job_id),
            )

    def complete_job(self, job_id: str, result: dict):
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET status='complete', progress=100, stage='Complete', completed_at=?, result_json=? WHERE job_id=?",
                (_now_iso(), json.dumps(result, ensure_ascii=False), job_id),
            )

    def fail_job(self, job_id: str, error: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET status='error', stage='Failed', error=?, completed_at=? WHERE job_id=?",
                (error, _now_iso(), job_id),
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


# Singleton instance
db = Database()
