# ==========================================
# BHASHA NODE - Multi-Stage Air-Gapped Container
# Includes: FFmpeg, Tesseract (Devanagari), Python 3.11,
#           PyTorch CPU, HuggingFace models, FastAPI/Uvicorn
# ==========================================

# ---- Stage 1: Build the React frontend ----
FROM node:20-slim AS frontend-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --ignore-scripts
COPY client/ ./
RUN npm run build

# ---- Stage 2: Production Python server ----
FROM python:3.11-slim-bookworm

# System dependencies: FFmpeg + Tesseract OCR (Devanagari packs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-mar \
    tesseract-ocr-hin \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy server source
COPY server/ ./

# Copy pre-built frontend (for serving static assets)
COPY --from=frontend-builder /app/client/dist /app/client/dist

# Ensure output and data directories exist
RUN mkdir -p outputs data

# Expose port
EXPOSE 8000

# Pre-download models at build time (optional — uncomment for full air-gap)
# RUN python -c "from services.asr_engine import ASRService; ASRService()"
# RUN python -c "from services.translation_engine import TranslationService; TranslationService()"
# RUN python -c "from services.tts_engine import TTSService; TTSService()"

# Start server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
