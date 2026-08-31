import os
import time
import tracemalloc
import psutil
from dataclasses import dataclass, asdict
from typing import List, Dict
import sacrebleu
from jiwer import wer, cer

# Import your existing engine services
from services.translation_engine import TranslationService
from services.asr_engine import ASRService
from services.tts_engine import TTSService

@dataclass
class EvalResult:
    stage: str
    sample_id: str
    latency_sec: float
    peak_ram_mb: float
    metric_name: str
    metric_score: float
    output_preview: str

class PipelineHarness:
    def __init__(self):
        print("--- [HARNESS] Initializing Models & Baseline Memory Profiler ---")
        self.process = psutil.Process(os.getpid())
        
        # Load pipeline components
        self.translator = TranslationService()
        self.asr = ASRService()
        self.tts = TTSService()

    def _get_ram_usage_mb(self) -> float:
        return self.process.memory_info().rss / (1024 * 1024)

    # ----------------------------------------------------
    # 1. TRANSLATION HARNESS (BLEU / chrF++)
    # ----------------------------------------------------
    def evaluate_translation(self, test_set: List[Dict[str, str]]) -> List[EvalResult]:
        """
        Expects items like:
        {"id": "doc_1", "src_text": "Farmers need fertilizer", "target_lang": "hin_Deva", "ref_translation": "किसानों को खाद की आवश्यकता है"}
        """
        results = []
        for sample in test_set:
            tracemalloc.start()
            start_ram = self._get_ram_usage_mb()
            start_time = time.time()

            # Execute translation
            pred_translation = self.translator.translate(
                text=sample["src_text"], 
                target_lang=sample["target_lang"]
            )

            latency = time.time() - start_time
            peak_ram = max(self._get_ram_usage_mb() - start_ram, 0.0)
            tracemalloc.stop()

            # Metric: chrF++ (Standard for morphological Indic languages)
            chrf = sacrebleu.sentence_chrf(pred_translation, [sample["ref_translation"]]).score

            results.append(EvalResult(
                stage="Translation (IndicTrans2)",
                sample_id=sample["id"],
                latency_sec=round(latency, 3),
                peak_ram_mb=round(peak_ram, 2),
                metric_name="chrF++",
                metric_score=round(chrf, 2),
                output_preview=pred_translation[:50]
            ))
        return results

    # ----------------------------------------------------
    # 2. ASR HARNESS (Word Error Rate - WER)
    # ----------------------------------------------------
    def evaluate_asr(self, test_set: List[Dict[str, str]]) -> List[EvalResult]:
        """
        Expects items like:
        {"id": "audio_1", "audio_path": "tests/data/sample1.wav", "ref_transcript": "agriculture is the backbone"}
        """
        results = []
        for sample in test_set:
            if not os.path.exists(sample["audio_path"]):
                continue

            start_ram = self._get_ram_usage_mb()
            start_time = time.time()

            pred_transcript = self.asr.transcribe(sample["audio_path"])

            latency = time.time() - start_time
            peak_ram = max(self._get_ram_usage_mb() - start_ram, 0.0)

            # Metric: Word Error Rate (WER) & Character Error Rate (CER)
            wer_score = wer(sample["ref_transcript"].lower(), pred_transcript.lower())

            results.append(EvalResult(
                stage="ASR (Faster-Whisper)",
                sample_id=sample["id"],
                latency_sec=round(latency, 3),
                peak_ram_mb=round(peak_ram, 2),
                metric_name="WER (Lower=Better)",
                metric_score=round(wer_score, 4),
                output_preview=pred_transcript[:50]
            ))
        return results

    # ----------------------------------------------------
    # 3. TTS HARNESS (Real-Time Factor - RTF)
    # ----------------------------------------------------
    def evaluate_tts(self, test_set: List[Dict[str, str]]) -> List[EvalResult]:
        """
        Expects items like:
        {"id": "tts_1", "text": "शेती हा ग्रामीण अर्थव्यवस्थेचा कणा आहे", "lang_code": "mar"}
        """
        results = []
        out_temp = "outputs/eval_tts_temp.wav"
        
        for sample in test_set:
            start_ram = self._get_ram_usage_mb()
            start_time = time.time()

            self.tts.generate_voice(sample["text"], lang_code=sample["lang_code"], output_file=out_temp)
            
            latency = time.time() - start_time
            peak_ram = max(self._get_ram_usage_mb() - start_ram, 0.0)

            results.append(EvalResult(
                stage="TTS (Meta MMS)",
                sample_id=sample["id"],
                latency_sec=round(latency, 3),
                peak_ram_mb=round(peak_ram, 2),
                metric_name="Generation Latency (s)",
                metric_score=round(latency, 3),
                output_preview=f"Saved to {out_temp}"
            ))

            if os.path.exists(out_temp):
                os.remove(out_temp)
                
        return results


# ----------------------------------------------------
# RUNNER SCRIPT / CLI
# ----------------------------------------------------
if __name__ == "__main__":
    harness = PipelineHarness()

    # Define Golden Reference Datasets
    sample_translations = [
        {
            "id": "trans_en_mr_1",
            "src_text": "Agriculture is the backbone of the rural economy.",
            "target_lang": "mar_Deva",
            "ref_translation": "शेती हा ग्रामीण अर्थव्यवस्थेचा कणा आहे."
        },
        {
            "id": "trans_en_hi_1",
            "src_text": "Farmers should use organic compost for healthy soil.",
            "target_lang": "hin_Deva",
            "ref_translation": "किसानों को स्वस्थ मिट्टी के लिए जैविक खाद का उपयोग करना चाहिए।"
        }
    ]

    sample_tts = [
        {
            "id": "tts_mr_1",
            "text": "शेती हा ग्रामीण अर्थव्यवस्थेचा कणा आहे.",
            "lang_code": "mar"
        }
    ]

    print("\n================ BENCHMARK EXECUTION ================\n")
    
    # 1. Run Translation Eval
    trans_results = harness.evaluate_translation(sample_translations)
    
    # 2. Run TTS Eval
    tts_results = harness.evaluate_tts(sample_tts)

    # 3. Print Tabular Report
    all_results = trans_results + tts_results
    
    header = f"{'Stage':<25} | {'Sample ID':<15} | {'Latency (s)':<12} | {'RAM (MB)':<10} | {'Metric':<20} | {'Score':<8}"
    print(header)
    print("-" * len(header))
    
    for r in all_results:
        print(f"{r.stage:<25} | {r.sample_id:<15} | {r.latency_sec:<12} | {r.peak_ram_mb:<10} | {r.metric_name:<20} | {r.metric_score:<8}")
    
    print("\n================ EVALUATION FINISHED ================\n")