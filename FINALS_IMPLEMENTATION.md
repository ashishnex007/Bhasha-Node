# Bhasha Node finals implementation notes

## Repository audit

- Frontend: React/Vite application in `client/src/App.tsx`; existing upload, result, history, knowledge, telemetry, and translation-memory components were present. The earlier result screen used an in-memory object URL for the original video.
- API: FastAPI routers under `server/routers/` expose jobs, inference history, translation memory, system telemetry, and knowledge Q&A. Static output files are served locally by `server/main.py`.
- Processing: `server/task_queue/job_worker.py` runs a single worker thread. Text, audio, OCR, and video use FastText, IndicTrans2, STM corrections, and optional MMS TTS. Video uses FFmpeg, Faster-Whisper, subtitles, and a per-job intermediate cache. Qwen is used only by the knowledge router.
- Persistence: `server/db/database.py` already held SQLite jobs with `result_json`, inference history, and STM terms. Jobs lacked durable source media and source-language metadata; audio, OCR, and video jobs deleted their upload after success. History reconstructed an incomplete result from the inference table.
- Output naming: old files mostly included an eight-character job token, but lived together at the output root. Video SRT lived in an intermediate directory that was removed after success.
- Launch: the old launcher required a fixed checkout path, a venv, Node, and the Vite development server. OCR and FFmpeg paths were hardcoded or resolved through PATH.
- Tests: no automated tests covered job migration, persistent media, or job retrieval.

## Implemented

- The existing jobs table is migrated in place with source filename/path/type, source language, source text for restart recovery, and update time. New jobs use UUIDs. Uploads use controlled filenames under `outputs/<job_id>/` and are retained for later review.
- The video worker moves the translated video into its job directory and preserves `.srt` and `.vtt` before deleting intermediates. The saved job holds source and output URLs, language, status, text, and subtitle URLs. Audio and OCR keep their original files too.
- `GET /api/jobs/{job_id}` now provides a complete result. `GET /api/jobs` lists saved jobs. `DELETE /api/jobs/{job_id}` removes completed or failed jobs and per-job files. `POST /api/jobs/{job_id}/retry` creates a new job from saved source content. `PATCH /api/jobs/{job_id}/result` saves a human correction. Existing submission and inference-history routes remain.
- `GET /api/capabilities` exposes translation, TTS, and OCR support from the Python language registry; `POST /api/languages/detect` exposes local FastText output. The UI obtains its language choices from this API. Only the three configured languages are advertised.
- FastText now loads the bundled `server/models/lid.176.bin` directly; language detection no longer invokes a package path that can download a missing model. The offline installer bundles and validates the model.
- The home screen presents text, document, audio, and video tasks. The result component displays source and target side by side, including local PDF/image/audio/video previews. History opens the full job. Job IDs in the URL restore results after reload and browser restart. System telemetry and model details are on the System page.
- Optional reference-based IndicCOMET evaluation has a separate local process and a configurable process-tree memory guard (16 GiB by default, adjustable through `BHASHA_QUALITY_MEMORY_LIMIT_GB`). It persists a score only on success and keeps the completed translation if evaluation fails. This checkout does not include the checkpoint or `comet` package; evaluation therefore reports unavailable rather than fabricating a score.
- Model loaders are local-only. Hugging Face offline environment flags are set at runtime. Translation directions and TTS voices are loaded on demand and the inactive models are released. Qwen remains knowledge-only, loads on first Q&A request, and unloads after five minutes idle.
- A production frontend build can be served at `/app/` by the local FastAPI process. The launcher no longer requires Node for end users. An Inno Setup recipe, offline bundle builder, and first-launch validation script are included.
- The output directory is created before voice synthesis for text jobs. The API client uses the current server origin in production, so packaged deployments can use a configured local port.

## Workstation measurements

- Sequential CPU benchmark: text 1.45 seconds / 1.787 GiB peak; OCR 19.03 seconds / 2.011 GiB; ASR 26.33 seconds / 2.023 GiB; TTS 1.8 seconds / 1.99 GiB.
- Fresh video pipeline after the Windows FFmpeg path fix: 16.33 seconds / 2.175 GiB peak / 30.5% of machine CPU.
- Qwen Q&A: 51.04 seconds / 5.303 GiB peak when run alone; 53.45 seconds / 6.684 GiB in the sequential mixed-model run. The demo device has 48 GiB RAM, and Qwen remains lazy with idle unloading.
- IndicCOMET cannot be measured until its local package and checkpoint are supplied. No score is shown when unavailable.

## Remaining release gates

- Supply a relocatable Windows Python runtime with installed dependencies, local FFmpeg/Poppler/Tesseract assets, all model cache snapshots, and the IndicCOMET checkpoint/package. The COMET files must be laid out as `server/models/indic-comet/checkpoints/model.ckpt` and `server/models/indic-comet/hparams.yaml`, with the checkpoint's encoder weights in the offline model cache. Run `installer/build_offline.ps1` with those assets and Inno Setup 6 to produce `BhashaNode-Setup.exe`. No installer executable was built from this checkout.
- Validate installation, shortcut launch, first run, and uninstall on clean Windows 10/11 machines.
- Benchmark the final packaged build on target hardware. The repository benchmark uses current workstation models; the IndicCOMET path cannot be measured until its checkpoint is installed.
- Exercise every full API pipeline and review screen against the final packaged build. Existing historical media jobs whose uploads were already deleted cannot regain their original preview.

## Local verification commands

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run build
& '.\server\venv\Scripts\python.exe' -m unittest discover -s tests -p test_persistence.py -v
& '.\server\venv\Scripts\python.exe' .\server\benchmark_finals.py --full
```
