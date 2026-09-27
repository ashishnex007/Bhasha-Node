"""Manual offline API smoke test for the four user workflows.

Run from the repository root with the project's Python environment.
Uses temporary user data and leaves the repository database untouched.
"""
import os
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo / "server"))


def wait_for(client, job_id: str, timeout: int = 240):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = client.get(f"/api/jobs/{job_id}")
        response.raise_for_status()
        job = response.json()
        if job["status"] in ("complete", "error"):
            return job
        time.sleep(0.5)
    raise TimeoutError(f"Job {job_id} did not finish within {timeout} seconds")


def submit_file(client, kind: str, path: Path, target: str):
    with path.open("rb") as source:
        response = client.post(f"/api/jobs/submit/{kind}",
                               data={"target_language": target},
                               files={f"{kind if kind != 'ocr' else 'ocr'}_file":
                                      (path.name, source, "application/octet-stream")})
    response.raise_for_status()
    return response.json()["job_id"]


def verify_media(client, job, keys):
    for key in keys:
        url = job["result"].get(key)
        assert url, f"{job['type']} is missing {key}"
        response = client.get(urlparse(url).path)
        assert response.status_code == 200 and response.content, f"{key} could not be reopened"


def main():
    with tempfile.TemporaryDirectory(prefix="bhasha-finals-smoke-") as data_root:
        os.environ["BHASHA_DATA_DIR"] = data_root
        os.environ["BHASHA_PORT"] = "8765"
        from PIL import Image, ImageDraw, ImageFont
        page = Image.new("RGB", (1200, 300), "white")
        drawer = ImageDraw.Draw(page)
        font = ImageFont.truetype("arial.ttf", 48)
        drawer.text((45, 90), "Farmers need clean water.", fill="black", font=font)
        small_pdf = Path(data_root) / "short-document.pdf"
        page.save(small_pdf, "PDF")
        from fastapi.testclient import TestClient
        from main import app

        with TestClient(app) as client:
            print("Capabilities:", client.get("/api/capabilities").json(), flush=True)
            cases = [
                ("text", None, "marathi"),
                ("ocr", small_pdf, "marathi"),
                ("audio", repo / "files" / "Audio" / "output_hindi.wav", "english"),
                ("video", repo / "files" / "Video" / "test_short.mp4", "marathi"),
            ]
            for kind, path, target in cases:
                if kind == "text":
                    response = client.post("/api/jobs/submit/text", json={
                        "text": "Farmers need clean water for their crops.",
                        "source_language": "en", "target_language": target})
                    response.raise_for_status()
                    job_id = response.json()["job_id"]
                else:
                    job_id = submit_file(client, kind, path, target)
                job = wait_for(client, job_id)
                print(f"{kind}: {job['status']} / {job.get('stage')} / {job.get('error')}", flush=True)
                assert job["status"] == "complete", job
                assert job["result"]["original_text"]
                assert job["result"]["translated_text"]
                assert job["source_language"]
                if kind == "ocr":
                    verify_media(client, job, ["source_url", "audio_url"])
                elif kind == "audio":
                    verify_media(client, job, ["source_url", "audio_url"])
                elif kind == "video":
                    verify_media(client, job, ["source_url", "video_url", "subtitle_url", "subtitle_vtt_url"])
                else:
                    verify_media(client, job, ["audio_url"])
                print(f"{kind} result and media reopened: {job_id}", flush=True)
            history = client.get("/api/jobs").json()["items"]
            assert len(history) == len(cases)
            print("Four completed jobs persisted in API history.", flush=True)


if __name__ == "__main__":
    main()
