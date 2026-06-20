import os
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path
import pytesseract

# IF Windows or custom on-prem path where Tesseract binary isn't global, uncomment and point to it:
# pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract' 
# Explicitly point to the Tesseract executable
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def process_document_ocr(file_path: str, lang: str = "eng+hin") -> str:
    """
    Extracts text from an image or scanned PDF using local Tesseract OCR.
    
    Args:
        file_path (str): Path to the image or PDF file.
        lang (str): Tesseract language codes combined with '+' (e.g., 'eng+hin+mar').
        
    Returns:
        str: The extracted plain text.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Target file not found at: {file_path}")
        
    extracted_text = []
    
    # Handle PDF input
    if path.suffix.lower() == '.pdf':
        print(f"[OCR Pipeline] Processing PDF: {path.name}")
        try:
            # Convert PDF pages to PIL Images in memory (avoids disk write overhead)
            POPPLER_BIN_PATH = r"C:\poppler\poppler-24.02.0\Library\bin"

            pages = convert_from_path(file_path, dpi=300, poppler_path=POPPLER_BIN_PATH)
            
            for page_num, page_image in enumerate(pages, start=1):
                print(f"[OCR Pipeline] Processing page {page_num}/{len(pages)}...")
                text = pytesseract.image_to_string(page_image, lang=lang)
                extracted_text.append(f"--- Page {page_num} ---\n{text}")
                
        except Exception as e:
            print(f"[Error] Failed to process PDF via pdf2image: {str(e)}")
            raise e
            
    # Handle Standard Image input
    elif path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        print(f"[OCR Pipeline] Processing Image: {path.name}")
        try:
            with Image.open(file_path) as img:
                text = pytesseract.image_to_string(img, lang=lang)
                extracted_text.append(text)
        except Exception as e:
            print(f"[Error] Failed to process image via PIL: {str(e)}")
            raise e
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")
        
    return "\n\n".join(extracted_text)


if __name__ == "__main__":
    # Test execution block
    # Drop a sample file (image or scanned PDF) in your directory to verify setup
    SAMPLE_FILE = "telugu.pdf" 
    
    if os.path.exists(SAMPLE_FILE):
        try:
            result = process_document_ocr(SAMPLE_FILE, lang="eng+hin")
            print("\n=== OCR OUTPUT ===")
            print(result[:1000]) # Print first 1000 characters to verify
            print("==================")
        except Exception as err:
            print(f"Pipeline execution failed: {err}")
    else:
        print(f"\n[Ready] Environment verified. Place a file at '{SAMPLE_FILE}' to run a live test.")