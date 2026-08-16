# OCR with Tesseract LSTM Models for High Accuracy in Indian Languages
import os
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path
import pytesseract

# Explicitly point to the Tesseract executable
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Point Poppler to the bin folder (Update this to your exact path if needed)
POPPLER_BIN_PATH = r"C:\Program Files\poppler\bin"

# Point Tesseract to your new HIGH-ACCURACY trained data folder
# Using absolute path for safety during local testing
TESSDATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'tessdata'))

def process_document_ocr(file_path: str, lang: str) -> str:
    """
    Extracts text using high-accuracy Tesseract LSTM models.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Target file not found at: {file_path}")
        
    extracted_text = []
    
    # OEM 1: Neural nets LSTM engine only.
    # PSM 3: Fully automatic page segmentation, but no OSD. (Standard for documents)
    # --tessdata-dir: Forces Tesseract to use the 'best' models we downloaded.
    custom_config = f'--tessdata-dir "{TESSDATA_DIR}" --oem 1 --psm 3'
    
    if path.suffix.lower() == '.pdf':
        print(f"[OCR Pipeline] Processing PDF: {path.name} with lang={lang}")
        try:
            pages = convert_from_path(file_path, dpi=300, poppler_path=POPPLER_BIN_PATH)
            
            for page_num, page_image in enumerate(pages, start=1):
                print(f"[OCR Pipeline] Processing page {page_num}/{len(pages)}...")
                text = pytesseract.image_to_string(page_image, lang=lang, config=custom_config)
                extracted_text.append(f"--- Page {page_num} ---\n{text}")
                
        except Exception as e:
            print(f"[Error] Failed to process PDF: {str(e)}")
            raise e
            
    elif path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        print(f"[OCR Pipeline] Processing Image: {path.name} with lang={lang}")
        try:
            with Image.open(file_path) as img:
                text = pytesseract.image_to_string(img, lang=lang, config=custom_config)
                extracted_text.append(text)
        except Exception as e:
            print(f"[Error] Failed to process image: {str(e)}")
            raise e
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")
        
    return "\n\n".join(extracted_text)

if __name__ == "__main__":
    # Test execution block
    
    # Notice we append '+eng' because regional documents often have English numbers or technical terms.
    # Do NOT mix 'hin+mar+eng' unless absolutely necessary.
    
    file_lang_map = {
        "marathi.pdf": "mar+eng",
        "hindi.pdf": "hin+eng"
    }
    
    for filename, lang_code in file_lang_map.items():
        if os.path.exists(filename):
            print(f"\n====================================")
            try:
                result = process_document_ocr(filename, lang=lang_code)
                print(f"=== OCR OUTPUT FOR {filename} ===")
                print(result[:1500]) 
            except Exception as err:
                print(f"Pipeline execution failed for {filename}: {err}")