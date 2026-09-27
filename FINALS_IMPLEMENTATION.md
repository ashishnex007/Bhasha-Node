# Bhasha Node finals implementation notes

## Baseline audit

The existing application uses React/Vite/Tailwind, FastAPI, a single background worker, SQLite jobs and inference history, IndicTrans2, Faster-Whisper, Tesseract/Poppler, MMS TTS, FFmpeg, FastText, FAISS/Sentence-Transformers, and lazy Qwen for knowledge-base answers. The baseline deleted successful uploads and relied on a browser object URL for original video, so media vanished when a result was reopened. Baseline frontend build and persistence tests failed; startup also attempted Hugging Face login despite local models.

## Changes

- Extended the existing SQLite jobs table with source media, source language, text, and update metadata. Saved uploads, outputs, and video subtitles live under a job-specific output directory. Completed results can be loaded by job ID from the API, history, or `?job=` after browser refresh. The API rewrites saved local media URLs to the current server origin when it returns a result.
- Kept the existing UI and icons. The result cards now compare source media/text with translated media/text, display source and target languages, and show a local quality-evaluation control. Recording and processing indicators remain in place. History labels have English, Hindi, and Marathi translations.
- Centralized 23 translation language definitions in `server/config.py`. Only English, Hindi, and Marathi advertise the installed OCR and TTS capabilities. The frontend reads `/api/capabilities`, FastText detects typed text through `/api/languages/detect`, and users can override the source language. OCR rejects a source without an installed OCR pack; video and audio targets require a TTS voice in the UI.
- Preserved the FAISS index and Sentence-Transformers embedder. Qwen is used only for knowledge-base Q&A and stays unloaded during translation; it unloads after five minutes idle.
- Added reference-based IndicCOMET evaluation in a one-shot subprocess. A failed or unavailable metric never changes a completed translation. The official IndicCOMET checkpoint and `comet` package are not in this checkout. The official checkpoint URLs currently return HTTP 403, so no real IndicCOMET score has been verified. The installer reports quality evaluation as unavailable while keeping translation operational.
- Built a standalone local Python runtime with the official CPU PyTorch wheel and app-local FFmpeg, Poppler, Tesseract, language packs, and model cache snapshots. The Inno Setup build produced `installer/release-final/BhashaNode-Setup.exe` and the required `BhashaNode-Setup-1.bin` data file. Keep both in the same folder when installing. The installer recipe defines Start Menu and desktop shortcuts; the bundled launcher started FastAPI and opened the browser in a workstation test. Shortcut creation still needs a clean installation test.

## Verification on this workstation

- `npm run build` passed. `python -m unittest discover -s tests -p test_persistence.py -v` passed all six tests with `server/venv/Scripts/python.exe`.
- The bundled runtime started FastAPI and served `/app/`. Live bundled text to Hindi and English, image OCR to Marathi, and video to Marathi completed. The original and translated videos and subtitles reopened through HTTP. A browser reload restored both video players; history reopened saved results. A saved video made on port 8766 also reopened on port 8000 after restart.
- Earlier temporary-data API smoke testing completed text to Marathi, PDF OCR to Marathi, audio to English, and video to Marathi, including persisted media URLs.
- FastText detected a Hindi sentence as `hi` with score 0.997. The bundled knowledge base loaded 150 FAISS chunks from 26 documents and Qwen remained unloaded after normal translations. A bundled Q&A request loaded Qwen and retrieved five source chunks. The current bundle Q&A response latency was about 53 seconds for its first query.
- IndicCOMET failure behavior passed an API unit test. A real IndicCOMET score, microphone recording, actual shortcut installation, and uninstall have not been verified here. A clean installation needs more free disk space than was available after staging the 8.14 GiB bundle and 8.14 GiB setup data file.

## Rebuilding the installer

Build the frontend, then run `installer/build_offline.ps1` with paths for a standalone Python 3.13 base, the app's tested `site-packages`, the official `torch-2.12.0+cpu` Windows wheel, FFmpeg/Poppler/Tesseract binary directories, the local Hugging Face hub cache, and Inno Setup 6's `ISCC.exe`. The script validates the portable runtime before compiling. If an IndicCOMET checkpoint is later available, place it at `server/models/indic-comet/checkpoints/model.ckpt` with its `hparams.yaml` one directory above and install `unbabel-comet` in the bundled Python runtime before building.
