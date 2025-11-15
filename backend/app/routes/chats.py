# app/routes/chats.py
"""
Chat management endpoints for frontend localStorage sync.
Handles chat thread creation, retrieval, updates, and deletion.
"""
from fastapi import APIRouter, HTTPException
from sqlmodel import select, col
from typing import List, Optional
from datetime import datetime, timezone

from app.database import Chat, ChatCreate, ChatResponse, ChatDetailResponse
from app.routes.dependencies import DBSession
from app.config import logger

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.post("/create", response_model=ChatResponse)
async def create_chat(chat_data: ChatCreate, session: DBSession):
    """Create a new chat thread for dual localStorage/SQLite storage."""
    try:
        from app.database import User
        user = session.get(User, chat_data.user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{chat_data.user_id}' not found")
        
        chat = Chat(user_id=chat_data.user_id, title=chat_data.title)
        session.add(chat)
        session.commit()
        session.refresh(chat)
        
        logger.info(f"Created chat: {chat.title} (ID: {chat.id}) for user: {chat_data.user_id}")
        
        return ChatResponse(
            id=chat.id,
            title=chat.title,
            search_mode=chat.search_mode,
            message_count=0,
            document_count=0,
            created_at=chat.created_at,
            updated_at=chat.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception("Failed to create chat")
        raise HTTPException(status_code=500, detail=f"Chat creation failed: {str(e)}")


@router.get("/{user_id}", response_model=List[ChatResponse])
async def get_user_chats(user_id: str, limit: int = 50, offset: int = 0, session: DBSession = None):
    """Get all chats for a user (for localStorage sync)."""
    try:
        chats = session.exec(
            select(Chat).where(Chat.user_id == user_id).order_by(col(Chat.updated_at).desc()).offset(offset).limit(limit)
        ).all()
        
        return [
            ChatResponse(
                id=chat.id,
                title=chat.title,
                search_mode=chat.search_mode,
                message_count=len(chat.messages),
                document_count=len(chat.documents),
                created_at=chat.created_at,
                updated_at=chat.updated_at,
                last_message=chat.messages[-1].content[:100] if chat.messages else None
            )
            for chat in chats
        ]
    except Exception as e:
        logger.exception("Failed to get user chats")
        raise HTTPException(status_code=500, detail=f"Chat retrieval failed: {str(e)}")


@router.get("/detail/{chat_id}", response_model=ChatDetailResponse)
async def get_chat_detail(chat_id: str, session: DBSession):
    """Get full chat with all messages and documents."""
    try:
        chat = session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID '{chat_id}' not found")
        
        return ChatDetailResponse(
            id=chat.id,
            title=chat.title,
            search_mode=chat.search_mode,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            messages=chat.messages,
            documents=chat.documents
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get chat detail")
        raise HTTPException(status_code=500, detail=f"Chat detail retrieval failed: {str(e)}")


@router.put("/{chat_id}")
async def update_chat(chat_id: str, title: Optional[str] = None, search_mode: Optional[str] = None, session: DBSession = None):
    """Update chat metadata (synced with localStorage)."""
    try:
        chat = session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID '{chat_id}' not found")
        
        updated_fields = []
        if title:
            chat.title = title
            updated_fields.append("title")
        if search_mode:
            if search_mode not in ["normal", "embeddings", "all"]:
                raise HTTPException(status_code=422, detail="search_mode must be: normal, embeddings, or all")
            chat.search_mode = search_mode
            updated_fields.append("search_mode")
        
        if not updated_fields:
            raise HTTPException(status_code=422, detail="No fields provided for update")
        
        chat.updated_at = datetime.now(timezone.utc)
        session.add(chat)
        session.commit()
        
        logger.info(f"Updated chat: {chat_id} ({', '.join(updated_fields)})")
        return {"success": True, "chat_id": chat_id, "updated_fields": updated_fields}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception("Failed to update chat")
        raise HTTPException(status_code=500, detail=f"Chat update failed: {str(e)}")


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, session: DBSession):
    """Delete a chat and cascade to messages/documents."""
    try:
        chat = session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID '{chat_id}' not found")
        
        message_count = len(chat.messages)
        document_count = len(chat.documents)
        
        session.delete(chat)
        session.commit()
        
        logger.info(f"Deleted chat: {chat_id} ({message_count} messages, {document_count} documents)")
        return {"success": True, "deleted": chat_id, "messages_deleted": message_count, "documents_deleted": document_count}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception("Failed to delete chat")
        raise HTTPException(status_code=500, detail=f"Chat deletion failed: {str(e)}")
