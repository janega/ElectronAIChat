from typing import List, Optional
from pydantic import BaseModel


class ChatMessage2(BaseModel):
    role: str
    content: str

class ChatRequest2(BaseModel):
    messages: List[ChatMessage2]
    model: str = "mistral"
    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: Optional[str] = None

class Document2(BaseModel):
    id: str
    name: str
    size: int
    content_type: str
    uploaded_at: str
    chat_id: str
    content: Optional[str] = None
