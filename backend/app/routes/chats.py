# app/routes/chats.py
"""
Chat management endpoints for frontend localStorage sync.
Handles chat thread creation, retrieval, updates, and deletion.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlmodel import select, col
from typing import List, Optional
from datetime import datetime, timezone

from app.database import Chat, ChatCreate, ChatResponse, ChatDetailResponse
from app.routes.dependencies import DBSession, OpenAIClient, get_session
from app.config import logger

router = APIRouter(prefix="/api/chats", tags=["chats"])


async def generate_title_background(chat_id: str, openai_client: OpenAIClient):
    """Background task to generate chat title based on conversation history."""
    session = None
    try:
        logger.info(f"[Title Gen] Starting title generation for chat {chat_id}")
        session = next(get_session())
        chat = session.get(Chat, chat_id)
        
        if not chat or len(chat.messages) < 2:
            logger.debug(f"[Title Gen] Skip for chat {chat_id}: insufficient messages (found {len(chat.messages) if chat else 0})")
            return
        
        # Only generate if still using default title
        if chat.title != "New Chat":
            logger.debug(f"[Title Gen] Skip for chat {chat_id}: title already set to '{chat.title}'")
            return
        
        # Build conversation context (limit to first 4 messages for speed)
        messages_for_context = chat.messages[:4]
        conversation = "\n".join([
            f"{msg.role}: {msg.content[:200]}"  # Truncate long messages
            for msg in messages_for_context
        ])
        
        # Strict prompt for title generation
        title_prompt = f"""Based on this conversation, generate a concise title (max 6 words, no quotes):

{conversation}

Title:"""
        
        # Use the currently active model (runtime-switchable)
        from app.config import runtime_config, DEFAULT_OPENAI_LLM_MODEL
        if runtime_config.provider == "llamacpp":
            active_model = runtime_config.llamacpp_chat_model
        elif runtime_config.provider == "ollama":
            active_model = runtime_config.ollama_model
        else:
            active_model = DEFAULT_OPENAI_LLM_MODEL
        logger.debug(f"[Title Gen] Using model '{active_model}' (provider: {runtime_config.provider})")

        # Generate title with minimal tokens
        title_messages = [{"role": "user", "content": title_prompt}]
        full_title = ""
        
        async for chunk in openai_client.create_chat_completion(
            model=active_model,
            messages=title_messages,
            temperature=0.3,  # Low temperature for consistency
            max_tokens=20,    # Short title only
            stream=True
        ):
            if chunk.get("token"):
                full_title += chunk["token"]
            if chunk.get("done"):
                break
        
        # Clean and validate title
        title = full_title.strip().replace('"', '').replace("'", "")[:50]
        if not title or len(title) < 3:
            title = "Conversation"
        
        # Update database
        chat.title = title
        chat.updated_at = datetime.now(timezone.utc)
        session.add(chat)
        session.commit()
        
        logger.info(f"[Title Gen] ✅ Successfully saved title for chat {chat_id}: '{title}'")
        
    except Exception as e:
        logger.exception(f"[Title Gen] ❌ Failed for chat {chat_id}")
        if session:
            session.rollback()
    finally:
        if session:
            session.close()


@router.post("/{chat_id}/generate-title")
async def generate_chat_title(
    chat_id: str,
    background_tasks: BackgroundTasks,
    openai_client: OpenAIClient,
    session: DBSession
):
    """
    Trigger background title generation for a chat.
    Called automatically after 2-3 messages for meaningful context.
    """
    try:
        chat = session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Quick validation checks
        if chat.title != "New Chat":
            return {"success": False, "reason": "Title already set"}
        
        if len(chat.messages) < 2:
            return {"success": False, "reason": "Insufficient messages"}
        
        # Add background task - non-blocking
        background_tasks.add_task(generate_title_background, chat_id, openai_client)
        
        return {"success": True, "status": "generating", "chat_id": chat_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to trigger title generation")
        return {"success": False, "error": str(e)}


@router.post("/create", response_model=ChatResponse)
async def create_chat(chat_data: ChatCreate, session: DBSession):
    """Create a new chat thread for dual localStorage/SQLite storage."""
    try:
        from app.database import User
        logger.info(f"[create_chat] Received user_id: '{chat_data.user_id}' (type: {type(chat_data.user_id).__name__})")
        user = session.get(User, chat_data.user_id)
        logger.info(f"[create_chat] User lookup result: {user}")
        
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
        from app.database import MessageResponse
        
        chat = session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID '{chat_id}' not found")
        
        # Convert messages to response format with parsed sources
        messages_parsed = [MessageResponse.from_message(msg) for msg in chat.messages]
        
        return ChatDetailResponse(
            id=chat.id,
            title=chat.title,
            search_mode=chat.search_mode,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            messages=messages_parsed,
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
