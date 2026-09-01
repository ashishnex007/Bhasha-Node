import time
import torch
import soundfile as sf
from transformers import VitsModel, AutoTokenizer as VitsTokenizer

class TTSService:
    def __init__(self):
        print("[LOAD] Booting TTS Engines (Marathi, Hindi & English)...")
        self.models = {}
        self.tokenizers = {}
        
        checkpoints = {
            "mar": "facebook/mms-tts-mar",
            "hin": "facebook/mms-tts-hin",
            "eng": "facebook/mms-tts-eng",
        }
        
        for lang_code, model_name in checkpoints.items():
            print(f"[LOAD] Initializing {lang_code.upper()} TTS Model ({model_name})...")
            self.tokenizers[lang_code] = VitsTokenizer.from_pretrained(model_name)
            self.models[lang_code] = VitsModel.from_pretrained(model_name)
            print(f"[LOAD] {lang_code.upper()} TTS ready.")

    def generate_voice(self, text: str, lang_code: str, output_file: str):
        """lang_code options: 'mar', 'hin', 'eng'"""
        if lang_code not in self.models:
            raise ValueError(f"Unsupported TTS language: {lang_code}. Supported: {list(self.models.keys())}")
       
        start_time = time.time()
        
        # MMS-TTS works best with lowercase for all supported languages
        cleaned_text = text.lower().strip()
        
        inputs = self.tokenizers[lang_code](cleaned_text, return_tensors="pt")

        with torch.no_grad():
            output = self.models[lang_code](**inputs).waveform
            
        audio_data = output.squeeze().numpy()
        sf.write(output_file, audio_data, self.models[lang_code].config.sampling_rate)
        elapsed = time.time() - start_time
        print(f"[SUCCESS] Audio saved to {output_file} in {elapsed:.2f}s")

        return output_file