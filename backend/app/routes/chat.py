# app/routes/chat.py
"""
Chat streaming and conversation endpoints.
Handles real-time chat with RAG context and memory integration.
"""
import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Body, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.config import logger, DEFAULT_SETTINGS
from app.database import Message, Chat, User, UserSettings
from .dependencies import get_langchain_manager, get_mem0_manager, get_openai_client, DBSession
from .chats import generate_title_background
from sqlmodel import select

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatRequest(BaseModel):
    chatId: str
    userId: str
    message: str
    searchMode: Optional[str] = "normal"
    useMemory: Optional[bool] = True
    # Settings fields kept for backward compatibility but will be overridden by database values
    model: Optional[str] = None
    temperature: Optional[float] = None
    maxTokens: Optional[int] = None
    systemPrompt: Optional[str] = None


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest = Body(...),
    langchain_manager = Depends(get_langchain_manager),
    mem0_manager = Depends(get_mem0_manager),
    openai_client = Depends(get_openai_client),
    session: DBSession = None,
):
    """
    POST-only streaming chat endpoint.
    Body: JSON matching ChatRequest.
    Returns SSE (text/event-stream) each line: data: {"token":"...","done":false}
    
    Persistence:
    - Saves user message to SQLite before streaming
    - Saves assistant response to SQLite after streaming
    - Optionally stores in mem0 for long-term memory
    """
    
    async def generate():
        try:
            # 0. Load user settings from database
            user_settings = session.exec(
                select(UserSettings).where(UserSettings.user_id == payload.userId)
            ).first()
            
            if not user_settings:
                logger.warning(f"UserSettings not found for user {payload.userId}, using defaults from config")
                temperature = DEFAULT_SETTINGS["temperature"]
                max_tokens = DEFAULT_SETTINGS["max_tokens"]
                top_p = DEFAULT_SETTINGS["top_p"]
                top_k = DEFAULT_SETTINGS["top_k"]
                system_prompt = DEFAULT_SETTINGS["system_prompt"]
                model = payload.model or "llama2"  # Fallback to request if provided
            else:
                temperature = user_settings.temperature
                max_tokens = user_settings.max_tokens
                top_p = user_settings.top_p
                top_k = user_settings.top_k
                system_prompt = user_settings.system_prompt
                model = user_settings.default_model
                logger.debug(f"Loaded settings for user {payload.userId}: temp={temperature}, tokens={max_tokens}, model={model}")
            
            # 1. Save user message to database
            try:
                # Verify chat exists (or create it)
                chat = session.get(Chat, payload.chatId)
                if not chat:
                    # Auto-create chat if it doesn't exist
                    logger.info(f"Chat '{payload.chatId}' not found, creating automatically")
                    
                    # Verify user exists first
                    
                    #user = session.query(User).filter(User.username == payload.userId).first()
                    user = session.get(User, payload.userId)
                    if not user:
                        # Create user if needed
                        user = User(id=payload.userId, username=payload.userId)
                        session.add(user)
                        session.commit()
                        logger.info(f"Created user: {payload.userId}")
                    
                    # Create chat
                    chat = Chat(
                        id=payload.chatId,
                        user_id=user.id,
                        title="New Chat",
                        search_mode=payload.searchMode or "normal"
                    )
                    session.add(chat)
                    session.commit()
                    logger.info(f"Created chat: {payload.chatId}")
                else:
                    # Update existing chat timestamp                    
                    chat.updated_at = datetime.now(timezone.utc)
                    session.add(chat)
                
                # Save user message
                user_message = Message(
                    chat_id=payload.chatId,
                    role="user",
                    content=payload.message,
                    search_mode=payload.searchMode,
                    model_used=model  # Use loaded settings
                )
                session.add(user_message)
                session.commit()
                logger.debug(f"Saved user message to database (chat: {payload.chatId})")
            except Exception:
                logger.exception("Failed to save user message to database - continuing")
                session.rollback()
            
            # 1. Retrieve document context (RAG)
            doc_context = ""
            sources = []  # Track document sources for RAG attribution
            if payload.searchMode in ["embeddings", "all"]:
                try:
                    logger.info(f"Querying ChromaDB for chat_id={payload.chatId}, searchMode={payload.searchMode}")
                    search_results = await langchain_manager.search_documents(
                        chat_id=payload.chatId, 
                        query=payload.message, 
                        k=3
                    )
                    if search_results:
                        logger.info(f"Found {len(search_results)} RAG documents from ChromaDB")
                        doc_context = "\n\n--- Relevant Documents ---\n"
                        for result in search_results:
                            doc_context += f"\n{result['content']}\n"
                            filename = result['metadata'].get('filename', 'Unknown')
                            doc_context += f"(Source: {filename})\n"
                            
                            # Track unique sources for attribution
                            if filename not in [s['filename'] for s in sources]:
                                sources.append({
                                    'filename': filename,
                                    'chatId': result['metadata'].get('chatId', payload.chatId),
                                    'type': 'document'
                                })
                                logger.debug(f"Added document source: {filename}")
                        logger.info(f"Document sources collected: {[s['filename'] for s in sources]}")
                    else:
                        logger.info("ChromaDB search returned no documents")
                except Exception:
                    logger.exception("Document search failed - continuing without RAG context")
            else:
                logger.info(f"Skipping ChromaDB query (searchMode={payload.searchMode})")

            # 2. Retrieve user memory context
            mem0_context = ""
            memory_used = False
            if payload.useMemory:
                try:
                    logger.info(f"Querying Mem0 for user_id={payload.userId}")                 
                    relevant_memories = await mem0_manager.search_memory(
                        user_id=payload.userId,
                        query=payload.message,
                        limit=5
                    )
                    
                    # mem0 returns {'results': [...]} wrapper
                    memories_list = []
                    if isinstance(relevant_memories, dict) and "results" in relevant_memories:
                        memories_list = relevant_memories["results"]
                    elif isinstance(relevant_memories, list):
                        memories_list = relevant_memories
                    
                    if memories_list:
                        logger.info(f"Found {len(memories_list)} Mem0 memories")
                        mem0_context = "\n\n--- User Memory Context ---\n"
                        for mem in memories_list:
                            if isinstance(mem, dict) and "memory" in mem:
                                mem0_context += f"- {mem['memory']}\n"
                        logger.info(f"Memory context built: {mem0_context[:200]}")
                        memory_used = True
                    else:
                        logger.info(f"Mem0 search returned no memories for user={payload.userId}")
                except Exception:
                    logger.exception("Memory search failed - continuing without memory context")
            else:
                logger.info(f"Skipping Mem0 query (useMemory={payload.useMemory})")

            # 3. Build conversation messages with context
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add context in order of priority
            if mem0_context:
                messages.append({"role": "system", "content": mem0_context})
            if doc_context:
                messages.append({"role": "system", "content": doc_context})

            messages.append({"role": "user", "content": payload.message})

            # 4. Stream response tokens
            full_response = ""
            async for chunk in openai_client.create_chat_completion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                top_k=top_k,
                stream=True
            ):
                # Chunk format: {"token": "...", "done": bool}
                token = chunk.get("token", "")
                full_response += token
                
                # Send SSE formatted data
                sse_data = json.dumps(chunk)
                yield f"data: {sse_data}\n\n"
                
                if chunk.get("done"):
                    break
            
            # Add memory source if memories were used
            if memory_used:
                sources.append({
                    'filename': 'Long-term Memory',
                    'chatId': payload.chatId,
                    'type': 'memory'
                })
            
            # Send final event with sources
            if sources:
                logger.info(f"Sending {len(sources)} sources: {sources}")
                final_data = json.dumps({"token": "", "done": True, "sources": sources})
                yield f"data: {final_data}\n\n"
            else:
                yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

            # Log the accumulated response for debugging
            logger.info(f"Chat complete: user_message_length={len(payload.message)}, response_length={len(full_response)}, response_preview='{full_response[:100]}'")

            # 5. Save assistant response to database
            try:
                assistant_message = Message(
                    chat_id=payload.chatId,
                    role="assistant",
                    content=full_response,
                    search_mode=payload.searchMode,
                    model_used=model,  # Use loaded settings
                    sources=json.dumps(sources) if sources else None  # Store sources as JSON
                )
                session.add(assistant_message)
                session.commit()
                logger.debug(f"Saved assistant response to database (chat: {payload.chatId})")
                
                # Auto-generate title after 4 messages (2 complete exchanges: user+assistant, user+assistant)
                if len(chat.messages) == 4 and chat.title == "New Chat":
                    logger.info(f"[Title Gen] Triggering title generation for chat {payload.chatId} (4 messages)")
                    # Fire and forget background task
                    asyncio.create_task(generate_title_background(payload.chatId, openai_client))
                    
            except Exception:
                logger.exception("Failed to save assistant response to database")
                session.rollback()

            # 6. Store conversation in memory for future context (non-blocking for streaming)
            if payload.useMemory:
                try:
                    # Store conversation pair using fire-and-forget background task
                    if payload.message and payload.message.strip() and full_response and full_response.strip():
                        logger.debug(f"Scheduling background memory storage: user='{payload.message[:100]}', assistant='{full_response[:100]}'")
                        
                        # Define callback to log exceptions from background task
                        def _mem0_done(task: asyncio.Task):
                            try:
                                result = task.result()
                                # v1.1 format: result is {"results": [...]} or None if filtered
                                if result and isinstance(result, dict) and result.get('results'):
                                    logger.debug(f"Background memory storage succeeded: {len(result['results'])} memories (chat: {payload.chatId})")
                                elif result is None:
                                    logger.debug(f"Memory storage skipped by semantic filter (chat: {payload.chatId})")
                                else:
                                    logger.debug(f"Memory storage result: {result}")
                            except ValueError as e:
                                # Mem0 raises ValueError when facts already known (deduplication)
                                if "empty" in str(e).lower():
                                    logger.debug("Mem0 skipped storage (duplicate/NOOP) - all facts already known")
                                else:
                                    logger.error(f"Memory storage ValueError: {str(e)}")
                            except Exception:
                                logger.exception("Mem0 background write failed")
                        
                        # Schedule background task
                        task = asyncio.create_task(
                            mem0_manager.add_conversation_pair(
                                user_message=payload.message,
                                assistant_message=full_response,
                                user_id=payload.userId,
                                metadata={
                                    "chat_id": payload.chatId,
                                    "timestamp": datetime.now(timezone.utc).isoformat()
                                }
                            )
                        )
                        task.add_done_callback(_mem0_done)
                    else:
                        logger.warning(f"Skipping memory storage: messages too short or empty")
                        
                except Exception:
                    logger.exception("Failed to schedule Mem0 background write")

        except Exception as e:
            logger.exception("Chat streaming error")
            error_data = json.dumps({"error": str(e), "done": True})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        generate(), 
        media_type="text/event-stream", 
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering for real-time streaming
        }
    )
