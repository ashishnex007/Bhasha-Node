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
        
        # 1. FORCE ALL PATHS INTO THE OUTPUTS FOLDER
        out_dir = "outputs"
        base_name = os.path.join(out_dir, "pipeline_temp")
        
        extracted_audio = f"{base_name}.wav"
        srt_file = f"{base_name}.srt"
        new_audio = f"{base_name}_tts.wav"
        
        output_filename = f"final_output_{target_lang_code}.mp4"
        output_video = os.path.join(out_dir, output_filename)

        for f in [extracted_audio, srt_file, new_audio, output_video]:
            if os.path.exists(f): os.remove(f)

        try:
            print("[1/6] Extracting audio footprint...")
            subprocess.run([
                "ffmpeg", "-i", input_video, "-vn", "-acodec", "pcm_s16le", 
                "-ar", "16000", "-ac", "1", extracted_audio
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            print("[2/6] Transcribing with Faster-Whisper...")
            segments = self.asr.transcribe_with_timestamps(extracted_audio)

            print("[3/6 & 4/6] Translating and building SRT subtitle file...")
            srt_content = ""
            full_translated_text = []

            for index, segment in enumerate(segments, start=1):
                translated_chunk = self.translator.translate(segment["text"], target_lang=target_lang_code)
                full_translated_text.append(translated_chunk)
                
                start_str = self.format_srt_time(segment["start"])
                end_str = self.format_srt_time(segment["end"])
                srt_content += f"{index}\n{start_str} --> {end_str}\n{translated_chunk}\n\n"

            with open(srt_file, "w", encoding="utf-8") as f:
                f.write(srt_content)

            print("[5/6] Synthesizing native voiceover...")
            combined_translation = " ".join(full_translated_text)
            self.tts.generate_voice(combined_translation, lang_code=tts_lang_code, output_file=new_audio)

            print("[6/6] Remuxing final video (This will tax the CPU)...")
            safe_srt_path = srt_file.replace("\\", "/")
            
            subprocess.run([
                "ffmpeg", 
                "-i", input_video,         
                "-i", new_audio,           
                "-vf", f"subtitles={safe_srt_path}", 
                "-c:v", "libx264",         
                "-preset", "veryfast",     
                "-c:a", "aac",             
                "-map", "0:v:0",           
                "-map", "1:a:0",           
                "-shortest",               
                output_video
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            print(f"--- VIDEO PIPELINE COMPLETE in {time.time() - start_time:.2f}s ---")
            
            # 2. RETURN ONLY THE FILENAME SO FASTAPI CAN BUILD THE URL CORRECTLY
            return output_filename, combined_translation

        finally:
            if os.path.exists(extracted_audio): os.remove(extracted_audio)