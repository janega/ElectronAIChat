# app/openai_client.py
"""
LLM chat completion client supporting Ollama and OpenAI providers.

Architecture:
- Ollama: Uses langchain-ollama for native Ollama integration
- OpenAI: Uses langchain-openai for API compatibility
- Streaming: Both providers support streaming via SSE
"""
from typing import List, Dict, Any, AsyncGenerator
import logging

from .config import OPENAI_API_KEY, PROVIDER, OLLAMA_HOST, DEFAULT_OLLAMA_LLM_MODEL

logger = logging.getLogger("chat_backend.openai_client")

# Import LLM providers with graceful error handling
try:
    from langchain_ollama import ChatOllama
except ImportError:
    ChatOllama = None
    logger.warning("langchain-ollama not available. Install: pip install langchain-ollama")

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None
    logger.warning("langchain-openai not available. Install: pip install langchain-openai")

class EnhancedOpenAIClient:
    """
    LLM chat completion client with support for streaming.
    
    Supports:
    - Ollama: Local LLM via langchain-ollama (ChatOllama)
    - OpenAI: Cloud LLM via langchain-openai (ChatOpenAI)
    - Streaming: Both providers support token streaming
    
    Yields small dicts with keys:
    - token (str): The token content
    - done (bool): Whether generation is complete
    """
    
    def __init__(self, base_url: str = None, api_key: str = None, provider: str = None):
        """
        Initialize client for the specified provider.
        
        Args:
            base_url: Ollama base URL (e.g., http://localhost:11434)
            api_key: OpenAI API key or "ollama" for local
            provider: Override provider detection ("ollama" or "openai")
        """
        self.base_url = base_url
        self.api_key = api_key
        self.provider = provider or PROVIDER
        self.llm = self._initialize_llm()
        logger.info(f"LLM Client initialized with provider: {self.provider}")

    def _initialize_llm(self):
        """
        Initialize LLM based on configured provider.
        
        Returns LangChain LLM instance:
        - Ollama: ChatOllama for local models
        - OpenAI: ChatOpenAI for API
        """
        if self.provider == "ollama":
            if ChatOllama is None:
                raise RuntimeError(
                    "ChatOllama not available. "
                    "Install with: pip install langchain-ollama"
                )
            logger.info(f"Using Ollama LLM at {self.base_url or OLLAMA_HOST}")
            return ChatOllama(
                base_url=self.base_url or OLLAMA_HOST,
                model=DEFAULT_OLLAMA_LLM_MODEL,
                temperature=0.7,
                num_ctx=2048  # Context window size
            )
        
        elif self.provider == "openai":
            if ChatOpenAI is None:
                raise RuntimeError(
                    "ChatOpenAI not available. "
                    "Install with: pip install langchain-openai"
                )
            logger.info("Using OpenAI LLM")
            return ChatOpenAI(
                api_key=self.api_key or OPENAI_API_KEY,
                model="gpt-3.5-turbo",
                temperature=0.7,
                max_tokens=2048
            )
        
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

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
        Stream chat completions from the LLM.
        
        Args:
            model: Model name (used for compatibility, actual model set in init)
            messages: List of message dicts with 'role' and 'content'
            temperature: Creativity level (0.0-1.0)
            max_tokens: Maximum response length
            top_p: Nucleus sampling parameter (0.0-1.0)
            top_k: Token filtering parameter (Ollama only)
            stream: Whether to stream tokens
            **kwargs: Additional parameters
            
        Yields:
            Dict with 'token' (str) and 'done' (bool) keys
        """
        try:
            # Update LLM parameters dynamically for this request
            self.llm.temperature = temperature
            
            if self.provider == "ollama":
                # Ollama supports both top_p and top_k
                self.llm.top_p = top_p
                self.llm.top_k = top_k
                logger.debug(f"Ollama params: temp={temperature}, top_p={top_p}, top_k={top_k}, max_tokens={max_tokens}")
            elif self.provider == "openai":
                # OpenAI only supports top_p, not top_k
                self.llm.top_p = top_p
                logger.debug(f"OpenAI params: temp={temperature}, top_p={top_p}, max_tokens={max_tokens} (top_k not supported)")
            
            # Set max_tokens (different attribute names for different providers)
            if hasattr(self.llm, 'max_tokens'):
                self.llm.max_tokens = max_tokens
            elif hasattr(self.llm, 'num_predict'):
                self.llm.num_predict = max_tokens  # Ollama uses num_predict
            
            if stream:
                # Use LangChain's astream method which yields AIMessageChunk objects
                async for chunk in self.llm.astream(messages):
                    # AIMessageChunk has a 'content' attribute with the token text
                    token = chunk.content if hasattr(chunk, 'content') else str(chunk)
                    if token:
                        yield {"token": token, "done": False}
                
                # Send final done signal
                yield {"token": "", "done": True}
            else:
                # Non-streaming mode
                response = await self.llm.ainvoke(messages)
                content = response.content if hasattr(response, 'content') else str(response)
                yield {"token": content, "done": True}
                
        except Exception as e:
            logger.exception("Chat completion failed")
            yield {"token": "", "done": True, "error": str(e)}
