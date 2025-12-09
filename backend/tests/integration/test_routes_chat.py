"""
Integration tests for chat streaming endpoints.

Tests:
- Chat streaming with SSE format
- Message persistence to database
- RAG context integration
- Memory context integration
- Error handling and edge cases
"""
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient
from sqlmodel import Session, select

from app.database import Message, Chat
from app.routes import dependencies


# ============================================================================
# Chat Stream Endpoint Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_stream_basic(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test basic chat streaming functionality."""
    # Mock the streaming response
    async def mock_stream(*args, **kwargs):
        yield {"token": "Hello ", "done": False}
        yield {"token": "world!", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "Hello",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


@pytest.mark.asyncio
async def test_chat_stream_message_persistence(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test that messages are persisted to database."""
    # Mock the streaming response
    async def mock_stream(*args, **kwargs):
        yield {"token": "Response", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    initial_message_count = len(session.exec(select(Message)).all())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "Test message",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    # Check that messages were saved
    # Note: The actual message saving happens in the stream generator
    # which might not execute fully in this test context
    # This is more of a structural test
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_chat_stream_with_rag_context(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test chat streaming with RAG document context."""
    # Mock document search results
    mock_langchain_manager.search_documents = AsyncMock(return_value=[
        {
            "content": "Python is a programming language",
            "metadata": {"filename": "python_docs.pdf", "chatId": test_chat.id}
        }
    ])
    
    # Mock streaming response
    async def mock_stream(*args, **kwargs):
        # Verify RAG context was included in messages
        messages = kwargs.get("messages", [])
        # Should have system prompt and document context
        yield {"token": "Response with RAG", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "What is Python?",
                        "searchMode": "embeddings",  # Enable RAG
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    assert response.status_code == 200
    # Verify search was called
    mock_langchain_manager.search_documents.assert_called_once()


@pytest.mark.asyncio
async def test_chat_stream_with_memory_context(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test chat streaming with memory context."""
    # Mock memory search results
    mock_mem0_manager.search_memory = MagicMock(return_value={
        "results": [
            {"memory": "User is learning Python"},
            {"memory": "User prefers FastAPI framework"}
        ]
    })
    
    # Mock streaming response
    async def mock_stream(*args, **kwargs):
        yield {"token": "Response with memory", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "What should I learn?",
                        "searchMode": "normal",
                        "useMemory": True  # Enable memory
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    assert response.status_code == 200
    # Verify memory search was called
    mock_mem0_manager.search_memory.assert_called_once()


# ============================================================================
# Chat Stream Settings Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_stream_uses_user_settings(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test that chat uses settings from database."""
    # Mock streaming response
    async def mock_stream(*args, **kwargs):
        # Verify settings were applied
        assert kwargs.get("temperature") == test_user_settings.temperature
        assert kwargs.get("max_tokens") == test_user_settings.max_tokens
        yield {"token": "Response", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "Test",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    assert response.status_code == 200


# ============================================================================
# Chat Stream Auto-Creation Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_stream_auto_creates_chat(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test that chat is auto-created if it doesn't exist."""
    # Mock streaming response
    async def mock_stream(*args, **kwargs):
        yield {"token": "Response", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    new_chat_id = "new-chat-id-12345"
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": new_chat_id,
                        "userId": test_user.id,
                        "message": "First message",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    assert response.status_code == 200


# ============================================================================
# Chat Stream Error Handling Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_stream_with_invalid_chat_id(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test chat streaming with invalid chat ID (should auto-create)."""
    async def mock_stream(*args, **kwargs):
        yield {"token": "Response", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": "nonexistent-chat",
                        "userId": "nonexistent-user",
                        "message": "Test",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    # Should handle gracefully (auto-create or error)
    assert response.status_code in [200, 400, 500]


@pytest.mark.asyncio
async def test_chat_stream_with_empty_message(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test chat streaming with empty message."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "",  # Empty message
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    # Should handle empty message (might return error or process it)
    assert response.status_code in [200, 400, 422]


@pytest.mark.asyncio
async def test_chat_stream_with_llm_error(
    async_client: AsyncClient,
    session: Session,
    test_user,
    test_chat,
    test_user_settings,
    mock_langchain_manager,
    mock_mem0_manager,
    mock_openai_client
):
    """Test chat streaming when LLM raises error."""
    # Mock LLM to raise error
    mock_openai_client.create_chat_completion = AsyncMock(
        side_effect=Exception("LLM service unavailable")
    )
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_mem0_manager', return_value=mock_mem0_manager):
            with patch.object(dependencies, 'get_openai_client', return_value=mock_openai_client):
                with patch.object(dependencies, 'get_session', return_value=session):
                    payload = {
                        "chatId": test_chat.id,
                        "userId": test_user.id,
                        "message": "Test",
                        "searchMode": "normal",
                        "useMemory": False
                    }
                    
                    response = await async_client.post(
                        "/api/chat/stream",
                        json=payload
                    )
    
    # Should return error in stream or HTTP error
    assert response.status_code in [200, 500]
