import time
import gc
import threading
import torch
import numpy as np
import soundfile as sf
from pathlib import Path
from transformers import VitsModel, AutoTokenizer as VitsTokenizer
from config import TTS_MODELS


def _speech_chunks(text: str, limit: int = 300) -> list[str]:
    """Keep every word while staying within the voice model's safe input size."""
    chunks = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}" if current else word
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = ""
        while len(word) > limit:
            chunks.append(word[:limit])
            word = word[limit:]
        current = word
    if current:
        chunks.append(current)
    return chunks

class TTSService:
    def __init__(self):
        print("[LOAD] Booting TTS Engines (Marathi, Hindi & English)...")
        self.models = {}
        self.tokenizers = {}
        self._lock = threading.Lock()
        
        checkpoints = TTS_MODELS
        
        self.checkpoints = checkpoints
        print("[LOAD] TTS will load one local voice on demand.")

    def generate_voice(self, text: str, lang_code: str, output_file: str):
        """lang_code options: 'mar', 'hin', 'eng'"""
        if lang_code not in self.checkpoints:
            raise ValueError(f"Unsupported TTS language: {lang_code}. Supported: {list(self.checkpoints.keys())}")
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
       
        start_time = time.time()
        with self._lock:
            if lang_code not in self.models:
                self.models.clear()
                self.tokenizers.clear()
                gc.collect()
                model_name = self.checkpoints[lang_code]
                self.tokenizers[lang_code] = VitsTokenizer.from_pretrained(model_name, local_files_only=True)
                self.models[lang_code] = VitsModel.from_pretrained(model_name, local_files_only=True)
            chunks = _speech_chunks(text.lower().strip())
            if not chunks:
                raise ValueError("There is no text to speak.")
            sample_rate = self.models[lang_code].config.sampling_rate
            with sf.SoundFile(output_file, mode="w", samplerate=sample_rate, channels=1) as stream:
                for index, chunk in enumerate(chunks):
                    inputs = self.tokenizers[lang_code](chunk, return_tensors="pt")
                    with torch.no_grad():
                        waveform = self.models[lang_code](**inputs).waveform
                    stream.write(waveform.squeeze().cpu().numpy())
                    if index < len(chunks) - 1:
                        stream.write(np.zeros(int(sample_rate * 0.1), dtype=np.float32))
        elapsed = time.time() - start_time
        print(f"[SUCCESS] Audio saved to {output_file} in {elapsed:.2f}s")

        return output_file
