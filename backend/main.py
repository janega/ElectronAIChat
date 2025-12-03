# backend.py
"""
ElectronAIChat Backend - FastAPI server with RAG, ChromaDB, and Memory

Enhanced from original with:
- SQLite database for persistent storage
- ChromaDB vector storage (replacing Redis)
- Mem0 memory system for long-term context
- LangChain integration for embeddings and chat
- OCR support for PDF processing
- JSON file processing
"""
import os
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

from app.config import (
    APP_NAME, PROVIDER, OLLAMA_HOST, OPENAI_API_KEY, 
    ALLOW_ORIGINS, DATABASE_PATH, BASE_DIR, LOGS_DIR, IS_PACKAGED,
    DEFAULT_OLLAMA_LLM_MODEL, DEFAULT_OPENAI_LLM_MODEL,
    DEFAULT_OLLAMA_EMBED_MODEL, DEFAULT_OPENAI_EMBED_MODEL,
    logger as cfg_logger
)
from app.embeddings import LangChainEmbeddingManager
from app.memory import Mem0MemoryManager
from app.openai_client import EnhancedOpenAIClient
from app.db_manager import create_db_and_tables

# Import route modules
from app.routes import dependencies
from app.routes.health import router as health_router
from app.routes.chat import router as chat_router
from app.routes.documents import router as documents_router
from app.routes.chats import router as chats_router
from app.routes.users import router as users_router
from app.routes.admin import router as admin_router

# Load environment variables
load_dotenv()

