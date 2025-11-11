import json
import hashlib
from typing import Any, List, Dict
from PyPDF2 import PdfReader
from .text_splitter import TextSplitter
from .pdf_loader import load_pdf_with_ocr


def sha256_of_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: str, json_key: str | None = None) -> List[Dict[str, Any]]:
    """Load a JSON file and return a list of entries.
    If the file is a dict and json_key is provided, returns that list.
    If it's already a list, return it as-is.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if json_key is None:
            # If there's only one list value, try to use it
            lists = [v for v in data.values() if isinstance(v, list)]
            if len(lists) == 1:
                return lists[0]
            raise ValueError(
                "Top-level JSON is an object. Provide --json-key to select the list field."
            )
        val = data.get(json_key)
        if not isinstance(val, list):
            raise ValueError(f"json_key '{json_key}' is not a list in the JSON file")
        return val
    raise ValueError("Unsupported JSON structure; expected list or dict")


def load_pdf(path: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """Extracts text from a PDF and returns semantically split chunks."""
    print(f"Loading PDF from: {path}")
    
    # Use the enhanced PDF loader with OCR fallback
    chunks = load_pdf_with_ocr(
        path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    
    print(f"Split into {len(chunks)} chunks")
    if chunks:
        print("\nPreview of first chunk:")
        print(chunks[0][:200] + "...")
    
    return chunks
