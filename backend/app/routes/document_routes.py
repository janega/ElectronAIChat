from datetime import datetime
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Optional
from fastapi.responses import StreamingResponse
from ollama import ChatResponse
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
import tempfile
from app.models.models import ChatMessage2, ChatRequest2, Document2

from app.services.document_service import DocumentService
from app.services.chat_service import ChatService

router = APIRouter()
document_service = None  # Will be initialized when setting up the router


# In-memory storage
documents_db = {}
chats_db = {}


class ChatRequest(BaseModel):
    query: str
    key_prefixes: Optional[List[str]] = None
    top_k: int = 3

class SearchResult(BaseModel):
    text: str
    similarity: float
    key: str
    
class ContextDoc(BaseModel):
    id: Optional[str] = None
    text: str
    score: Optional[float] = None

class ChatResponse(BaseModel):
    answer: str
    context: List[ContextDoc] = []

@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    allow_ocr: bool = Query(False, description="Enable OCR for PDF files")
):
    """Upload and process a document (PDF or JSON)."""
    if file.filename.lower().endswith(('.pdf', '.json')):
        # Create a temporary file to store the upload
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            key_prefix = document_service.load_or_build_vectors(tmp_path, allow_ocr)
            return {"message": "Document processed successfully", "key_prefix": key_prefix}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        finally:
            os.unlink(tmp_path)  # Clean up the temporary file
    else:
        raise HTTPException(status_code=400, detail="Only PDF and JSON files are supported")

@router.post("/query", response_model=List[SearchResult])
async def query_documents(request: ChatRequest):
    """Query processed documents."""
    try:
        results = document_service.query_documents(
            request.key_prefixes,
            request.query,
            request.top_k
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """RAG-enhanced chat endpoint."""
    try:
        response: ChatResponse = await chat_service.chat(request)        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/chat/create")
async def create_chat(chat_data: dict):
    """Create a new chat"""
    import uuid
    chat_id = str(uuid.uuid4())
    chat = {
        "id": chat_id,
        "title": chat_data.get("title", "New Chat"),
        "messages": [],
        "documents": [],
        "created_at": datetime.now(datetime.timezone.utc).isoformat(),
        "updated_at": datetime.now(datetime.timezone.utc).isoformat()
    }
    chats_db[chat_id] = chat
    return {"success": True, "chat": chat}

@router.get("/api/chat/stream")
async def chat_stream(
    chatId: str = Query(..., description="Chat ID"),
    message: str = Query(..., description="User message"),
    searchMode: str = Query("normal", description="Search mode for documents"),
    documentIds: str = Query("", description="Comma-separated document IDs"),
    model: str = Query("mistral", description="Model to use for chat"),
    temperature: float = Query(0.7, description="Temperature for generation"),
    maxTokens: int = Query(2048, description="Maximum tokens to generate"),
    systemPrompt: str = Query("You are a helpful assistant.", description="System prompt")
):
    """
    Stream chat responses using Ollama
    """
    return await chat_service.chat_stream(
        chatId=chatId,
        message=message,
        searchMode=searchMode,
        documentIds=documentIds,
        model=model,
        temperature=temperature,
        maxTokens=maxTokens,
        systemPrompt=systemPrompt
    )

def init_router(redis_url: str, embed_model: str, chat_model: str, ollama_host: str):
    """Initialize the router with services."""
    global document_service, chat_service
    document_service = DocumentService(redis_url, embed_model, ollama_host)
    chat_service = ChatService(redis_url, embed_model, chat_model, ollama_host)
    return router