# Use the logger from config
logger = cfg_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle events (startup/shutdown).
    Replaces deprecated @app.on_event decorators.
    """
    # Startup: Initialize database and managers
    logger.info("=" * 80)
    logger.info("ElectronAIChat Backend Starting")
    logger.info(f"Packaged: {IS_PACKAGED}")
    logger.info(f"Base Directory: {BASE_DIR}")
    logger.info(f"Logs Directory: {LOGS_DIR}")
    logger.info(f"LLM Provider: {PROVIDER}")
    
    # Validate provider configuration
    startup_errors = []
    
    if PROVIDER == "ollama":
        logger.info(f"Ollama Host: {OLLAMA_HOST}")
        logger.info(f"Ollama LLM Model: {DEFAULT_OLLAMA_LLM_MODEL}")
        logger.info(f"Ollama Embed Model: {DEFAULT_OLLAMA_EMBED_MODEL}")
        logger.info("=" * 80)
        logger.info("Checking Ollama service...")
        
        # Check if Ollama is running, start as independent process if needed
        from app.utils import ensure_ollama_running
        ollama_status = await ensure_ollama_running(OLLAMA_HOST)
        
        if not ollama_status["running"]:
            error_msg = f"Ollama could not be started: {ollama_status['error']}"
            logger.error(f"{error_msg}")
            startup_errors.append({
                "component": "ollama",
                "message": error_msg,
                "suggestion": "Install Ollama from https://ollama.ai or start it manually with: ollama serve"
            })
        else:
            # Ollama is running - verify required models are available
            if ollama_status["started_by_us"]:
                logger.info("✅ Started Ollama as independent background service")
                logger.info("   Ollama will be stopped when backend exits")
                # Store process reference for cleanup on shutdown
                app.state.ollama_process = ollama_status.get("process")
            else:
                logger.info("✅ Ollama service is already running")
                app.state.ollama_process = None  # Don't kill processes we didn't start
            
            # Check for exact version match
            available_models = ollama_status.get("models", [])
            required_models = [DEFAULT_OLLAMA_LLM_MODEL, DEFAULT_OLLAMA_EMBED_MODEL]
            missing_models = [m for m in required_models if m not in available_models]
            
            if missing_models:
                error_msg = f"Required Ollama models not found: {missing_models}"
                logger.warning(f"{error_msg}")
                logger.info(f"Available models: {available_models}")
                startup_errors.append({
                    "component": "ollama_models",
                    "message": error_msg,
                    "suggestion": f"Pull missing models: {' and '.join([f'ollama pull {m}' for m in missing_models])}"
                })
            else:
                logger.info(f"All required Ollama models available: {required_models}")
    
    elif PROVIDER == "openai":
        logger.info(f"OpenAI LLM Model: {DEFAULT_OPENAI_LLM_MODEL}")
        logger.info(f"OpenAI Embed Model: {DEFAULT_OPENAI_EMBED_MODEL}")
        
        if not OPENAI_API_KEY or OPENAI_API_KEY == "":
            error_msg = "OPENAI_API_KEY is not set in environment"
            logger.error(f"{error_msg}")
            startup_errors.append({
                "component": "openai_api_key",
                "message": error_msg,
                "suggestion": "Set OPENAI_API_KEY in .env file"
            })
        else:
            logger.info("✅ OpenAI API key configured")
    
    else:
        error_msg = f"Unknown provider: {PROVIDER}"
        logger.error(f"{error_msg}")
        startup_errors.append({
            "component": "provider",
            "message": error_msg,
            "suggestion": "Set LLM_PROVIDER to 'ollama' or 'openai' in .env"
        })
    
    # Log startup validation results
    if startup_errors:
        logger.warning("=" * 80)
        logger.warning("STARTUP VALIDATION WARNINGS:")
        for error in startup_errors:
            logger.warning(f"  • [{error['component']}] {error['message']}")
            logger.warning(f"    → {error['suggestion']}")
        logger.warning("=" * 80)
        logger.warning("Backend will start but may fail at runtime. Fix issues above.")
        logger.warning("=" * 80)
    
    logger.info(f"Database: {DATABASE_PATH}")
    logger.info(f"ChromaDB: {BASE_DIR / 'chroma_db'}")
    logger.info(f"Upload Directory: {BASE_DIR / 'uploads'}")
    
    # Initialize database (create tables on startup)
    create_db_and_tables()
    
    # Initialize shared managers (single instances)
    try:
        langchain_manager = LangChainEmbeddingManager(provider=PROVIDER)
    except Exception as e:
        logger.error(f"Failed to initialize LangChain manager: {e}")
        if PROVIDER == "ollama" and not any(err["component"] == "ollama" for err in startup_errors):
            logger.error("This usually means Ollama is not running or models are not available")
        raise
    
    mem0_manager = Mem0MemoryManager()
    
    # Initialize OpenAI client based on provider
    try:
        if PROVIDER == "ollama":
            openai_client = EnhancedOpenAIClient(
                base_url=OLLAMA_HOST,
                api_key="ollama",
                provider="ollama"
            )
        else:
            openai_client = EnhancedOpenAIClient(
                base_url="https://api.openai.com/v1",
                api_key=OPENAI_API_KEY,
                provider="openai"
            )
    except Exception as e:
        logger.error(f"Failed to initialize LLM client: {e}")
        raise
    
    # Set up dependency injection for managers
    dependencies.set_managers(
        langchain_manager=langchain_manager,
        mem0_manager=mem0_manager,
        openai_client=openai_client
    )
    
    logger.info("All managers initialized successfully")
    logger.info("=" * 80)
    
    # Store startup errors in app state for health endpoint
    app.state.startup_errors = startup_errors
    
    # Yield control to application (runs while app is active)
    yield
    
    # Shutdown: Cleanup resources
    logger.info("=" * 80)
    logger.info("ElectronAIChat Backend Shutting Down")
    
    # Kill Ollama process if we started it
    if PROVIDER == "ollama" and hasattr(app.state, 'ollama_process') and app.state.ollama_process:
        logger.info("Stopping Ollama server (started by backend)...")
        from app.utils import stop_ollama_process
        stop_ollama_process(app.state.ollama_process)
    elif PROVIDER == "ollama":
        logger.info("ℹ️ Ollama was already running, leaving it active")
    
    logger.info("=" * 80)


# Initialize FastAPI application with lifespan handler
app = FastAPI(
    title=APP_NAME,
    description="Chat backend with RAG, ChromaDB vector storage, and memory integration",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(chats_router)
app.include_router(users_router)
app.include_router(admin_router)

#TODO remove this endpoint later
# Legacy status endpoint (for backward compatibility with Electron)
@app.get("/api/status")
def status():
    return JSONResponse({"status": "Backend is running"})


@app.get("/", tags=["root"])
async def root():
    """Root endpoint providing API overview and system information."""
    return {
        "message": APP_NAME,
        "version": "2.0.0",
        "features": {
            "embeddings": "LangChain",
            "memory": "Mem0 (with fallback)",
            "database": "SQLite (SQLModel)",
            "vector_storage": "ChromaDB",
            "provider": PROVIDER,
            "streaming": True,
            "rag": True,
            "ocr": True,
            "json_processing": True,
            "persistence": True
        },
        "persistence": {
            "chat_history": "SQLite",
            "messages": "SQLite", 
            "document_metadata": "SQLite",
            "document_files": "Temporary (cleaned after processing)",
            "embeddings": "ChromaDB",
            "memories": "Mem0 (ChromaDB)"
        },
        "endpoints": {
            "status": "/api/status",
            "health": "/api/health",
            "chat_stream": "/api/chat/stream",
            "documents_upload": "/documents/upload",
            "users_create": "/api/users/create",
            "user_by_username": "/api/users/{username}",
            "chats": "/api/chats/{user_id}",
            "chats_create": "/api/chats/create",
            "chat_detail": "/api/chats/detail/{chat_id}"
        }
    }


if __name__ == "__main__":
    logger.info("Starting FastAPI server on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
    # For development with hot reload:
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

