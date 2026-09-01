# 🌾 BHASHA NODE — The Ultimate Demo Readiness, Installation & Pitch Guide

> **Enterprise Offline Multimodal AI & Agricultural Knowledge Assistant for Rural India**  
> *100% Air-Gapped • CPU Optimized • Zero Cloud Dependency • Multilingual Voice & Vision*

---

## 📋 Table of Contents
1. [🛠️ System Prerequisites & Software Installation](#1-system-prerequisites--software-installation)
2. [📦 Model Assets & Environment Setup](#2-model-assets--environment-setup)
3. [🚀 Step-by-Step Build & Run Instructions](#3-step-by-step-build--run-instructions)
4. [✨ Comprehensive Feature Showcase](#4-comprehensive-feature-showcase)
5. [🎬 The "Perfect Demo" Presentation Script (7-Minute Flow)](#5-the-perfect-demo-presentation-script-7-minute-flow)
6. [🛡️ Offline Architecture & Resilience Highlights](#6-offline-architecture--resilience-highlights)
7. [💡 Judge Q&A & Pitch Defense Cheat Sheet](#7-judge-qa--pitch-defense-cheat-sheet)

---

## 1. 🛠️ System Prerequisites & Software Installation

Follow this sequence to set up any fresh Windows machine for the demo.

### 1.1 Core Runtimes & Dependencies

| Tool | Purpose | Download / Command | Destination / PATH |
| :--- | :--- | :--- | :--- |
| **Python 3.11.x** | Backend Runtime | [Python 3.11.0 64-bit Installer](https://www.python.org/downloads/release/python-3110/) | Check `Add python.exe to PATH` during install |
| **Node.js (LTS)** | Frontend Runtime (Vite/React) | [Node.js Official Download](https://nodejs.org/en/download) | Standard Installer (adds `node` & `npm` to PATH) |
| **Visual C++ 2015-2022 x64** | C++ Runtimes (for `llama-cpp-python`, PyTorch, etc.) | [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) | Run installer and reboot if prompted |
| **FFmpeg** | Video/Audio Slicing, Subtitles, Concatenation | Run in PowerShell:<br>`winget install "FFmpeg (Essentials Build)"`<br>or [Gyan.dev FFmpeg Builds](https://www.gyan.dev/ffmpeg/builds/) | Ensure `ffmpeg.exe` and `ffprobe.exe` are in System `PATH` |
https://share.google/aimode/8ZBgJetTgdAiPw9OT
| **Tesseract OCR (5.5.x)** | Multilingual Document & Image OCR | [Tesseract 64-bit Windows Installer](https://sourceforge.net/projects/tesseract-ocr.mirror/files/5.5.3/tesseract-ocr-w64-setup-5.5.3.20260724.exe/download) | Default path: `C:\Program Files\Tesseract-OCR` *(Select Hindi & Marathi language packs during install)* |
| **Poppler for Windows** | PDF page rendering for OCR | [Poppler Windows Releases (v24.08.0)](https://github.com/oschwartz10612/poppler-windows/releases/tag/v24.08.0-0) | Extract and place `bin` folder at: `C:\Program Files\poppler\bin` |

### 1.2 Verification Commands
Run these in a fresh PowerShell window to confirm your system tools are accessible:
```powershell
python --version       # Expected: Python 3.11.x
node -v                # Expected: v18+ or v20+
ffmpeg -version        # Expected: ffmpeg version 6.x / 7.x
tesseract --version    # Expected: tesseract v5.x
```

---

## 2. 📦 Model Assets & Environment Setup

### 2.1 Hugging Face Token Configuration
Create or verify `.env` in `server/`:
```ini
# server/.env
HF_TOKEN=your_huggingface_read_token_here
```
*(Used on first boot to download IndicTrans2 and Meta MMS TTS weights into local cache).*

### 2.2 Local LLM GGUF Model Placement
1. Download **Qwen3-4B Q4_K_M GGUF** from HuggingFace:  
   👉 [Qwen/Qwen3-4B-GGUF Repository](https://huggingface.co/Qwen/Qwen3-4B-GGUF/tree/main)  
   *(File: `Qwen3-4B-Q4_K_M.gguf` ~2.5 GB)*
2. Place the downloaded `.gguf` file in:
   ```
   c:\Projects\pers\baif\server\models\Qwen3-4B-Q4_K_M.gguf
   ```

### 2.3 Directory Structure Checklist
Ensure the following directories exist under `server/`:
```
server/
├── data/              # SQLite DB & FAISS indices (kb.faiss, kb_meta.json)
├── models/            # Qwen3-4B-Q4_K_M.gguf, lid.176.ftz, embeddings cache
├── outputs/           # Generated audio, SRTs, processed videos, temp cache
└── .env               # HF_TOKEN configured
```

---

## 3. 🚀 Step-by-Step Build & Run Instructions

### Step A: Setup & Launch Backend Server
Open **Terminal 1** (PowerShell) in project root:
```powershell
cd c:\Projects\pers\baif\server

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install backend Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Launch the AI Core Server
python main.py
```
> 🟢 **Backend will boot and display:**
> ```text
> ============================================================
>   BHASHA NODE v2.0 — INITIALIZING AI CORE
> ============================================================
> [1/7] Loading Translation Service (IndicTrans2)...
> [2/7] Loading TTS Service (Meta MMS VITS mar/hin)...
> [3/7] Loading ASR Service (Faster-Whisper INT8 Small)...
> [4/7] Loading STM (Word Dictionary) & System Telemetry...
> [5/7] Loading Video Service (FFmpeg pipeline)...
> [6/7] Loading OCR Service (Tesseract)...
> [7/7] Loading Language Detection Service (fastText LID)...
> [8/8] Initializing Agricultural Knowledge Assistant (FAISS & Lazy Qwen3-4B)...
> ============================================================
>   AI CORE READY — Multimodal Pipelines & Knowledge Base active
> ============================================================
> Uvicorn running on http://127.0.0.1:8000
> ```

### Step B: Setup & Launch Frontend Client
Open **Terminal 2** (PowerShell):
```powershell
cd c:\Projects\pers\baif\client

# 1. Install frontend dependencies
npm install

# 2. Launch Vite dev server
npm run dev
```
> 🌐 **Frontend UI will be live at:** [http://localhost:5173](http://localhost:5173)

---

## 4. ✨ Comprehensive Feature Showcase

Bhasha Node is structured into two core AI modalities: **Multimodal Media Ingestion** and the **Agricultural Knowledge Assistant (RAG)**.

```
                         ┌──────────────────────────────────────────────────────────┐
                         │                  BHASHA NODE ARCHITECTURE                │
                         └──────────────────────────────────────────────────────────┘
                                                       │
                   ┌───────────────────────────────────┴───────────────────────────────────┐
                   ▼                                                                       ▼
   ┌───────────────────────────────┐                                       ┌───────────────────────────────┐
   │    MULTIMODAL INGESTION       │                                       │  KNOWLEDGE ASSISTANT (RAG)    │
   ├───────────────────────────────┤                                       ├───────────────────────────────┤
   │ • Text Translation            │                                       │ • Semantic Search (FAISS)     │
   │ • Voice Ingestion (Whisper)   │                                       │ • Offline LLM (Qwen3-4B GGUF) │
   │ • Video Dubbing & Subtitles   │                                       │ • Direct Marathi/Hindi Output │
   │ • Document & Scanned OCR      │                                       │ • AI Reasoning Trace (Think)  │
   │ • STM Glossary Tuning         │                                       │ • Verified Grounded Sources   │
   │ • Resumable Layer Caching     │                                       │ • Voice In / Voice Out (TTS)  │
   └───────────────────────────────┘                                       └───────────────────────────────┘
                   │                                                                       │
                   └───────────────────────────────────┬───────────────────────────────────┘
                                                       ▼
                                     ┌───────────────────────────────────┐
                                     │     100% OFFLINE LOCAL CPU        │
                                     │  Telemetry • SQLite • MMS • ASR   │
                                     └───────────────────────────────────┘
```

### Feature Matrix

| Category | Capability | Technology Stack | Key Highlights |
| :--- | :--- | :--- | :--- |
| 🎙️ **Speech-to-Text (ASR)** | Voice input & Audio file transcription | Faster-Whisper (INT8 quantized `small`) | Real-time mic recording, high accuracy on rural accents, silence filtering (VAD). |
| 🌐 **Neural Translation** | Script-aware Indic Translation | IndicTrans2 (200M/320M distilled) | Auto-routes between EN↔Indic and Indic↔Indic; handles complex agricultural terms. |
| 🗣️ **Voice Synthesis (TTS)** | Native Rural Voiceovers | Meta MMS VITS (`mar`, `hin`) | High naturalness, offline neural voice generation, sentence-chunked for zero OOM risk. |
| 🎥 **Video Dubbing & SRT** | End-to-End Multilingual Video Pipeline | FFmpeg + Whisper Timestamps + MMS VITS | Auto-generates burned subtitles and dubbed audio; side-by-side synchronized player. |
| 📄 **Document OCR** | Scanned PDF & Image Text Extraction | Tesseract 5.5 + Poppler Windows + Pillow | Dual-script OCR (Devanagari + Latin), multi-page PDF processing with instant translation. |
| 🧠 **Agricultural RAG** | Offline LLM Grounded Question Answering | FAISS IP Cosine + Qwen3-4B Q4_K_M GGUF | Strict grounding in indexed docs, anti-hallucination defense, direct Indic generation. |
| 🔍 **AI Reasoning Trace** | Transparent LLM Thought Process | `<think>` block parser + Violet Accordion | Displays internal chain-of-thought in an expandable badge without cluttering the answer. |
| 📚 **Domain Dictionary (STM)**| Custom Agricultural Glossary Tuning | SQLite STM Oracle + Substring Replacer | Allows agronomists to correct dialect terms (e.g. *बोंडअळी*, *मूरघास*, *सूक्ष्म सिंचन*). |
| 💾 **Resumable Layer Cache** | Crash-Proof Multistep Processing | 5-Layer Job Checkpoints (`outputs/cache/`) | L1 Audio, L2 Segments, L3 SRT, L4 TTS, L5 Video. Re-runs resume instantly from last state. |
| 📊 **System Telemetry** | Hardware Monitoring | `psutil` Real-Time Dashboard | Live RAM (GB used/total), CPU %, Disk usage %, model residency status. |
| 🎨 **Rural-Centric UI/UX** | Farmer & Field Worker Accessibility | React, TailwindCSS, Lucide, Dark/Light Mode | High-contrast UI, one-click audio playback, full UI translation in English, हिन्दी, & मराठी. |

---

## 5. 🎬 The "Perfect Demo" Presentation Script (7-Minute Flow)

### ⏱️ Minute 0:00 – 1:00 | The Problem & The Offline Node Vision
> *"Good morning judges/team. Over 70% of Indian farmers rely on agricultural advice delivered in English or high-resource languages, but field extension workers in rural areas operate in zero-connectivity or low-bandwidth conditions."*
> 
> *"Meet **Bhasha Node** — an enterprise-grade, 100% offline, air-gapped multimodal AI station running entirely on commodity CPU hardware. No cloud, no API keys, zero subscription costs, and complete data privacy."*

---

### ⏱️ Minute 1:00 – 2:30 | Ingestion: Video Dubbing & Document OCR
1. **Show Hardware Telemetry:** Point out the top bar — RAM and CPU metrics are updating live.
2. **Demo Video Translation:**
   - Click **Ingest Media** ➔ Select **Video** ➔ Choose **Hindi (हिन्दी)** as target language.
   - Upload a sample 30-second farming video (e.g. drip irrigation or cattle care).
   - Watch the live progress bar: *Extracting Audio ➔ Transcribing (Whisper) ➔ Translating (IndicTrans2) ➔ Building SRT ➔ Synthesizing Voice (MMS) ➔ Remuxing Video*.
   - **Show Result:** Play the generated video. Point out the **synchronized Marathi/Hindi voiceover** and **burned subtitles**.
   - Show the **Side-by-Side original vs translated player**.
3. **Demo Scanned Document OCR:**
   - Upload an image or PDF of an agricultural flyer.
   - Show how Tesseract extracts Devanagari/English text and immediately translates and generates audio narration.

---

### ⏱️ Minute 2:30 – 3:30 | Domain Dictionary / STM (The "Secret Weapon")
> *"Standard AI translation often butchers hyper-local farming terms. Bhasha Node includes a Domain Short-Term Memory (STM) dictionary."*
- Click **Terminology Dictionary** (STM) in the top header.
- Show an existing agricultural term: `Cash Crop ➔ नगदी पीक (Marathi) / नकदी फसल (Hindi)`.
- Add a new custom rule live in 5 seconds (e.g. `pink bollworm ➔ गुलाबी बोंडअळी`).
- Re-run a quick text translation to show the instant domain override in action.

---

### ⏱️ Minute 3:30 – 5:30 | Agricultural Knowledge Assistant (RAG with Local Qwen3-4B)
> *"Now, the crown jewel: Bhasha Node doesn't just translate — it understands and reasons over all processed documents."*
1. **Switch to 'Knowledge Assistant' Tab:**
   - Point out the **FAISS chunk counter** showing indexed agricultural knowledge.
2. **Ask a Query in Hindi via Mic or Text:**
   - Query: `नकदी फसल क्या है और इसके क्या फायदे हैं?` *(What is a cash crop and what are its benefits?)*
   - Hit **Send**.
3. **Showcase the 3 Breakthrough UX Features:**
   - **Direct Indic Generation:** Notice Qwen3-4B generated Hindi directly in ~40-50s without needing a separate 2-minute back-translation.
   - **AI Reasoning Trace Accordion:** Click on **🧠 AI Reasoning Trace [internal]** to expand the `<think>` block — show how the LLM reasoned over Source 1, Source 2, and rejected ungrounded facts.
   - **Verified Grounded Sources:** Click **📖 Verified Grounded Sources** to show exact matching chunks and percentage similarity scores from the FAISS database.
   - **One-Click Voice Audio:** Click **🔊 Listen Voice** to hear natural Meta MMS VITS Marathi/Hindi narration of the answer.

---

### ⏱️ Minute 5:30 – 6:30 | Offline Resilience & Crash Recovery
> *"In rural areas, power cuts and machine restarts happen frequently. Watch what happens under failure conditions."*
- Explain the **5-Layer Per-Job Caching system**:
  - Show `outputs/cache_{job_id}/`: L1 Audio, L2 Whisper Segments, L3 SRT/Translations, L4 TTS, L5 Video.
  - If a job is interrupted during video rendering, re-submitting skips transcription & translation instantly, saving 10+ minutes of compute.
  - Sentence-chunked TTS ensures no out-of-memory crashes on long audio/video files.

---

### ⏱️ Minute 6:30 – 7:00 | Conclusion & Impact
> *"Bhasha Node turns any standard desktop or laptop into an autonomous AI center for Krishi Vigyan Kendras (KVKs), veterinary outposts, and rural extension offices. Thank you!"*

---

## 6. 🛡️ Offline Architecture & Resilience Highlights

```
+------------------------------------------------------------------------------------+
|                                BHASHA NODE AI STACK                                |
+------------------------------------------------------------------------------------+
| Task                   | Model / Engine                           | Execution      |
+------------------------+------------------------------------------+----------------+
| Speech Recognition     | Faster-Whisper (INT8 Small)              | Local CPU      |
| Translation            | IndicTrans2 Distilled (200M / 320M)      | Local CPU      |
| Voice Synthesis        | Meta MMS VITS (Hindi, Marathi)           | Local CPU      |
| OCR                    | Tesseract 5.5 + Poppler                  | Local Windows  |
| Language Detection     | Meta FastText lid.176.ftz                | Local CPU      |
| Semantic Search        | FAISS IP Flat + MiniLM-L6-v2 Embeddings  | Local CPU      |
| Grounded Reasoning     | Qwen3-4B-Q4_K_M GGUF                     | Local CPU GGUF |
| Persistence & Queue    | SQLite WAL + Python Background Thread    | Zero External  |
+------------------------------------------------------------------------------------+
```

### Why Bhasha Node is Robust:
1. **Zero External Network Calls:** Works in complete airplane mode or military-grade air-gapped environments.
2. **Chunked TTS Engine:** Prevents VITS token-overflow by segmenting long text at sentence boundaries (`।`, `.`, `?`) and assembling via FFmpeg concat.
3. **Direct Devanagari LLM Prompting:** System prompt enforces target script output, eliminating ~120s translation latency and ~1GB peak RAM overhead.
4. **Memory-Conscious Lazy Loading:** LLM and specialized translation models load only on demand to prevent system starvation on 8GB/16GB RAM machines.

---

## 7. 💡 Judge Q&A & Pitch Defense Cheat Sheet

| Question | Winning Answer |
| :--- | :--- |
| **Q: Why not use OpenAI Whisper / GPT-4 via API?** | *"APIs require uninterrupted broadband, cost per token, and send sensitive rural health/agricultural data outside. Bhasha Node is designed for remote KVKs with zero connectivity and zero running costs."* |
| **Q: How do you prevent hallucinations in agricultural advice?** | *"We enforce strict FAISS RAG grounding. If the indexed documents don't contain the dosage or cure, Qwen3-4B is constrained by operational prompt rules to explicitly refuse rather than guess."* |
| **Q: What hardware is required to run this?** | *"Any standard x86-64 PC with 16GB RAM and a quad-core Intel i5/i7 or AMD Ryzen CPU. No dedicated GPU is required due to 4-bit GGUF and INT8 quantization."* |
| **Q: Can more languages be added?** | *"Yes. IndicTrans2 and Meta MMS support 22 scheduled Indian languages (Telugu, Tamil, Bengali, Kannada, Gujarati, Punjabi, etc.). Expanding requires simply registering the language code in `config.py`."* |
| **Q: How does the farmer interact if they cannot read?** | *"Every modality supports voice-in (mic recording via Whisper) and voice-out (Meta MMS VITS narration) with high-contrast, icon-driven UI design."* |

---
*Created for BAIF / Bhasha Node Demo & Deployment • 100% Offline AI Ecosystem*
