# app/database.py
"""
SQLModel database models for persistent storage.

Defines tables for:
- Users: User accounts
- UserSettings: Per-user LLM and app preferences
- Chat: Conversation threads
- Message: Individual chat messages
- Document: Uploaded document metadata

All models use SQLModel (combines Pydantic validation + SQLAlchemy ORM).
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid


# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(SQLModel, table=True):
    """User account model"""
    __tablename__ = "users"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    username: str = Field(unique=True, index=True)
    email: Optional[str] = Field(default=None, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    
    # Relationships
    chats: List["Chat"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    settings: Optional["UserSettings"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class UserSettings(SQLModel, table=True):
    """User settings for LLM and app preferences"""
    __tablename__ = "user_settings"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True, index=True)
    
    # LLM Settings
    default_model: str = Field(default="llama2")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=40, ge=1, le=100)
    system_prompt: str = Field(default="You are a helpful assistant.")
    
    # App Settings
    theme: str = Field(default="light")  # light or dark
    use_memory: bool = Field(default=True)
    use_mcp: bool = Field(default=True)
    
    updated_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    
    # Relationships
    user: User = Relationship(back_populates="settings")


class Chat(SQLModel, table=True):
    """Chat conversation thread"""
    __tablename__ = "chats"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    
    title: str = Field(default="New Chat")
    search_mode: str = Field(default="normal")  # normal, embeddings, all
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    
    # Relationships
    user: User = Relationship(back_populates="chats")
    messages: List["Message"] = Relationship(
        back_populates="chat",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    documents: List["Document"] = Relationship(
        back_populates="chat",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Message(SQLModel, table=True):
    """Individual message in a chat"""
    __tablename__ = "messages"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    chat_id: str = Field(foreign_key="chats.id", index=True)
    
    role: str = Field(...)  # user, assistant, system
    content: str = Field(...)
    search_mode: Optional[str] = Field(default=None)
    
    # Metadata
    model_used: Optional[str] = Field(default=None)
    tokens_used: Optional[int] = Field(default=None)
    response_time: Optional[float] = Field(default=None)  # seconds
    sources: Optional[str] = Field(default=None)  # JSON string of document sources used in RAG
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    
    # Relationships
    chat: Chat = Relationship(back_populates="messages")


class Document(SQLModel, table=True):
    """Uploaded/accessed document metadata"""
    __tablename__ = "documents"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    chat_id: str = Field(foreign_key="chats.id", index=True)
    
    name: str = Field(...)
    file_path: Optional[str] = Field(default=None)
    source: str = Field(default="upload")  # upload, mcp_filesystem, mcp_github
    content_type: Optional[str] = Field(default=None)
    size: Optional[int] = Field(default=None)
    
    # Metadata
    source_metadata: Optional[str] = Field(default=None)  # JSON string
    chunks_count: int = Field(default=0)
    
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC))
    
    # Relationships
    chat: Chat = Relationship(back_populates="documents")


# ============================================================================
# PYDANTIC MODELS (for API requests/responses)
# ============================================================================

class UserCreate(SQLModel):
    """Request model for creating a user"""
    username: str
    email: Optional[str] = None


class UserResponse(SQLModel):
    """Response model for user data"""
    id: str
    username: str
    email: Optional[str]
    created_at: datetime
    total_chats: int = 0


class SettingsUpdate(SQLModel):
    """Request model for updating settings"""
    default_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    system_prompt: Optional[str] = None
    theme: Optional[str] = None
    use_memory: Optional[bool] = None
    use_mcp: Optional[bool] = None


class ChatCreate(SQLModel):
    """Request model for creating a chat"""
    user_id: str
    title: str = "New Chat"


class ChatResponse(SQLModel):
    """Response model for chat summary"""
    id: str
    title: str
    search_mode: str
    message_count: int
    document_count: int
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None


class MessageResponse(SQLModel):
    """Response model for message with parsed sources"""
    id: str
    chat_id: str
    role: str
    content: str
    search_mode: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    response_time: Optional[float] = None
    created_at: datetime
    sources: Optional[List[dict]] = None  # Parsed from JSON string
    
    @classmethod
    def from_message(cls, message: "Message"):
        """Convert Message model to response with parsed sources"""
        import json
        sources_parsed = None
        if message.sources:
            try:
                sources_parsed = json.loads(message.sources)
            except:
                pass
        
        return cls(
            id=message.id,
            chat_id=message.chat_id,
            role=message.role,
            content=message.content,
            search_mode=message.search_mode,
            model_used=message.model_used,
            tokens_used=message.tokens_used,
            response_time=message.response_time,
            created_at=message.created_at,
            sources=sources_parsed
        )


class ChatDetailResponse(SQLModel):
    """Response model for full chat with messages"""
    id: str
    title: str
    search_mode: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]
    documents: List[Document]


class MessageCreate(SQLModel):
    """Request model for creating a message"""
    chat_id: str
    role: str
    content: str
    search_mode: Optional[str] = None
    model_used: Optional[str] = None
