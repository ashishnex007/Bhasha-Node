"""Persistence and upload safety tests without loading ML models."""
import os
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

_temp = tempfile.TemporaryDirectory()
os.environ["BHASHA_DATA_DIR"] = _temp.name
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles
from db.database import Database, db
from config import OUTPUT_DIR
from routers import jobs
from task_queue.job_worker import JobWorker


class JobPersistenceTests(unittest.TestCase):
    def test_migrates_existing_jobs_without_losing_result(self):
        legacy = Path(_temp.name) / "legacy.db"
        with closing(sqlite3.connect(legacy)) as conn:
            conn.execute("""CREATE TABLE jobs (job_id TEXT PRIMARY KEY, type TEXT NOT NULL,
                target_language TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
                progress INTEGER NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'Queued',
                error TEXT, created_at TEXT NOT NULL, completed_at TEXT, result_json TEXT)""")
            conn.execute("INSERT INTO jobs (job_id,type,target_language,created_at,result_json) VALUES (?,?,?,?,?)",
                         ("old", "video", "hindi", "2026-01-01", '{"video_url":"/old.mp4"}'))
            conn.commit()
        migrated = Database(legacy)
        self.assertEqual(migrated.get_job("old")["result"]["video_url"], "/old.mp4")
        self.assertIn("source_media_path", migrated.get_job("old"))

    def test_job_survives_new_database_instance_and_review(self):
        path = Path(_temp.name) / "fresh.db"
        first = Database(path)
        job_id = first.create_job("video", "marathi", source_filename="field.mp4",
                                  source_media_path="saved/source.mp4", source_media_type="video/mp4")
        first.complete_job(job_id, {"original_text": "source", "translated_text": "target",
                                    "source_url": "/saved/source.mp4", "video_url": "/saved/translated.mp4",
                                    "detected_source_language": "en"})
        reopened = Database(path).get_job(job_id)
        self.assertEqual(reopened["source_language"], "en")
        self.assertEqual(reopened["result"]["source_url"], "/saved/source.mp4")
        self.assertEqual(reopened["result"]["video_url"], "/saved/translated.mp4")
        first.update_translation(job_id, "corrected")
        first.save_quality(job_id, 0.7, "trusted")
        self.assertEqual(Database(path).get_job(job_id)["result"]["translated_text"], "corrected")
        self.assertTrue(first.delete_job(job_id))
        self.assertIsNone(first.get_job(job_id))

    def test_saved_media_uses_current_local_server_port(self):
        app = FastAPI()
        app.include_router(jobs.router)
        job_id = db.create_job("video", "marathi")
        db.complete_job(job_id, {
            "source_url": f"http://127.0.0.1:8766/{job_id}/source.mp4",
            "video_url": f"http://127.0.0.1:8766/{job_id}/translated.mp4",
            "subtitle_url": f"http://127.0.0.1:8766/{job_id}/subtitles.srt",
        })
        result = TestClient(app, base_url="http://127.0.0.1:9001").get(
            f"/api/jobs/{job_id}").json()["result"]
        self.assertEqual(result["source_url"], f"http://127.0.0.1:9001/{job_id}/source.mp4")
        self.assertEqual(result["video_url"], f"http://127.0.0.1:9001/{job_id}/translated.mp4")
        self.assertEqual(result["subtitle_url"], f"http://127.0.0.1:9001/{job_id}/subtitles.srt")

    def test_upload_uses_controlled_job_path(self):
        app = FastAPI()
        app.include_router(jobs.router)
        app.include_router(jobs.capabilities_router)
        app.mount("/", StaticFiles(directory=str(OUTPUT_DIR)), name="static")
        submitted = []
        original_submit = jobs.worker.submit
        jobs.worker.submit = lambda *args, **kwargs: submitted.append((args, kwargs))
        try:
            client = TestClient(app)
            capability = client.get("/api/capabilities")
            self.assertEqual(capability.status_code, 200)
            languages = {entry["key"]: entry for entry in capability.json()["languages"]}
            self.assertTrue({"english", "hindi", "marathi", "tamil", "telugu"} <= languages.keys())
            self.assertTrue(languages["marathi"]["tts"])
            self.assertFalse(languages["tamil"]["tts"])
            unsupported = client.post("/api/jobs/submit/ocr",
                                      data={"target_language": "marathi", "source_language": "ta"},
                                      files={"ocr_file": ("page.png", b"image", "image/png")})
            self.assertEqual(unsupported.status_code, 400)
            self.assertIn("OCR is not available", unsupported.json()["detail"])
            response = client.post("/api/jobs/submit/ocr", data={"target_language": "marathi"},
                                   files={"ocr_file": ("../../field.pdf", b"%PDF-1.4\n", "application/pdf")})
            self.assertEqual(response.status_code, 200)
            saved = db.get_job(response.json()["job_id"])
            self.assertEqual(saved["source_filename"], "field.pdf")
            self.assertTrue((OUTPUT_DIR / saved["source_media_path"]).is_file())
            self.assertEqual(client.get(f"/{saved['source_media_path']}").content, b"%PDF-1.4\n")
            self.assertEqual((OUTPUT_DIR / saved["source_media_path"]).resolve().parent,
                             (OUTPUT_DIR / saved["job_id"]).resolve())
            self.assertEqual(client.get(f"/api/jobs/{saved['job_id']}").status_code, 200)
            self.assertEqual(len(submitted), 1)
            db.complete_job(saved["job_id"], {"original_text": "source", "translated_text": "target",
                                               "detected_source_language": "en",
                                               "source_url": f"/{saved['source_media_path']}"})
            restored = client.get(f"/api/jobs/{saved['job_id']}").json()
            self.assertEqual(restored["result"]["source_url"], f"/{saved['source_media_path']}")
            retried = client.post(f"/api/jobs/{saved['job_id']}/retry",
                                  json={"target_language": "hindi"})
            self.assertEqual(retried.status_code, 200)
            new_job = db.get_job(retried.json()["job_id"])
            self.assertEqual(new_job["target_language"], "hindi")
            self.assertTrue((OUTPUT_DIR / new_job["source_media_path"]).is_file())
        finally:
            jobs.worker.submit = original_submit

    def test_video_result_files_and_source_survive_reopen(self):
        job_id = db.create_job("video", "marathi", source_filename="field.mp4")
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "source.mp4").write_bytes(b"source video")
        db.set_source(job_id, f"{job_id}/source.mp4", "field.mp4", "video/mp4")

        class FakeVideo:
            def process_video(self, **kwargs):
                self.job_id = kwargs["job_id"]
                (OUTPUT_DIR / "rendered.mp4").write_bytes(b"translated video")
                (job_dir / "subtitles.srt").write_text("1\n00:00:00,000 --> 00:00:01,000\nText", encoding="utf-8")
                (job_dir / "subtitles.vtt").write_text("WEBVTT\n", encoding="utf-8")
                return "rendered.mp4", "translated text", "source text", "en"

        worker = JobWorker()
        video = FakeVideo()
        worker._services = {"video": video, "lang_detector": None}
        worker._process_video(job_id, str(job_dir / "source.mp4"), "marathi",
                              {"trans": "mar_Deva", "tts": "mar"})
        self.assertEqual(video.job_id, job_id)
        restored = Database(db.db_path).get_job(job_id)
        self.assertEqual(restored["status"], "complete")
        self.assertEqual(restored["source_language"], "en")
        self.assertTrue(restored["result"]["source_url"].endswith(f"/{job_id}/source.mp4"))
        self.assertTrue(restored["result"]["video_url"].endswith(f"/{job_id}/translated.mp4"))
        self.assertTrue(restored["result"]["subtitle_vtt_url"].endswith(f"/{job_id}/subtitles.vtt"))
        self.assertEqual((job_dir / "source.mp4").read_bytes(), b"source video")
        self.assertEqual((job_dir / "translated.mp4").read_bytes(), b"translated video")

    def test_quality_failure_does_not_change_completed_translation(self):
        app = FastAPI()
        app.include_router(jobs.router)
        job_id = db.create_job("text", "hindi", source_text="Water")
        db.complete_job(job_id, {"original_text": "Water", "translated_text": "पानी"})
        with patch.object(jobs, "INDIC_COMET_CHECKPOINT", Path(_temp.name) / "missing.ckpt"):
            response = TestClient(app).post(f"/api/jobs/{job_id}/evaluate",
                                            json={"reference_text": "जल"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(db.get_job(job_id)["status"], "complete")
        self.assertEqual(db.get_job(job_id)["result"]["translated_text"], "पानी")


if __name__ == "__main__":
    unittest.main()
