import os
from dotenv import load_dotenv
load_dotenv()   # loads .env

import time
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from huggingface_hub import login

class TranslationService:
    def __init__(self):
        print("[LOAD] Booting Translation Engine (IndicTrans2)...")
        # Authentication required for gated AI4Bharat model
        HF_TOKEN = os.getenv("HF_TOKEN")

        if not HF_TOKEN:
            raise RuntimeError("HF_TOKEN not found in environment")

        login(token=HF_TOKEN)
        
        self.model_name = "ai4bharat/indictrans2-en-indic-dist-200M"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name, trust_remote_code=True)

    def translate(self, text: str, target_lang: str) -> str:
        """target_lang options: 'mar_Deva' (Marathi), 'hin_Deva' (Hindi)"""
        start_time = time.time()
        
        formatted_text = f"eng_Latn {target_lang} {text}"
        inputs = self.tokenizer(formatted_text, return_tensors="pt", padding=True, truncation=True)
        
        with torch.no_grad():
            outputs = self.model.generate(**inputs, max_length=256, use_cache=False)
        
        translation = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        print(f"[SUCCESS] {target_lang} Translation completed in {time.time() - start_time:.2f}s")
        return translation