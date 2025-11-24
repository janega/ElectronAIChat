# app/config.py
import os
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
import sys

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
else:
    BASE_DIR = Path(os.getenv("BASE_DIR", "."))

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

# Create logs directory
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def setup_logging(log_level: str = "INFO"):
    """
    Configure application logging with file rotation.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Clear any existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    
    # Set base log level
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Console handler (less verbose for terminal readability)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # Main application log file (rotating, 5 MB per file, 20 backups = 100 MB total)
    app_log_file = LOGS_DIR / "app.log"
    file_handler = RotatingFileHandler(
        filename=app_log_file,
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=20,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)  # Capture everything in file
    file_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler)
    
    # Separate error log (rotating, 5 MB per file, 10 backups = 50 MB total)
    error_log_file = LOGS_DIR / "error.log"
    error_handler = RotatingFileHandler(
        filename=error_log_file,
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=10,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(error_handler)
    
    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("ElectronAIChat Backend Logging Initialized")
    logger.info(f"Log Level: {log_level}")
    logger.info(f"Base Directory: {BASE_DIR}")
    logger.info(f"Log Directory: {LOGS_DIR}")
    logger.info(f"App Log: {app_log_file}")
    logger.info(f"Error Log: {error_log_file}")
    logger.info("=" * 80)

# Initialize logging (can be overridden by environment variable)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
setup_logging(LOG_LEVEL)

logger = logging.getLogger(__name__)

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

# Defaults for models (env override) - must specify exact versions
DEFAULT_OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
DEFAULT_OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
DEFAULT_OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3:latest")
DEFAULT_OPENAI_LLM_MODEL = os.getenv("OPENAI_LLM_MODEL", "gpt-3.5-turbo")

# OCR Configuration (Poppler path for pdf2image)
POPPLER_PATH = os.getenv("POPPLER_PATH", r"D:\My Coding Projects\Poppler\poppler-25.07.0\Library\bin")

# Default settings for new users and fallback when UserSettings missing
DEFAULT_SETTINGS = {
    "temperature": 0.7,
    "max_tokens": 2048,
    "top_p": 0.9,
    "top_k": 40,
    "system_prompt": "You are a helpful assistant.",
    "use_memory": True,
}

# Other
APP_NAME = os.getenv("APP_NAME", "ElectronAIChat Backend")
