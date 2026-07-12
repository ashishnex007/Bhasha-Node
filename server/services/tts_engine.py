import time
import torch
import soundfile as sf
from transformers import VitsModel, AutoTokenizer as VitsTokenizer

class TTSService:
    def __init__(self):
        print("[LOAD] Booting TTS Engines (Marathi & Hindi)...")
        self.models = {}
        self.tokenizers = {}
        
        # Pre-load Marathi
        mar_name = "facebook/mms-tts-mar"
        self.tokenizers["mar"] = VitsTokenizer.from_pretrained(mar_name)
        self.models["mar"] = VitsModel.from_pretrained(mar_name)
        
        # Pre-load Hindi
        hin_name = "facebook/mms-tts-hin"
        self.tokenizers["hin"] = VitsTokenizer.from_pretrained(hin_name)
        self.models["hin"] = VitsModel.from_pretrained(hin_name)

    def generate_voice(self, text: str, lang_code: str, output_file: str):
        """lang_code options: 'mar', 'hin'"""
        start_time = time.time()
        
        inputs = self.tokenizers[lang_code](text, return_tensors="pt")
        with torch.no_grad():
            output = self.models[lang_code](**inputs).waveform
            
        audio_data = output.squeeze().numpy()
        sf.write(output_file, audio_data, self.models[lang_code].config.sampling_rate)
        print(f"[SUCCESS] Audio saved to {output_file} in {time.time() - start_time:.2f}s")