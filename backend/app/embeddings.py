# app/embeddings.py
"""
Embeddings manager using LangChain with support for Ollama and OpenAI providers.

Architecture:
- Ollama: Uses langchain-ollama for native integration
- OpenAI: Falls back to langchain-openai
- Vector storage: ChromaDB for persistence and similarity search
"""
from typing import Dict, Any, List
from pathlib import Path
import logging

from fastapi.concurrency import run_in_threadpool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LangChainDocument

from .config import CHROMA_DIR, PROVIDER, OLLAMA_HOST, OPENAI_API_KEY, DEFAULT_OLLAMA_EMBED_MODEL
logger = logging.getLogger("chat_backend.embeddings")

# Import embeddings providers with graceful error handling
try:
    from langchain_ollama import OllamaEmbeddings
except ImportError:
    OllamaEmbeddings = None
    logger.warning("langchain-ollama not available. Install: pip install langchain-ollama")

try:
    from langchain_openai import OpenAIEmbeddings
except ImportError:
    OpenAIEmbeddings = None
    logger.warning("langchain-openai not available. Install: pip install langchain-openai")

try:
    from langchain_community.vectorstores import Chroma
except ImportError:
    Chroma = None
    logger.warning("chromadb/langchain-community not available. Install: pip install chromadb")

class LangChainEmbeddingManager:
    """
    Manages text embeddings and vector storage for RAG functionality.
    
    Supports:
    - Ollama: Local LLM with native langchain-ollama integration
    - OpenAI: Cloud-based embeddings with langchain-openai
    - Vector Store: ChromaDB for persistence and similarity search
    """
    
    def __init__(self, provider: str = "ollama"):
        self.provider = provider.lower()
        self.embeddings = self._initialize_embeddings()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        logger.info(f"Embeddings initialized with provider: {self.provider}")

    def _initialize_embeddings(self):
        """
        Initialize embeddings based on configured provider.
        
        Returns appropriate embedding model:
        - Ollama: Uses langchain-ollama for native integration
        - OpenAI: Uses langchain-openai for cloud embeddings
        - Fallback: Ollama if provider unknown
        """
        if self.provider == "ollama":
            if OllamaEmbeddings is None:
                raise RuntimeError(
                    "OllamaEmbeddings not available. "
                    "Install with: pip install langchain-ollama"
                )
            logger.info(f"Using Ollama embeddings at {OLLAMA_HOST}")
            return OllamaEmbeddings(
                base_url=OLLAMA_HOST,
                model=DEFAULT_OLLAMA_EMBED_MODEL
            )
        
        elif self.provider == "openai":
            if OpenAIEmbeddings is None:
                raise RuntimeError(
                    "OpenAIEmbeddings not available. "
                    "Install with: pip install langchain-openai"
                )
            logger.info("Using OpenAI embeddings")
            return OpenAIEmbeddings(
                api_key=OPENAI_API_KEY,
                model="text-embedding-3-small"
            )
        
        else:
            # Fallback to Ollama for unknown provider
            logger.warning(f"Unknown provider '{self.provider}', falling back to Ollama")
            if OllamaEmbeddings is None:
                raise RuntimeError(
                    "OllamaEmbeddings not available. "
                    "Install with: pip install langchain-ollama"
                )
            return OllamaEmbeddings(
                base_url=OLLAMA_HOST,
                model=DEFAULT_OLLAMA_EMBED_MODEL
            )

    def create_vectorstore(self, chat_id: str):
        """
        Create or open a Chroma vectorstore for the chat. Returns a Chroma instance.
        """
        if Chroma is None:
            raise RuntimeError("Chroma vectorstore is not available. Install langchain-community or chromadb.")
        persist_directory = str(Path(CHROMA_DIR) / chat_id)
        logger.info(f"Creating ChromaDB vectorstore at: {persist_directory}")
        # `collection_name` and `persist_directory` are common args; versions differ — this matches many langchain-chroma variants.
        try:
            vectorstore = Chroma(
                collection_name=f"chat_{chat_id}",
                embedding_function=self.embeddings,
                persist_directory=persist_directory
            )
            return vectorstore
        except TypeError:
            # try alternate interface
            try:
                vectorstore = Chroma(
                    embedding_function=self.embeddings,
                    persist_directory=persist_directory
                )
                return vectorstore
            except Exception as e:
                logger.error("Failed to initialize Chroma vectorstore: %s", e)
                raise

    async def add_document(self, chat_id: str, text: str, metadata: Dict[str, Any]):
        """
        Chunk text and add to vectorstore. Runs blocking operations in threadpool.
        Returns number of chunks added.
        """
        chunks = self.text_splitter.split_text(text)
        documents = [
            LangChainDocument(page_content=chunk, metadata={**metadata, "chunk_index": i})
            for i, chunk in enumerate(chunks)
        ]
        vectorstore = await run_in_threadpool(self.create_vectorstore, chat_id)
        # add_documents and persist are usually blocking
        try:
            await run_in_threadpool(vectorstore.add_documents, documents)
            await run_in_threadpool(vectorstore.persist)
        except Exception:
            logger.exception("Failed to add documents to vectorstore")
            raise
        return len(documents)

    async def search_documents(self, chat_id: str, query: str, k: int = 3):
        """
        Similarity search; runs in threadpool because Chroma calls are blocking.
        """
        vectorstore = await run_in_threadpool(self.create_vectorstore, chat_id)
        try:
            results = await run_in_threadpool(vectorstore.similarity_search_with_score, query, k)
        except Exception:
            logger.exception("Similarity search failed")
            raise
        return [
            {"content": doc.page_content, "metadata": doc.metadata, "score": float(score)}
            for doc, score in results
        ]
