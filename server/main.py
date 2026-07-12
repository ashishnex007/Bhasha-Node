from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os

from services.translation_engine import TranslationService
from services.tts_engine import TTSService

app = FastAPI(title="BAIF Offline AI Engine")

# FIX: Explicitly list localhost and 127.0.0.1 ports instead of using a wildcard "*"
# This satisfies modern browser credential constraints perfectly.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("--- INITIALIZING AI CORE ---")
translator = TranslationService()
tts = TTSService()
print("--- CORE READY ---")

class ProcessingRequest(BaseModel):
    text: str
    target_language: str

@app.post("/process-text")
async def process_text_pipeline(request: ProcessingRequest):
    lang_map = {
        "marathi": {"trans": "mar_Deva", "tts": "mar"},
        "hindi": {"trans": "hin_Deva", "tts": "hin"}
    }
    
    config = lang_map.get(request.target_language.lower())
    if not config:
        return {"error": "Unsupported language"}

    translated_text = translator.translate(request.text, target_lang=config["trans"])
    output_filename = f"output_{request.target_language}.wav"
    tts.generate_voice(translated_text, lang_code=config["tts"], output_file=output_filename)
    
    return {
        "status": "success",
        "original_text": request.text,
        "translated_text": translated_text,
        "audio_url": f"http://127.0.0.1:8000/{output_filename}"
    }

# Serve static audio files
app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)