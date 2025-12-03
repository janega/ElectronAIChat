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
import httpx
import asyncio
import subprocess
import time
from datetime import datetime

from app.config import POPPLER_PATH, OLLAMA_HOST

logger = logging.getLogger("chat_backend.utils")


async def check_ollama_health(base_url: str = OLLAMA_HOST, timeout: float = 5.0) -> dict:
    """
    Check if Ollama is running and accessible.
    
    Args:
        base_url: Ollama base URL (e.g., http://localhost:11434)
        timeout: Request timeout in seconds
        
    Returns:
        Dict with 'available' (bool), 'version' (str), and 'models' (list) if available
    """
    result = {
        "available": False,
        "url": base_url,
        "checked_at": datetime.now().isoformat(),
        "error": None
    }
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Check tags endpoint (lists available models)
            response = await client.get(f"{base_url}/api/tags")
            
            if response.status_code == 200:
                data = response.json()
                result["available"] = True
                # Store full model names with exact versions
                result["models"] = [model["name"] for model in data.get("models", [])]
                result["model_count"] = len(result["models"])
                
                # Optional: Check version endpoint
                try:
                    version_response = await client.get(f"{base_url}/api/version")
                    if version_response.status_code == 200:
                        result["version"] = version_response.json().get("version", "unknown")
                except Exception:
                    pass  # Version check is optional
                
                logger.info(f"Ollama available at {base_url} ({result['model_count']} models)")
            else:
                result["error"] = f"HTTP {response.status_code}"
                logger.warning(f"Ollama responded with status {response.status_code}")
                
    except httpx.ConnectError:
        result["error"] = "Connection refused - Ollama not running"
        logger.debug(f"Cannot connect to Ollama at {base_url} (connection refused)")
    except httpx.TimeoutException:
        result["error"] = f"Connection timeout after {timeout}s"
        logger.error(f"Ollama health check timed out at {base_url}")
    except Exception as e:
        result["error"] = str(e)
        logger.exception(f"Ollama health check failed: {e}")
    
    return result


async def start_ollama_server() -> dict:
    """
    Attempt to start Ollama server as independent background process.
    
    Returns:
        Dict with 'started' (bool), 'process' (subprocess.Popen or None), 'error' (str or None)
    """
    result = {
        "started": False,
        "process": None,
        "error": None,
        "already_running": False
    }
    
    try:
        logger.info("Attempting to start Ollama server...")
        
        # Start ollama serve as completely independent detached process
        # This process will continue running even after backend exits
        import sys
        if sys.platform == "win32":
            # Windows: Start detached process without console window
            # DETACHED_PROCESS makes it independent from parent process
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
            
            process = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                startupinfo=startupinfo,
                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS,
                close_fds=True
            )
        else:
            # Linux/Mac: Start as daemon-like process
            process = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                start_new_session=True  # Detach from parent session
            )
        
        # Give Ollama a moment to initialize
        logger.info("Waiting for Ollama to initialize...")
        await asyncio.sleep(3)
        
        # Verify health instead of checking process status
        # (process is detached, so we can't poll it reliably)
        max_wait = 15
        for i in range(max_wait):
            health = await check_ollama_health(timeout=2.0)
            if health["available"]:
                result["started"] = True
                result["process"] = process  # Store reference so we can kill it on shutdown
                logger.info(f"✅ Ollama server started successfully (took {i+1}s)")
                logger.info(f"   Found {len(health.get('models', []))} models available")
                return result
            await asyncio.sleep(1)
        
        # Timeout waiting for health
        result["error"] = "Ollama process started but health check failed after 15s"
        logger.warning(f"⚠️ {result['error']}")
        logger.warning("   Ollama may still be starting up. It will continue running in background.")
        result["started"] = True  # Mark as started, let it continue initializing
        
    except FileNotFoundError:
        result["error"] = "Ollama command not found - Ollama is not installed"
        logger.error(f"❌ {result['error']}")
    except Exception as e:
        result["error"] = f"Failed to start Ollama: {str(e)}"
        logger.exception(f"❌ {result['error']}")
    
    return result


def stop_ollama_process(process: subprocess.Popen) -> bool:
    """
    Stop Ollama process gracefully (or forcefully if needed).
    
    Args:
        process: Popen object for Ollama process
        
    Returns:
        True if successfully stopped, False otherwise
    """
    import sys
    
    if not process:
        return False
    
    try:
        logger.info("Stopping Ollama process...")
        
        if sys.platform == "win32":
            # Windows: Use taskkill to stop ollama.exe and all child processes
            try:
                # Try graceful shutdown first
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T"],
                    capture_output=True,
                    timeout=5
                )
                time.sleep(2)
                
                # Check if still running, force kill if necessary
                result = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {process.pid}"],
                    capture_output=True,
                    text=True
                )
                if str(process.pid) in result.stdout:
                    logger.warning("Ollama didn't stop gracefully, forcing kill...")
                    subprocess.run(
                        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True,
                        timeout=5
                    )
                
                logger.info("✅ Ollama process stopped")
                return True
                
            except Exception as e:
                logger.error(f"Failed to kill Ollama with taskkill: {e}")
                # Fallback to terminate
                try:
                    process.terminate()
                    process.wait(timeout=5)
                    return True
                except:
                    process.kill()
                    return True
        else:
            # Linux/Mac: Standard termination
            process.terminate()
            try:
                process.wait(timeout=5)
                logger.info("✅ Ollama process stopped gracefully")
                return True
            except subprocess.TimeoutExpired:
                logger.warning("Ollama didn't stop gracefully, forcing kill...")
                process.kill()
                process.wait()
                logger.info("✅ Ollama process killed")
                return True
                
    except Exception as e:
        logger.error(f"Failed to stop Ollama process: {e}")
        return False


async def ensure_ollama_running(base_url: str = OLLAMA_HOST) -> dict:
    """
    Ensure Ollama is running, attempting to start it if necessary.
    
    Returns:
        Dict with 'running' (bool), 'started_by_us' (bool), 'error' (str or None)
    """
    result = {
        "running": False,
        "started_by_us": False,
        "error": None,
        "models": []
    }
    
    # First check if already running
    logger.info("Checking if Ollama is already running...")
    health = await check_ollama_health(base_url)
    
    if health["available"]:
        result["running"] = True
        result["models"] = health.get("models", [])
        logger.info("Ollama is already running")
        return result
    
    # Not running - try to start it
    logger.info("Ollama not running, attempting to start...")
    start_result = await start_ollama_server()
    
    if start_result["started"]:
        result["running"] = True
        result["started_by_us"] = True
        result["process"] = start_result.get("process")  # Store process reference
        
        # Re-check health to get model list
        health = await check_ollama_health(base_url, timeout=5.0)
        if health["available"]:
            result["models"] = health.get("models", [])
        
        logger.info("Successfully started Ollama server")
        return result
    
    elif start_result["already_running"]:
        # Process detected it's already running, but health check failed
        # This can happen if Ollama is starting up or running on different port
        logger.warning("Ollama reports it's already running, but health check failed")
        result["error"] = f"Ollama may be running on a different port or still starting up. Expected: {base_url}"
        return result
    
    else:
        # Failed to start
        result["error"] = start_result["error"]
        logger.error(f"Could not start Ollama: {result['error']}")
        return result


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
