# app/routes/dependencies.py
"""
Dependency injection for shared managers and services.
Provides centralized access to initialized managers across routes.
"""
from typing import Annotated
from fastapi import Depends
from sqlmodel import Session

from app.embeddings import LangChainEmbeddingManager
from app.memory import Mem0MemoryManager
from app.openai_client import EnhancedOpenAIClient
from app.db_manager import get_session

# Global manager instances - initialized in main.py
_langchain_manager: LangChainEmbeddingManager = None
_mem0_manager: Mem0MemoryManager = None
_openai_client: EnhancedOpenAIClient = None


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
    """Dependency to get the LangChain embedding manager."""
    if _langchain_manager is None:
        raise RuntimeError("LangChain manager not initialized")
    return _langchain_manager


def get_mem0_manager() -> Mem0MemoryManager:
    """Dependency to get the Mem0 memory manager."""
    if _mem0_manager is None:
        raise RuntimeError("Mem0 manager not initialized")
    return _mem0_manager


def get_openai_client() -> EnhancedOpenAIClient:
    """Dependency to get the OpenAI client."""
    if _openai_client is None:
        raise RuntimeError("OpenAI client not initialized")
    return _openai_client


# Type aliases for cleaner dependency injection
LangChainManager = Annotated[LangChainEmbeddingManager, Depends(get_langchain_manager)]
Mem0Manager = Annotated[Mem0MemoryManager, Depends(get_mem0_manager)]
OpenAIClient = Annotated[EnhancedOpenAIClient, Depends(get_openai_client)]
DBSession = Annotated[Session, Depends(get_session)]
