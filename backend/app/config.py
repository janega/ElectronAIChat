# app/config.py
import os
from pathlib import Path
import logging
import sys

# Basic logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("chat_backend")

# Provider configuration
PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ============================================================================
# APP DATA DIRECTORY (Platform-specific)
# ============================================================================

def get_app_data_dir():
    """Get platform-specific app data directory"""
    app_name = os.getenv("APP_NAME", "ElectronAIChat")
    
    if sys.platform == 'win32':  # Windows
        base = os.getenv('APPDATA')
        if base:
            app_dir = Path(base) / app_name
        else:
            app_dir = Path.home() / 'AppData' / 'Roaming' / app_name
    elif sys.platform == 'darwin':  # macOS
        app_dir = Path.home() / 'Library' / 'Application Support' / app_name
    else:  # Linux and others
        app_dir = Path.home() / '.config' / app_name
    
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


# Detect if running as packaged executable
IS_PACKAGED = getattr(sys, 'frozen', False)

# Force app data directory when packaged, otherwise check env var
USE_APP_DATA_DIR = IS_PACKAGED or os.getenv("USE_APP_DATA_DIR", "false").lower() == "true"

if USE_APP_DATA_DIR:
    BASE_DIR = get_app_data_dir()
    logger.info(f"Using app data directory: {BASE_DIR}")
else:
    BASE_DIR = Path(os.getenv("BASE_DIR", "."))
    logger.info(f"Using local directory: {BASE_DIR}")

# Upload and persistence directories
UPLOAD_DIR = (BASE_DIR / "uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CHROMA_DIR = (BASE_DIR / "chroma_db")
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Database path
DATABASE_PATH = BASE_DIR / "chat_history.db"

# Upload limits
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # bytes

# CORS
ALLOW_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
]

# Defaults for models (env override)
DEFAULT_OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
DEFAULT_OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
DEFAULT_OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama2")
DEFAULT_OPENAI_LLM_MODEL = os.getenv("OPENAI_LLM_MODEL", "gpt-3.5-turbo")

# OCR Configuration (Poppler path for pdf2image)
POPPLER_PATH = os.getenv("POPPLER_PATH", r"D:\My Coding Projects\Poppler\poppler-25.07.0\Library\bin")

# Other
APP_NAME = os.getenv("APP_NAME", "ElectronAIChat Backend")
