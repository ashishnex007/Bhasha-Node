"""
Bhasha Node - Tesseract OCR Engine
Extracts text from scanned PDFs and images using pytesseract.
Supports Devanagari (Marathi/Hindi) and English.
"""
import os
import time
from pathlib import Path

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False


class OCRService:
    """
    Extracts text from scanned PDFs and image files.
    Uses Tesseract with Devanagari (mar, hin) and English (eng) language packs.
    """

    def __init__(self):
        self.available = HAS_PIL and HAS_TESSERACT
        if self.available:
            print("[LOAD] OCR Engine (Tesseract) ready.")
        else:
            missing = []
            if not HAS_PIL:
                missing.append("Pillow")
            if not HAS_TESSERACT:
                missing.append("pytesseract")
            print(f"[WARN] OCR Engine unavailable. Missing: {', '.join(missing)}")

    def _get_tesseract_lang(self, target_language: str) -> str:
        """Maps target language to Tesseract lang code string."""
        lang_map = {
            "marathi": "mar+eng",
            "hindi": "hin+eng",
        }
        return lang_map.get(target_language.lower(), "eng")

    def extract_from_image(self, image_path: str, target_language: str = "marathi") -> str:
        """Extract text from a single image file."""
        if not self.available:
            raise RuntimeError("OCR dependencies not installed (pytesseract, Pillow)")

        start_time = time.time()
        lang = self._get_tesseract_lang(target_language)

        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, lang=lang)

        print(f"[SUCCESS] OCR extracted {len(text)} chars from image in {time.time() - start_time:.2f}s")
        return text.strip()

    def extract_from_pdf(self, pdf_path: str, target_language: str = "marathi") -> str:
        """Extract text from all pages of a scanned PDF."""
        if not self.available:
            raise RuntimeError("OCR dependencies not installed (pytesseract, Pillow)")
        if not HAS_PDF2IMAGE:
            raise RuntimeError("pdf2image not installed. Install with: pip install pdf2image")

        start_time = time.time()
        lang = self._get_tesseract_lang(target_language)

        print(f"[OCR] Converting PDF to images: {pdf_path}")
        images = convert_from_path(pdf_path, dpi=300)

        all_text = []
        for i, page_img in enumerate(images):
            print(f"[OCR] Processing page {i + 1}/{len(images)}...")
            page_text = pytesseract.image_to_string(page_img, lang=lang)
            all_text.append(page_text.strip())

        combined = "\n\n".join(all_text)
        print(f"[SUCCESS] OCR extracted {len(combined)} chars from {len(images)} pages in {time.time() - start_time:.2f}s")
        return combined

    def extract(self, file_path: str, target_language: str = "marathi") -> str:
        """Auto-detect file type and extract text."""
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return self.extract_from_pdf(file_path, target_language)
        elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"):
            return self.extract_from_image(file_path, target_language)
        else:
            raise ValueError(f"Unsupported OCR file type: {ext}")
