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
    
    if PROVIDER == "ollama":
        logger.info(f"Ollama Host: {OLLAMA_HOST}")
        logger.info(f"Ollama LLM Model: {DEFAULT_OLLAMA_LLM_MODEL}")
        logger.info(f"Ollama Embed Model: {DEFAULT_OLLAMA_EMBED_MODEL}")
    else:
        logger.info(f"OpenAI LLM Model: {DEFAULT_OPENAI_LLM_MODEL}")
        logger.info(f"OpenAI Embed Model: {DEFAULT_OPENAI_EMBED_MODEL}")
    
    logger.info(f"Database: {DATABASE_PATH}")
    logger.info(f"ChromaDB: {BASE_DIR / 'chroma_db'}")
    logger.info(f"Upload Directory: {BASE_DIR / 'uploads'}")
    
    # Initialize database (create tables on startup)
    create_db_and_tables()
    
    # Initialize shared managers (single instances)
    langchain_manager = LangChainEmbeddingManager(provider=PROVIDER)
    mem0_manager = Mem0MemoryManager()
    
    # Initialize OpenAI client based on provider
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
    
    # Set up dependency injection for managers
    dependencies.set_managers(
        langchain_manager=langchain_manager,
        mem0_manager=mem0_manager,
        openai_client=openai_client
    )
    
    logger.info("All managers initialized successfully")
    logger.info("=" * 80)
    
    # Yield control to application (runs while app is active)
    yield
    
    # Shutdown: Cleanup resources
    logger.info("=" * 80)
    logger.info("ElectronAIChat Backend Shutting Down")
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

