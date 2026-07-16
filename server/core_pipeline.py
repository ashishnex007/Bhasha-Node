import os
from dotenv import load_dotenv
load_dotenv()   # loads .env

import time
import torch
import soundfile as sf
from faster_whisper import WhisperModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, VitsModel, AutoTokenizer as VitsTokenizer
from huggingface_hub import login

# ==========================================
# 1. INITIALIZATION & HARDWARE ALLOCATION
# ==========================================
print("[SYSTEM] Booting Offline ML Pipeline on CPU...")

print("[SYSTEM] Logging into HuggingFace Hub...")

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN not found in environment")

login(token=HF_TOKEN)

# ASR: Faster Whisper (8-bit Quantized)
print("[LOAD] Loading ASR (Faster-Whisper INT8)...")
asr_model = WhisperModel("small", device="cpu", compute_type="int8")

# Translation: IndicTrans2 (Distilled 200M version for CPU safety)
print("[LOAD] Loading Translation Engine (IndicTrans2)...")
trans_model_name = "ai4bharat/indictrans2-en-indic-dist-200M"
# FIX: Removed force_download=True so it loads instantly from your local cache
trans_tokenizer = AutoTokenizer.from_pretrained(trans_model_name, trust_remote_code=True)
trans_model = AutoModelForSeq2SeqLM.from_pretrained(trans_model_name, trust_remote_code=True)

# TTS: Offline Marathi Voice
print("[LOAD] Loading TTS (Marathi)...")
tts_model_name = "facebook/mms-tts-mar"
tts_tokenizer = VitsTokenizer.from_pretrained(tts_model_name)
tts_model = VitsModel.from_pretrained(tts_model_name)

print("[SYSTEM] All models loaded successfully into local memory.\n")

# ==========================================
# 2. EXECUTION FUNCTIONS
# ==========================================

def process_audio(audio_path):
    """Step 1: Extract text from audio"""
    start_time = time.time()
    print(f"-> Transcribing {audio_path}...")
    
    segments, info = asr_model.transcribe(audio_path, beam_size=5)
    transcription = " ".join([segment.text for segment in segments])
    
    print(f"[SUCCESS] Transcription done in {time.time() - start_time:.2f}s")
    return transcription

def translate_text(text, src_lang="eng_Latn", target_lang="mar_Deva"):
    """Step 2: Translate English to Marathi (Devanagari)"""
    start_time = time.time()
    print("-> Translating text...")
    
    # FIX: The IndicTrans2 custom tokenizer expects the source and target tags 
    # to be literally prepended to the raw string before tokenization.
    formatted_text = f"{src_lang} {target_lang} {text}"
    
    inputs = trans_tokenizer(
        formatted_text, 
        return_tensors="pt", 
        padding=True, 
        truncation=True
    )
    
    with torch.no_grad():
        outputs = trans_model.generate(**inputs, max_length=256, use_cache=False)
    
    translation = trans_tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    print(f"[SUCCESS] Translation done in {time.time() - start_time:.2f}s")
    return translation

    
def generate_voice(text, output_file="output_marathi.wav"):
    """Step 3: Generate offline Marathi audio"""
    start_time = time.time()
    print("-> Generating voiceover...")
    
    inputs = tts_tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        output = tts_model(**inputs).waveform
    
    # Save the waveform to a file
    audio_data = output.squeeze().numpy()
    sf.write(output_file, audio_data, tts_model.config.sampling_rate)
    
    print(f"[SUCCESS] Audio saved to {output_file} in {time.time() - start_time:.2f}s")

# ==========================================
# 3. RUN THE PIPELINE
# ==========================================
if __name__ == "__main__":
    test_english_text = "Agriculture is the backbone of the rural economy. We must educate farmers on new techniques."
    
    print("\n--- STARTING JOB ---")
    print(f"INPUT: {test_english_text}\n")
    
    # 1. Translate
    marathi_text = translate_text(test_english_text)
    print(f"TRANSLATION: {marathi_text}\n")
    
    # 2. Synthesize Audio
    generate_voice(marathi_text)
    
    print("--- JOB COMPLETE ---")