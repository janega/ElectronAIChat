# app/routes/llamacpp_api.py
"""
Internal OpenAI-compatible API endpoints for LlamaCpp.

These endpoints wrap llama-cpp-python in OpenAI-compatible format,
enabling Mem0 to use llamacpp through custom provider registration.

Only exposed internally - not registered with FastAPI app by default.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger("chat_backend.llamacpp_api")

router = APIRouter(prefix="/v1", tags=["llamacpp-internal"])


class CompletionRequest(BaseModel):
    """OpenAI-compatible completion request"""
    prompt: str
    model: Optional[str] = "llamacpp"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 256
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 40
    stop: Optional[List[str]] = None


class CompletionChoice(BaseModel):
    text: str
    index: int
    finish_reason: str


class CompletionResponse(BaseModel):
    """OpenAI-compatible completion response"""
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[CompletionChoice]


class EmbeddingRequest(BaseModel):
    """OpenAI-compatible embedding request"""
    input: str | List[str]
    model: Optional[str] = "llamacpp-embed"


class EmbeddingData(BaseModel):
    object: str = "embedding"
    embedding: List[float]
    index: int


class EmbeddingResponse(BaseModel):
    """OpenAI-compatible embedding response"""
    object: str = "list"
    data: List[EmbeddingData]
    model: str


@router.post("/completions", response_model=CompletionResponse)
async def create_completion(request: CompletionRequest):
    """
    OpenAI-compatible completions endpoint using llamacpp.
    
    Used internally by Mem0 custom provider registration.
    """
    try:
        from app.routes.dependencies import get_llamacpp_client
        
        llamacpp_client = get_llamacpp_client()
        if llamacpp_client is None:
            raise HTTPException(status_code=503, detail="LlamaCpp client not initialized")
        
        # Get chat LLM
        llm = llamacpp_client.get_chat_llm()
        
        # Generate completion
        response = llm(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            stop=request.stop or [],
            stream=False,
        )
        
        # Extract completion text
        text = response.get("choices", [{}])[0].get("text", "")
        
        import time
        return CompletionResponse(
            id=f"cmpl-{int(time.time())}",
            created=int(time.time()),
            model="llamacpp",
            choices=[
                CompletionChoice(
                    text=text,
                    index=0,
                    finish_reason="stop"
                )
            ]
        )
        
    except Exception as e:
        logger.exception("Completion request failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """
    OpenAI-compatible embeddings endpoint using llamacpp.
    
    Used internally by Mem0 custom provider registration.
    """
    try:
        from app.routes.dependencies import get_llamacpp_client
        
        llamacpp_client = get_llamacpp_client()
        if llamacpp_client is None:
            raise HTTPException(status_code=503, detail="LlamaCpp client not initialized")
        
        # Handle single string or list
        texts = [request.input] if isinstance(request.input, str) else request.input
        
        # Get embeddings
        embeddings = await llamacpp_client.create_embeddings(texts)
        
        # Format response
        data = [
            EmbeddingData(
                embedding=emb,
                index=idx
            )
            for idx, emb in enumerate(embeddings)
        ]
        
        return EmbeddingResponse(
            data=data,
            model="llamacpp-embed"
        )
        
    except Exception as e:
        logger.exception("Embedding request failed")
        raise HTTPException(status_code=500, detail=str(e))
