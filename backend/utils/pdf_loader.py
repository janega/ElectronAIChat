from typing import List
import os
from PyPDF2 import PdfReader
from .text_splitter import TextSplitter

# Optional OCR/image dependencies
from pdf2image import convert_from_path
import pytesseract


def load_pdf_with_ocr(
    path: str,
    poppler_path: str = r"D:\My Coding Projects\Poppler\poppler-25.07.0\Library\bin", 
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[str]:
    """Extract text from PDF using OCR if needed and split into semantic chunks."""
    print(f"Processing PDF: {path}")
    
    # First try normal text extraction
    reader = PdfReader(path)
    pages_text = []
    
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        
        # If no text found, try OCR
        if not text.strip():
            print(f"No embedded text in page {i+1}, trying OCR...")
            
            # Check OCR dependencies
            if convert_from_path is None or pytesseract is None:
                print("pdf2image or pytesseract not available; skipping OCR.")
                continue
                
            try:
                # Convert PDF page to image
                images = convert_from_path(
                    path,
                    first_page=i+1,
                    last_page=i+1,
                    poppler_path=poppler_path
                )
                
                if images:
                    # Extract text from image using OCR
                    text = pytesseract.image_to_string(images[0])
                    print(f"OCR extracted {len(text)} characters")
                else:
                    print(f"Could not convert page {i+1} to image")
                    continue
                    
            except Exception as e:
                print(f"Error during OCR for page {i+1}: {str(e)}")
                continue
        
        # Add page text if we got any
        if text.strip():
            pages_text.append(text)
            print(f"Added page {i+1} with {len(text)} characters")
        
    print(f"\nExtracted text from {len(pages_text)}/{len(reader.pages)} pages")
    
    # Create a text splitter instance
    splitter = TextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    
    # Join all pages with double newlines to preserve page boundaries
    full_text = "\n\n".join(pages_text)
    
    # First try splitting by sections
    chunks = splitter.split_by_section(full_text)
    
    # If no clear sections found, fall back to semantic chunking
    if len(chunks) <= 1:
        chunks = splitter.split_text(full_text)
    
    print(f"Split into {len(chunks)} semantic chunks")
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i+1}: {len(chunk)} characters")
        
    return chunks

if __name__ == "__main__":
    # Test the OCR extraction
    pdf_path = "data/heavy-duty.pdf"
    
    # Update this path to where you installed poppler
    poppler_path = r"C:\path\to\poppler-xx\bin"  # Change this!
    
    texts = load_pdf_with_ocr(pdf_path, poppler_path)
    
    print("\nFirst page preview:")
    if texts:
        print(texts[0][:500])
