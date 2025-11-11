# app/utils.py
"""
Utility functions for text extraction from various file types.

Supports:
- Plain text, markdown, Python files
- PDF with PyPDF2 and OCR fallback (Tesseract)
- JSON files

Enhanced from chat-backend with OCR and JSON support.
"""
from pathlib import Path
from typing import Optional
import logging
import json

from app.config import POPPLER_PATH

logger = logging.getLogger("chat_backend.utils")


def extract_text_from_file(file_path: Path, content_type: str) -> str:
    """
    Extract text from file at file_path. 
    
    Supports:
    - Plain text, markdown, Python files
    - PDF with OCR fallback if no embedded text
    - JSON files (formatted as readable text)
    
    Args:
        file_path: Path to the file
        content_type: MIME type of the file
        
    Returns:
        Extracted text content
    """
    try:
        # Plain text files
        if content_type in ("text/plain", "text/markdown", "text/x-python"):
            return file_path.read_text(encoding="utf-8")
        
        # JSON files
        if content_type == "application/json":
            return extract_text_from_json(file_path)

        # PDF files (with OCR fallback)
        if content_type == "application/pdf":
            return extract_text_from_pdf(file_path)

        # Unsupported type
        return f"[Unsupported content type: {content_type}]"

    except Exception as e:
        logger.exception("Error extracting text")
        return f"[Error extracting text: {str(e)}]"


def extract_text_from_pdf(file_path: Path) -> str:
    """
    Extract text from PDF using PyPDF2 with OCR fallback.
    
    Process:
    1. Try extracting embedded text with PyPDF2
    2. If no text found, use Tesseract OCR on converted images
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        Extracted text content
    """
    try:
        import PyPDF2
        
        # First try embedded text extraction
        with open(file_path, "rb") as f:
            pdf_reader = PyPDF2.PdfReader(f)
            pages_text = []
            
            for page_num, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                
                # If no embedded text, try OCR
                if not page_text.strip():
                    logger.info(f"No embedded text in page {page_num + 1}, trying OCR...")
                    ocr_text = extract_pdf_page_with_ocr(file_path, page_num)
                    if ocr_text:
                        pages_text.append(ocr_text)
                else:
                    pages_text.append(page_text)
            
            full_text = "\n\n".join(pages_text)
            logger.info(f"Extracted {len(full_text)} characters from PDF")
            return full_text
            
    except ImportError:
        logger.error("PyPDF2 not installed. Install: pip install PyPDF2")
        return "[PyPDF2 not available]"
    except Exception as e:
        logger.exception("PDF extraction failed")
        return f"[PDF extraction error: {str(e)}]"


def extract_pdf_page_with_ocr(file_path: Path, page_num: int) -> str:
    """
    Extract text from single PDF page using OCR.
    
    Args:
        file_path: Path to PDF file
        page_num: Zero-indexed page number
        
    Returns:
        OCR-extracted text or empty string on failure
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
        
        # Convert PDF page to image
        images = convert_from_path(
            str(file_path),
            first_page=page_num + 1,
            last_page=page_num + 1,
            poppler_path=POPPLER_PATH
        )
        
        if images:
            # Extract text using Tesseract OCR
            text = pytesseract.image_to_string(images[0])
            logger.info(f"OCR extracted {len(text)} characters from page {page_num + 1}")
            return text
        else:
            logger.warning(f"Could not convert page {page_num + 1} to image")
            return ""
            
    except ImportError as e:
        logger.warning(f"OCR dependencies not available: {e}")
        return ""
    except Exception as e:
        logger.error(f"OCR error for page {page_num + 1}: {e}")
        return ""


def extract_text_from_json(file_path: Path) -> str:
    """
    Extract text from JSON file and format as readable text.
    
    Args:
        file_path: Path to JSON file
        
    Returns:
        Formatted JSON content as text
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Format JSON with indentation for readability
        formatted = json.dumps(data, indent=2, ensure_ascii=False)
        logger.info(f"Extracted JSON with {len(formatted)} characters")
        return formatted
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON file: {e}")
        return f"[Invalid JSON: {str(e)}]"
    except Exception as e:
        logger.exception("JSON extraction failed")
        return f"[JSON extraction error: {str(e)}]"
