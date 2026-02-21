# app/llamacpp_client.py
"""
LlamaCpp Provider for FastAPI Backend

Provides local LLM inference using llama-cpp-python with GGUF models.
Supports both chat completions and embeddings for RAG functionality.

Features:
- Auto-detects GPU availability (CUDA/Metal)
- Compatible with EnhancedOpenAIClient interface
- Native GGUF model support
- Efficient memory usage with quantized models
"""
from typing import List, Dict, Any, AsyncGenerator, Optional
import logging
from pathlib import Path
import asyncio
from functools import partial

logger = logging.getLogger("chat_backend.llamacpp_client")

# Import llama-cpp-python with graceful error handling
try:
    from llama_cpp import Llama
    LLAMACPP_AVAILABLE = True
except ImportError:
    Llama = None
    LLAMACPP_AVAILABLE = False
    logger.warning("llama-cpp-python not available. Install with: pip install llama-cpp-python")


class LlamaCppClient:
    """
    LlamaCpp-based LLM client for chat completions.
    
    Provides async streaming interface compatible with EnhancedOpenAIClient.
    Auto-detects GPU and loads quantized GGUF models efficiently.
    
    Yields dicts with keys:
    - token (str): The token content
    - done (bool): Whether generation is complete
    """
    
    def __init__(
        self,
        chat_model_path: str,
        embedding_model_path: str,
        models_dir: str = "./models",
        enable_parallel: bool = False,
        n_ctx: int = 2048,
        n_gpu_layers: Optional[int] = None,
        verbose: bool = False
    ):
        """
        Initialize LlamaCpp client with chat and embedding models.
        
        Args:
            chat_model_path: Filename of chat model GGUF file
            embedding_model_path: Filename of embedding model GGUF file
            models_dir: Directory containing GGUF model files
            enable_parallel: Enable parallel processing (experimental)
            n_ctx: Context window size
            n_gpu_layers: GPU layers to offload (-1 for all, None for auto-detect)
            verbose: Enable verbose logging from llama.cpp
        """
        if not LLAMACPP_AVAILABLE:
            raise RuntimeError(
                "llama-cpp-python not installed. "
                "Install with: pip install llama-cpp-python"
            )
        
        self.models_dir = Path(models_dir)
        self.chat_model_path = self.models_dir / chat_model_path
        self.embedding_model_path = self.models_dir / embedding_model_path
        self.enable_parallel = enable_parallel
        self.n_ctx = n_ctx
        self.verbose = verbose
        
        # Auto-detect GPU layers if not specified
        if n_gpu_layers is None:
            self.n_gpu_layers = self._detect_gpu_layers()
        else:
            self.n_gpu_layers = n_gpu_layers
        
        # Initialize models
        self._chat_llm = None
        self._embedding_llm = None
        
        logger.info(
            f"LlamaCpp Client initialized:\n"
            f"  Chat model: {self.chat_model_path}\n"
            f"  Embedding model: {self.embedding_model_path}\n"
            f"  GPU layers: {self.n_gpu_layers}\n"
            f"  Parallel mode: {self.enable_parallel}\n"
            f"  Context window: {self.n_ctx}"
        )
    
    def _detect_gpu_layers(self) -> int:
        """
        Auto-detect optimal GPU layer count.
        
        Returns:
            -1 for full GPU offload if GPU detected, 0 for CPU-only
        """
        try:
            import torch
            if torch.cuda.is_available():
                logger.info("CUDA GPU detected - enabling full GPU offload")
                return -1
        except ImportError:
            pass
        
        try:
            import platform
            if platform.system() == "Darwin" and platform.processor() == "arm":
                logger.info("Apple Silicon detected - enabling Metal GPU offload")
                return -1
        except Exception:
            pass
        
        logger.info("No GPU detected - using CPU-only mode")
        return 0
    
    def _get_chat_llm(self) -> Llama:
        """
        Lazy-load chat model on first use (internal).
        
        Returns:
            Initialized Llama instance for chat completions
        """
        if self._chat_llm is None:
            if not self.chat_model_path.exists():
                raise FileNotFoundError(
                    f"Chat model not found: {self.chat_model_path}\n"
                    f"Run: python scripts/download_models.py"
                )
            
            logger.info(f"Loading chat model: {self.chat_model_path}")
            self._chat_llm = Llama(
                model_path=str(self.chat_model_path),
                n_ctx=self.n_ctx,
                n_gpu_layers=self.n_gpu_layers,
                verbose=self.verbose,
                n_threads=None,  # Auto-detect optimal threads
            )
            logger.info("Chat model loaded successfully")
        
        return self._chat_llm
    
    def get_chat_llm(self) -> Llama:
        """
        Public API to get chat LLM instance.
        
        Returns:
            Initialized Llama instance for chat completions
        """
        return self._get_chat_llm()
    
    def _get_embedding_llm(self) -> Llama:
        """
        Lazy-load embedding model on first use.
        
        Returns:
            Initialized Llama instance for embeddings
        """
        if self._embedding_llm is None:
            if not self.embedding_model_path.exists():
                raise FileNotFoundError(
                    f"Embedding model not found: {self.embedding_model_path}\n"
                    f"Run: python scripts/download_models.py"
                )
            
            logger.info(f"Loading embedding model: {self.embedding_model_path}")
            self._embedding_llm = Llama(
                model_path=str(self.embedding_model_path),
                n_ctx=self.n_ctx,
                n_gpu_layers=self.n_gpu_layers,
                embedding=True,  # Enable embedding mode
                verbose=self.verbose,
            )
            logger.info("Embedding model loaded successfully")
        
        return self._embedding_llm
    
    def _format_messages_for_llamacpp(self, messages: List[Dict[str, str]]) -> str:
        """
        Convert OpenAI-style messages to a single prompt string using ChatML format.
        
        Qwen models are trained on ChatML tokens (<|im_start|> / <|im_end|>).
        Using the correct format is critical - wrong format causes repetition loops
        because the model never sees a familiar end-of-turn signal.
        
        Args:
            messages: List of dicts with 'role' and 'content' keys
            
        Returns:
            Formatted prompt string in ChatML format
        """
        prompt_parts = []
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
        
        # Add opening tag for assistant turn - model fills in the rest and closes with <|im_end|>
        prompt_parts.append("<|im_start|>assistant\n")
        
        return "\n".join(prompt_parts)
    
    async def create_chat_completion(
        self,
        model: str,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float = 0.9,
        top_k: int = 40,
        stream: bool = True,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat completions from LlamaCpp.
        
        Compatible with EnhancedOpenAIClient interface.
        
        Args:
            model: Model name (ignored - uses initialized chat model)
            messages: List of message dicts with 'role' and 'content'
            temperature: Creativity level (0.0-1.0)
            max_tokens: Maximum response length
            top_p: Nucleus sampling parameter
            top_k: Token filtering parameter
            stream: Whether to stream tokens (always True for llamacpp)
            **kwargs: Additional parameters (ignored)
            
        Yields:
            Dict with 'token' (str) and 'done' (bool) keys
        """
        try:
            llm = self._get_chat_llm()
            
            # Format messages for llamacpp
            prompt = self._format_messages_for_llamacpp(messages)
            
            logger.debug(f"LlamaCpp params: temp={temperature}, top_p={top_p}, top_k={top_k}, max_tokens={max_tokens}")
            
            # Run generation in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create generator in thread pool
            def generate_sync():
                """Synchronous generator for llama.cpp"""
                try:
                    response_stream = llm(
                        prompt,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        top_k=top_k,
                        repeat_penalty=1.3,   # Penalize repetition - small models (0.6B) need 1.3+ to avoid loops
                        stream=True,
                        stop=[
                            "<|im_end|>",        # Qwen/ChatML native end-of-turn token (primary)
                            "<|endoftext|>",     # Qwen native EOS token
                            "<|im_start|>",      # Prevent model generating next turn itself
                        ],
                    )
                    
                    for chunk in response_stream:
                        # Extract token from response
                        token = chunk.get("choices", [{}])[0].get("text", "")
                        if token:
                            yield token
                            
                except Exception as e:
                    logger.exception("Generation failed in sync thread")
                    raise
            
            # Stream tokens from thread pool
            gen = generate_sync()
            while True:
                try:
                    # Get next token from sync generator in thread pool
                    token = await loop.run_in_executor(None, next, gen, None)
                    
                    if token is None:
                        # Generator exhausted
                        break
                    
                    yield {"token": token, "done": False}
                    
                except StopIteration:
                    break
                except Exception as e:
                    logger.exception("Token streaming failed")
                    yield {"token": "", "done": True, "error": str(e)}
                    return
            
            # Send final done signal
            yield {"token": "", "done": True}
            
        except Exception as e:
            logger.exception("Chat completion initialization failed")
            yield {"token": "", "done": True, "error": str(e)}
    
    async def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors (each is a list of floats)
        """
        try:
            llm = self._get_embedding_llm()
            
            logger.debug(f"Generating embeddings for {len(texts)} texts")
            
            # Run embedding generation in thread pool
            loop = asyncio.get_event_loop()
            
            def embed_sync():
                """Synchronous embedding generation"""
                embeddings = []
                for text in texts:
                    embedding = llm.embed(text)
                    embeddings.append(embedding)
                return embeddings
            
            embeddings = await loop.run_in_executor(None, embed_sync)
            
            logger.debug(f"Generated {len(embeddings)} embeddings")
            return embeddings
            
        except Exception as e:
            logger.exception("Embedding generation failed")
            raise
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded models.
        
        Returns:
            Dict with model paths, status, and configuration
        """
        return {
            "provider": "llamacpp",
            "chat_model": {
                "path": str(self.chat_model_path),
                "loaded": self._chat_llm is not None,
                "exists": self.chat_model_path.exists(),
            },
            "embedding_model": {
                "path": str(self.embedding_model_path),
                "loaded": self._embedding_llm is not None,
                "exists": self.embedding_model_path.exists(),
            },
            "gpu_layers": self.n_gpu_layers,
            "parallel_mode": self.enable_parallel,
            "context_window": self.n_ctx,
        }


class LlamaCppEmbeddingManager:
    """
    Embedding manager compatible with LangChainEmbeddingManager interface.
    
    Wraps LlamaCppClient for use in RAG pipelines and ChromaDB integration.
    Implements the same interface as LangChainEmbeddingManager for seamless provider switching.
    """
    
    def __init__(self, client: LlamaCppClient):
        """
        Initialize embedding manager with LlamaCpp client.
        
        Args:
            client: Initialized LlamaCppClient instance
        """
        self.client = client
        self.provider = "llamacpp"
        
        # Create embeddings wrapper for ChromaDB compatibility
        self.embeddings = LlamaCppEmbeddingFunction(client)
        
        # Text splitter (same as LangChainEmbeddingManager)
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=500,
                chunk_overlap=50,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
        except ImportError:
            logger.warning("langchain-text-splitters not available")
            self.text_splitter = None
        
        logger.info("LlamaCpp embedding manager initialized")
    
    def create_vectorstore(self, chat_id: str):
        """
        Create or open a Chroma vectorstore for the chat.
        
        Compatible with LangChainEmbeddingManager interface.
        
        Args:
            chat_id: Chat identifier for the collection
            
        Returns:
            Chroma vectorstore instance
        """
        try:
            from langchain_community.vectorstores import Chroma
            from pathlib import Path
            from app.config import CHROMA_DIR
        except ImportError:
            raise RuntimeError("Chroma vectorstore not available. Install chromadb.")
        
        persist_directory = str(Path(CHROMA_DIR) / chat_id)
        logger.info(f"Creating ChromaDB vectorstore at: {persist_directory}")
        
        try:
            vectorstore = Chroma(
                collection_name=f"chat_{chat_id}",
                embedding_function=self.embeddings,
                persist_directory=persist_directory
            )
            return vectorstore
        except TypeError:
            # Fallback for alternate interface
            vectorstore = Chroma(
                embedding_function=self.embeddings,
                persist_directory=persist_directory
            )
            return vectorstore
    
    async def add_document(self, chat_id: str, text: str, metadata: Dict[str, Any]) -> int:
        """
        Chunk text and add to vectorstore.
        
        Compatible with LangChainEmbeddingManager interface.
        
        Args:
            chat_id: Chat identifier
            text: Document text to add
            metadata: Document metadata
            
        Returns:
            Number of chunks added
        """
        from fastapi.concurrency import run_in_threadpool
        from langchain_core.documents import Document as LangChainDocument
        
        if self.text_splitter is None:
            raise RuntimeError("Text splitter not available")
        
        chunks = self.text_splitter.split_text(text)
        documents = [
            LangChainDocument(page_content=chunk, metadata={**metadata, "chunk_index": i})
            for i, chunk in enumerate(chunks)
        ]
        
        vectorstore = await run_in_threadpool(self.create_vectorstore, chat_id)
        
        try:
            await run_in_threadpool(vectorstore.add_documents, documents)
            await run_in_threadpool(vectorstore.persist)
        except Exception:
            logger.exception("Failed to add documents to vectorstore")
            raise
        
        return len(documents)
    
    async def search_documents(self, chat_id: str, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """
        Similarity search in vectorstore.
        
        Compatible with LangChainEmbeddingManager interface.
        
        Args:
            chat_id: Chat identifier
            query: Search query
            k: Number of results to return
            
        Returns:
            List of search results with content, metadata, and score
        """
        from fastapi.concurrency import run_in_threadpool
        
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
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of text strings
            
        Returns:
            List of embedding vectors
        """
        return await self.client.create_embeddings(texts)
    
    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a single query.
        
        Args:
            query: Query text string
            
        Returns:
            Embedding vector
        """
        embeddings = await self.client.create_embeddings([query])
        return embeddings[0] if embeddings else []
    
    def get_info(self) -> Dict[str, Any]:
        """Get embedding model information."""
        return {
            "provider": "llamacpp",
            "model": self.client.get_model_info()["embedding_model"],
        }


class LlamaCppEmbeddingFunction:
    """
    Embedding function wrapper for ChromaDB compatibility.
    
    ChromaDB expects a callable with __call__ method that takes a list of texts
    and returns a list of embeddings.
    """
    
    def __init__(self, client: LlamaCppClient):
        """
        Initialize embedding function with LlamaCpp client.
        
        Args:
            client: Initialized LlamaCppClient instance
        """
        self.client = client
    
    def __call__(self, texts: List[str]) -> List[List[float]]:
        """
        Synchronous embedding generation for ChromaDB.
        
        ChromaDB calls this synchronously, so we need to run async code in sync context.
        
        Args:
            texts: List of text strings
            
        Returns:
            List of embedding vectors
        """
        import asyncio
        
        # Run async embedding generation in sync context
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self.client.create_embeddings(texts))
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """LangChain embeddings interface - embed multiple documents."""
        return self(texts)
    
    def embed_query(self, text: str) -> List[float]:
        """LangChain embeddings interface - embed single query."""
        return self([text])[0]
