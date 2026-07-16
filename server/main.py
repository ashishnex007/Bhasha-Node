import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from services.translation_engine import TranslationService
from services.tts_engine import TTSService
from services.asr_engine import ASRService
from services.video_engine import VideoService

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
print("--- INITIALIZING TRANSLATION SERVICE...")
translator = TranslationService()
print("INITIALIZED TRANSLATION SERVICE.")
print("--- INITIALIZING TTS SERVICE...")
tts = TTSService()
print("INITIALIZED TTS SERVICE.")
print("--- INITIALIZING ASR SERVICE...")
asr = ASRService()
print("INITIALIZED ASR SERVICE.")
print("--- INITIALIZING VIDEO SERVICE...")
video_engine = VideoService(asr=asr, translator=translator, tts=tts)
print("INITIALIZED VIDEO SERVICE.")
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

@app.post("/process-video")
async def process_video_pipeline(
    target_language: str = Form(...),  # FIX: Explicitly mark this as Form data
    video_file: UploadFile = File(...)
):
    lang_map = {
        "marathi": {"trans": "mar_Deva", "tts": "mar"},
        "hindi": {"trans": "hin_Deva", "tts": "hin"}
    }
    
    config = lang_map.get(target_language.lower())
    if not config:
        return {"error": "Unsupported language"}

    # Save uploaded video to disk
    input_path = f"temp_input_{video_file.filename}"
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(video_file.file, buffer)

    try:
        # Run the synchronous pipeline
        output_video_path, translated_script = video_engine.process_video(
            input_video=input_path,
            target_lang_code=config["trans"],
            tts_lang_code=config["tts"]
        )

        return {
            "status": "success",
            "translated_text": translated_script,
            "video_url": f"http://127.0.0.1:8000/{output_video_path}"
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        # Cleanup the raw upload
        if os.path.exists(input_path): os.remove(input_path)

# Serve static audio files
app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)