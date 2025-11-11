
from typing import List, Optional, Dict, Any
from fastapi.responses import StreamingResponse
from httpx import stream
import ollama
import json
from pydantic import BaseModel
from app.models.models import ChatMessage2, ChatRequest2, Document2

class ContextDoc(BaseModel):
    id: Optional[str] = None
    text: str
    score: Optional[float] = None

class ChatResponse(BaseModel):
    answer: str
    context: List[ContextDoc] = []
    
class ChatRequest(BaseModel):
    query: str
    key_prefixes: Optional[List[str]] = None
    top_k: int = 3

from .document_service import DocumentService

class ChatService:
    def __init__(self, redis_url: str, embed_model: str, chat_model: str, ollama_host: str = "http://localhost:11434"):
        self.chat_model = chat_model
        self.ollama_client = ollama.Client(host=ollama_host)
        self.doc_service = DocumentService(redis_url, embed_model, ollama_host)

    async def chat(self, request: ChatRequest,
                 ) -> ChatResponse:
        """Handle RAG-enhanced chat interactions."""
        try:
            # Get relevant context
            context_docs = self.doc_service.query_documents(
                key_prefixes=request.key_prefixes,
                query=request.query,
                top_k=request.top_k
            )
            
            # Format context for the prompt
            context = "\n\n".join(f"[{doc['key']}]: {doc['text']}" 
                                for doc in context_docs)

            # Prepare the chat prompt
            messages = [
                {
                    "role": "system", 
                    "content": ("You are a helpful assistant. Use the provided context "
                            "to answer questions accurately. If you cannot find "
                            "relevant information in the context, say so.")
                },
                {
                    "role": "user",
                    "content": f"Use this context:\n{context}\n\nQuestion: {request.query}"
                }
            ]

            # Get response from Ollama
            response = self.ollama_client.chat(model=self.chat_model,
                messages=messages, 
                stream=True)
            answer = response["message"]["content"]
            
            return ChatResponse(answer=answer, context=context_docs)
        except Exception as e:
            raise ValueError(f"Chat service error: {str(e)}")
        
    async def chat_stream(
        self,
        chatId: str,
        message: str,
        searchMode: str = "normal",
        documentIds: str = "",
        model: str = "mistral",
        temperature: float = 0.7,
        maxTokens: int = 2048,
        systemPrompt: str = "You are a helpful assistant."
    ):
        """
        Stream chat responses using Ollama Python library
        """
        
        async def generate():
            try:
                # Get document context
                #doc_context = search_documents(message, chatId, searchMode)
                doc_context = self.doc_service.query_documents(documentIds, message, top_k=3)
                # Prepare the prompt
                full_prompt = message
                if doc_context:
                    full_prompt = f"{doc_context}\n\nUser Question: {message}"
                
                # Build messages for chat
                messages = [
                    {"role": "system", "content": systemPrompt},
                    {"role": "user", "content": full_prompt}
                ]
                
                # Stream from Ollama using the Python library
                stream = self.ollama_client.chat(
                    model=model,
                    messages=messages,
                    stream=True,
                    options={
                        "temperature": temperature,
                        "num_predict": maxTokens,
                    }
                )
                
                # Convert Ollama stream format to our SSE format
                for chunk in stream:
                    # Ollama library returns chunks with 'message' -> 'content'
                    if 'message' in chunk and 'content' in chunk['message']:
                        token = chunk['message']['content']
                        done = chunk.get('done', False)
                        
                        # Format as SSE
                        sse_data = json.dumps({
                            "token": token,
                            "done": done
                        })
                        yield f"data: {sse_data}\n\n"
                        
                        if done:
                            break
                
                # Send final done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
            
            except Exception as e:
                error_data = json.dumps({
                    "error": str(e),
                    "done": True
                })
                yield f"data: {error_data}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )   