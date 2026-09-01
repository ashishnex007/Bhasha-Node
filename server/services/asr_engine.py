import time
from faster_whisper import WhisperModel

# Map Whisper's ISO 639-1 codes to IndicTrans2 FLORES-200 tags
_WHISPER_LANG_TO_FLORES = {
    "mr": "mar_Deva",   # Marathi
    "hi": "hin_Deva",   # Hindi
    "en": "eng_Latn",   # English
    "kn": "kan_Knda",   # Kannada (in case Whisper hallucinates it)
}

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
        """
        Returns (segments, whisper_lang_code) where:
          - segments: list of {start, end, text}
          - whisper_lang_code: Whisper's detected ISO 639-1 code (e.g. 'mr', 'hi', 'en')
        The caller should use whisper_lang_code (not text-based detection) to
        determine the correct IndicTrans2 source tag.
        """
        start_time = time.time()
        # VAD filter prevents hallucinating text on silent audio segments
        # language=None lets Whisper auto-detect; we capture info.language
        segments_iter, info = self.model.transcribe(
            audio_path, beam_size=5, vad_filter=True
        )

        results = []
        for segment in segments_iter:
            results.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })

        whisper_lang = info.language  # e.g. 'mr', 'hi', 'en'
        print(f"[ASR] Whisper detected language: '{whisper_lang}' (prob={info.language_probability:.2f})")
        print(f"[SUCCESS] Timestamped transcription completed in {time.time() - start_time:.2f}s")
        return results, whisper_lang