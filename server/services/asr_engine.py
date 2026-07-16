import time
from faster_whisper import WhisperModel

class ASRService:
    def __init__(self):
        print("[LOAD] Booting ASR Engine (Faster-Whisper INT8)...")
        self.model = WhisperModel("small", device="cpu", compute_type="int8")

    def transcribe(self, audio_path: str) -> str:
        start_time = time.time()
        segments, info = self.model.transcribe(audio_path, beam_size=5)
        transcription = " ".join([segment.text for segment in segments])
        print(f"[SUCCESS] Transcription completed in {time.time() - start_time:.2f}s")
        return transcription

    def transcribe_with_timestamps(self, audio_path: str):
        """Returns a list of dictionaries with text and timestamps."""
        start_time = time.time()
        # VAD filter prevents hallucinating text on silent audio segments
        segments, info = self.model.transcribe(audio_path, beam_size=5, vad_filter=True)
        
        results = []
        for segment in segments:
            results.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            
        print(f"[SUCCESS] Timestamped transcription completed in {time.time() - start_time:.2f}s")
        return results