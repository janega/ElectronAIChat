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
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import Optional
from app.config import logger
from .dependencies import get_langchain_manager, get_mem0_manager, get_openai_client, DBSession
from .chats import generate_title_background

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatRequest(BaseModel):
    chatId: str
    userId: str
    message: str
    searchMode: Optional[str] = "normal"
    model: Optional[str] = "llama2"
    temperature: Optional[float] = 0.7
    maxTokens: Optional[int] = 512
    systemPrompt: Optional[str] = "You are a helpful assistant."
    useMemory: Optional[bool] = True


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
            # 0. Save user message to database
            from app.database import Message, Chat, User
            
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
                    model_used=payload.model
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
                    search_results = await langchain_manager.search_documents(
                        chat_id=payload.chatId, 
                        query=payload.message, 
                        k=3
                    )
                    if search_results:
                        doc_context = "\n\n--- Relevant Documents ---\n"
                        for result in search_results:
                            doc_context += f"\n{result['content']}\n"
                            filename = result['metadata'].get('filename', 'Unknown')
                            doc_context += f"(Source: {filename})\n"
                            
                            # Track unique sources for attribution
                            if filename not in [s['filename'] for s in sources]:
                                sources.append({
                                    'filename': filename,
                                    'chatId': result['metadata'].get('chatId', payload.chatId)
                                })
                except Exception:
                    logger.exception("Document search failed - continuing without RAG context")

            # 2. Retrieve user memory context
            mem0_context = ""
            if payload.useMemory:
                try:
                    logger.debug(f"Retrieving memories for user={payload.userId}")
                    relevant_memories = mem0_manager.search_memory(
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
                        logger.info(f"Found {len(memories_list)} memories")
                        mem0_context = "\n\n--- User Memory Context ---\n"
                        for mem in memories_list:
                            if isinstance(mem, dict) and "memory" in mem:
                                mem0_context += f"- {mem['memory']}\n"
                        logger.info(f"Memory context built: {mem0_context[:200]}")
                    else:
                        logger.info(f"No memories found for user={payload.userId}")
                except Exception:
                    logger.exception("Memory search failed - continuing without memory context")

            # 3. Build conversation messages with context
            messages = [{"role": "system", "content": payload.systemPrompt}]
            
            # Add context in order of priority
            if mem0_context:
                messages.append({"role": "system", "content": mem0_context})
            if doc_context:
                messages.append({"role": "system", "content": doc_context})

            messages.append({"role": "user", "content": payload.message})

            # 4. Stream response tokens
            full_response = ""
            async for chunk in openai_client.create_chat_completion(
                model=payload.model,
                messages=messages,
                temperature=payload.temperature,
                max_tokens=payload.maxTokens,
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
            
            # Send final event with sources
            if sources:
                final_data = json.dumps({"token": "", "done": True, "sources": sources})
                yield f"data: {final_data}\n\n"

            # Log the accumulated response for debugging
            logger.info(f"Chat complete: user_message_length={len(payload.message)}, response_length={len(full_response)}, response_preview='{full_response[:100]}'")

            # 5. Save assistant response to database
            try:
                assistant_message = Message(
                    chat_id=payload.chatId,
                    role="assistant",
                    content=full_response,
                    search_mode=payload.searchMode,
                    model_used=payload.model,
                    sources=json.dumps(sources) if sources else None  # Store sources as JSON
                )
                session.add(assistant_message)
                session.commit()
                logger.debug(f"Saved assistant response to database (chat: {payload.chatId})")
                
                # Auto-generate title after 2 messages (user + assistant = first exchange)
                if len(chat.messages) == 4 and chat.title == "New Chat":
                    logger.info(f"Auto-triggering title generation for chat {payload.chatId} (2 messages)")
                    # Fire and forget background task
                    asyncio.create_task(generate_title_background(payload.chatId, openai_client))
                    
            except Exception:
                logger.exception("Failed to save assistant response to database")
                session.rollback()

            # 6. Store conversation in memory for future context (async, non-blocking)
            if payload.useMemory:
                async def store_memories_background():
                    """Background task to store memories without blocking response"""
                    try:
                        # Store user message (with validation)
                        if payload.message and payload.message.strip() and len(payload.message.strip()) >= 3:
                            logger.debug(f"Storing user message: '{payload.message[:100]}'")
                            await run_in_threadpool(
                                mem0_manager.add_message,
                                user_id=payload.userId, 
                                message=payload.message, 
                                role="user",
                                metadata={"chat_id": payload.chatId}
                            )
                            logger.info(f"Successfully stored user message in memory (chat: {payload.chatId})")
                        else:
                            logger.warning(f"Skipping user message storage: too short or empty")
                        
                        # Store assistant response (with validation)
                        if full_response and full_response.strip() and len(full_response.strip()) >= 3:
                            logger.debug(f"Storing assistant response: '{full_response[:100]}'")
                            await run_in_threadpool(
                                mem0_manager.add_message,
                                user_id=payload.userId, 
                                message=full_response,
                                role="assistant", 
                                metadata={"chat_id": payload.chatId}
                            )
                            logger.info(f"Successfully stored assistant response in memory (chat: {payload.chatId})")
                        else:
                            logger.warning(f"Skipping assistant response storage: too short or empty (length={len(full_response)})")
                    except Exception as mem_error:
                        logger.error(f"Memory storage failed for chat {payload.chatId}: {type(mem_error).__name__}: {str(mem_error)}")
                        logger.exception("Full memory storage error traceback:")
                
                # Fire and forget - don't wait for memory storage
                asyncio.create_task(store_memories_background())

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
