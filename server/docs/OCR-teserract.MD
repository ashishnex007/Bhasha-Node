# High-Accuracy Offline OCR Pipeline (Tesseract LSTM)

This module handles the extraction of text from standard images and scanned, multi-page PDFs. It is explicitly engineered to run 100% offline on on-premises infrastructure, fulfilling the primary constraint of the BAIF problem statement. 

It utilizes the Tesseract Neural Network (LSTM) engine (`tessdata_best`) to accurately parse complex Devanagari scripts (Marathi, Hindi) alongside English, avoiding the hallucination and formatting artifacts present in standard OCR models.

## 1. Python Environment Setup (All OS)

Isolate your dependencies to avoid version conflicts on the host machine. Run these commands from the project root:

```bash
# Create the virtual environment
python -m venv venv

# Activate the environment
# --> On Windows (CMD/PowerShell):
venv\Scripts\activate
# --> On Linux/macOS:
source venv/bin/activate

# Upgrade pip and install minimal required libraries
pip install --upgrade pip
pip install pytesseract Pillow pdf2image

2. System Dependencies Installation

Python libraries alone will not run this pipeline. You must install the underlying C++ binaries for PDF processing (Poppler) and OCR (Tesseract).
Option A: Linux (Target BAIF Production Server)

Run the following commands to install the native binaries globally on the Ubuntu/Debian server.
Bash

sudo apt-get update
sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-hin tesseract-ocr-mar

Option B: Windows (Local Development)

Windows requires manual installation of binaries.

1. Install Poppler (For PDF-to-Image conversion)

    Download the latest Poppler Windows release from: oschwartz10612/poppler-windows

    Extract the .zip file to a permanent directory (e.g., C:\poppler\poppler-24.02.0).

    Note: The Python script is already configured to point to this \bin directory locally to bypass Windows PATH issues.

2. Install Tesseract-OCR

    Download the 64-bit Windows installer from UB Mannheim.

    CRITICAL INSTALLATION STEP: During setup, you must expand the components menu and check the following:

        Expand Additional language data (download) -> Check Hindi and Marathi.

        Expand Additional script data (download) -> Check Devanagari.

    Complete the installation (default path is usually C:\Program Files\Tesseract-OCR).

3. High-Accuracy LSTM Models (tessdata_best)

The default system models struggle with the top-lines and half-letters of Devanagari scripts. We bypass them using Tesseract's tessdata_best models.

    Create a folder named tessdata in the same directory as your Python script.

    Download these three raw files from the tessdata_best GitHub repository and place them inside the tessdata folder:

        eng.traineddata

        hin.traineddata

        mar.traineddata

4. Execution Code

The following script handles multi-page PDF memory management and forces Tesseract to use the local LSTM models (OEM 1) with automated page segmentation (PSM 3).
Python

import os
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path
import pytesseract
import platform

# ==========================================
# ENVIRONMENT CONFIGURATION
# ==========================================

# Use absolute path for safety to locate the 'tessdata_best' models
TESSDATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'tessdata'))

# Windows-specific binary overrides
if platform.system() == "Windows":
    # Point explicitly to the Tesseract executable
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    # Point explicitly to Poppler bin (Update this path to match your local extraction)
    POPPLER_BIN_PATH = r"C:\poppler\poppler-24.02.0\Library\bin"
else:
    # Linux (Production) will use global PATH
    POPPLER_BIN_PATH = None

# ==========================================
# CORE OCR PIPELINE
# ==========================================

def process_document_ocr(file_path: str, lang: str) -> str:
    """
    Extracts text using high-accuracy Tesseract LSTM models.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Target file not found at: {file_path}")
        
    extracted_text = []
    
    # OEM 1: Neural nets LSTM engine only.
    # PSM 3: Fully automatic page segmentation, but no OSD.
    # --tessdata-dir: Forces Tesseract to use the high-accuracy models.
    custom_config = f'--tessdata-dir "{TESSDATA_DIR}" --oem 1 --psm 3'
    
    if path.suffix.lower() == '.pdf':
        print(f"[OCR] Processing PDF: {path.name} with lang={lang}")
        
        # Convert PDF using poppler. Passes poppler_path only if defined (Windows).
        kwargs = {"dpi": 300}
        if POPPLER_BIN_PATH:
            kwargs["poppler_path"] = POPPLER_BIN_PATH
            
        pages = convert_from_path(file_path, **kwargs)
        
        for page_num, page_image in enumerate(pages, start=1):
            print(f"[OCR] Processing page {page_num}/{len(pages)}...")
            text = pytesseract.image_to_string(page_image, lang=lang, config=custom_config)
            extracted_text.append(f"--- Page {page_num} ---\n{text}")
            
    elif path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        print(f"[OCR] Processing Image: {path.name} with lang={lang}")
        with Image.open(file_path) as img:
            text = pytesseract.image_to_string(img, lang=lang, config=custom_config)
            extracted_text.append(text)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")
        
    return "\n\n".join(extracted_text)

# ==========================================
# TEST EXECUTION
# ==========================================
if __name__ == "__main__":
    # Note: Use 'mar+eng' or 'hin+eng' for regional documents to allow for English technical terms.
    # Do NOT mix 'hin+mar+eng' as it degrades accuracy.
    
    sample_file = "sample.pdf" # Replace with your test file
    target_language = "mar+eng" 
    
    if os.path.exists(sample_file):
        try:
            result = process_document_ocr(sample_file, lang=target_language)
            print("\n=== OCR OUTPUT ===")
            print(result[:1500])
        except Exception as err:
            print(f"Pipeline execution failed: {err}")
    else:
        print(f"Verify environment complete. Place {sample_file} in directory to test.")