import os
import time
import subprocess
import math
from services.asr_engine import ASRService
from services.translation_engine import TranslationService
from services.tts_engine import TTSService

class VideoService:
    def __init__(self, asr: ASRService, translator: TranslationService, tts: TTSService):
        self.asr = asr
        self.translator = translator
        self.tts = tts

    def format_srt_time(self, seconds: float) -> str:
        """Converts float seconds to SRT time format HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds - math.floor(seconds)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    def process_video(self, input_video: str, target_lang_code: str, tts_lang_code: str):
        """
        1. Extract Audio -> 2. Transcribe -> 3. Translate -> 4. Generate SRT -> 5. TTS -> 6. Remux
        """
        start_time = time.time()
        print(f"--- STARTING VIDEO PIPELINE: {input_video} ---")
        
        base_name = "pipeline_temp"
        extracted_audio = f"{base_name}.wav"
        srt_file = f"{base_name}.srt"
        new_audio = f"{base_name}_tts.wav"
        output_video = f"final_output_{target_lang_code}.mp4"

        # Cleanup previous runs to avoid FFmpeg conflict prompts
        for f in [extracted_audio, srt_file, new_audio, output_video]:
            if os.path.exists(f): os.remove(f)

        try:
            # 1. EXTRACT AUDIO (16kHz mono for Whisper)
            print("[1/6] Extracting audio footprint...")
            subprocess.run([
                "ffmpeg", "-i", input_video, "-vn", "-acodec", "pcm_s16le", 
                "-ar", "16000", "-ac", "1", extracted_audio
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # 2. ASR WITH TIMESTAMPS
            print("[2/6] Transcribing with Faster-Whisper...")
            segments = self.asr.transcribe_with_timestamps(extracted_audio)

            # 3 & 4. TRANSLATE & BUILD SRT
            print("[3/6 & 4/6] Translating and building SRT subtitle file...")
            srt_content = ""
            full_translated_text = []

            for index, segment in enumerate(segments, start=1):
                # Translate chunk
                translated_chunk = self.translator.translate(segment["text"], target_lang=target_lang_code)
                full_translated_text.append(translated_chunk)
                
                # Format SRT
                start_str = self.format_srt_time(segment["start"])
                end_str = self.format_srt_time(segment["end"])
                srt_content += f"{index}\n{start_str} --> {end_str}\n{translated_chunk}\n\n"

            with open(srt_file, "w", encoding="utf-8") as f:
                f.write(srt_content)

            # 5. GENERATE TTS AUDIO
            print("[5/6] Synthesizing native voiceover...")
            combined_translation = " ".join(full_translated_text)
            self.tts.generate_voice(combined_translation, lang_code=tts_lang_code, output_file=new_audio)

            # 6. REMUX (Burn subtitles and overlay new audio)
            # Note: Hardcoding subtitles requires re-encoding the video track (libx264)
            print("[6/6] Remuxing final video (This will tax the CPU)...")
            
            # Windows FFmpeg path formatting for the subtitle filter
            safe_srt_path = srt_file.replace("\\", "/")
            
            subprocess.run([
                "ffmpeg", 
                "-i", input_video,         # Video input
                "-i", new_audio,           # New audio input
                "-vf", f"subtitles={safe_srt_path}", # Burn subtitles
                "-c:v", "libx264",         # Re-encode video
                "-preset", "veryfast",     # Speed up encoding for the demo
                "-c:a", "aac",             # Re-encode audio
                "-map", "0:v:0",           # Use video from input 0
                "-map", "1:a:0",           # Use audio from input 1
                "-shortest",               # End when the shortest stream ends
                output_video
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            print(f"--- VIDEO PIPELINE COMPLETE in {time.time() - start_time:.2f}s ---")
            return output_video, combined_translation

        finally:
            # Clean up heavy temp files (Keep the final video and SRT for review)
            if os.path.exists(extracted_audio): os.remove(extracted_audio)