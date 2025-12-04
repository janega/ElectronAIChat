# app/routes/dependencies.py
"""
Dependency injection for shared managers and services.
Provides centralized access to initialized managers across routes.
"""
from typing import Annotated, Optional
from fastapi import Depends
from sqlmodel import Session
import logging

from app.embeddings import LangChainEmbeddingManager
from app.memory import Mem0MemoryManager
from app.openai_client import EnhancedOpenAIClient
from app.db_manager import get_session

logger = logging.getLogger("chat_backend.dependencies")

# Global manager instances - initialized in main.py
_langchain_manager: LangChainEmbeddingManager = None
_mem0_manager: Mem0MemoryManager = None
_openai_client: EnhancedOpenAIClient = None

# LlamaCpp-specific instances (lazy-loaded)
_llamacpp_client: Optional[object] = None
_llamacpp_embedding_manager: Optional[object] = None


def set_managers(
    langchain_manager: LangChainEmbeddingManager,
    mem0_manager: Mem0MemoryManager,
    openai_client: EnhancedOpenAIClient
):
    """Initialize the global manager instances. Called from main.py."""
    global _langchain_manager, _mem0_manager, _openai_client
    _langchain_manager = langchain_manager
    _mem0_manager = mem0_manager
    _openai_client = openai_client


def get_langchain_manager() -> LangChainEmbeddingManager:
    """
    Dependency to get the embedding manager based on provider.
    
    For llamacpp, returns the LlamaCppEmbeddingManager wrapped to be compatible.
    For ollama/openai, returns the standard LangChainEmbeddingManager.
    """
    from app.config import PROVIDER
    
    if PROVIDER == "llamacpp":
        # Return LlamaCpp embedding manager for llamacpp provider
        return get_llamacpp_embedding_manager()
    
    if _langchain_manager is None:
        raise RuntimeError("LangChain manager not initialized")
    return _langchain_manager


def get_mem0_manager() -> Mem0MemoryManager:
    """Dependency to get the Mem0 memory manager."""
    if _mem0_manager is None:
        raise RuntimeError("Mem0 manager not initialized")
    return _mem0_manager


def get_openai_client() -> EnhancedOpenAIClient:
    """
    Dependency to get the LLM client based on provider.
    
    For llamacpp, returns the LlamaCppClient.
    For ollama/openai, returns the standard EnhancedOpenAIClient.
    """
    from app.config import PROVIDER
    
    if PROVIDER == "llamacpp":
        # Return LlamaCpp client for llamacpp provider
        return get_llamacpp_client()
    
    if _openai_client is None:
        raise RuntimeError("OpenAI client not initialized")
    return _openai_client


def get_llamacpp_client():
    """
    Get or create LlamaCpp client singleton.
    
    Lazy-loads the LlamaCpp client on first use to avoid import errors
    if llama-cpp-python is not installed.
    """
    global _llamacpp_client
    
    if _llamacpp_client is None:
        from app.config import (
            LLAMACPP_MODELS_DIR,
            LLAMACPP_CHAT_MODEL,
            LLAMACPP_EMBED_MODEL,
            LLAMACPP_ENABLE_PARALLEL,
            LLAMACPP_N_CTX,
            LLAMACPP_VERBOSE,
            LLAMACPP_N_GPU_LAYERS,
        )
        
        try:
            from app.llamacpp_client import LlamaCppClient
            
            logger.info("Initializing LlamaCpp client...")
            
            _llamacpp_client = LlamaCppClient(
                chat_model_path=LLAMACPP_CHAT_MODEL,
                embedding_model_path=LLAMACPP_EMBED_MODEL,
                models_dir=str(LLAMACPP_MODELS_DIR),
                enable_parallel=LLAMACPP_ENABLE_PARALLEL,
                n_ctx=LLAMACPP_N_CTX,
                verbose=LLAMACPP_VERBOSE,
                n_gpu_layers=LLAMACPP_N_GPU_LAYERS
            )
            
            logger.info("LlamaCpp client initialized successfully")
            
        except ImportError as e:
            logger.error(f"Failed to import LlamaCpp client: {e}")
            raise RuntimeError(
                "LlamaCpp client not available. "
                "Install with: pip install llama-cpp-python"
            )
        except Exception as e:
            logger.error(f"Failed to initialize LlamaCpp client: {e}")
            raise
    
    return _llamacpp_client


def get_llamacpp_embedding_manager():
    """Get or create LlamaCpp embedding manager singleton."""
    global _llamacpp_embedding_manager
    
    if _llamacpp_embedding_manager is None:
        try:
            from app.llamacpp_client import LlamaCppEmbeddingManager
            
            client = get_llamacpp_client()
            _llamacpp_embedding_manager = LlamaCppEmbeddingManager(client)
            logger.info("LlamaCpp embedding manager initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize LlamaCpp embedding manager: {e}")
            raise
    
    return _llamacpp_embedding_manager


# Type aliases for cleaner dependency injection
LangChainManager = Annotated[LangChainEmbeddingManager, Depends(get_langchain_manager)]
Mem0Manager = Annotated[Mem0MemoryManager, Depends(get_mem0_manager)]
OpenAIClient = Annotated[EnhancedOpenAIClient, Depends(get_openai_client)]
DBSession = Annotated[Session, Depends(get_session)]
