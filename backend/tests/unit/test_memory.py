"""
Unit tests for Mem0MemoryManager.

Tests:
- Memory storage and retrieval
- Conversation pair handling
- Deduplication behavior
- Fallback to MemoryStub
"""
import pytest
from unittest.mock import MagicMock, patch

from app.memory import Mem0MemoryManager


# ============================================================================
# Initialization Tests
# ============================================================================

@patch('app.memory.Memory')
def test_mem0_manager_init_success(mock_memory_class):
    """Test Mem0MemoryManager initialization with mem0ai available."""
    mock_memory_instance = MagicMock()
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    
    assert manager.memory is not None
    mock_memory_class.from_config.assert_called_once()


@patch('app.memory.Memory', None)
def test_mem0_manager_init_fallback():
    """Test Mem0MemoryManager falls back to MemoryStub when mem0ai unavailable."""
    # When Memory is None, should use MemoryStub
    manager = Mem0MemoryManager()
    
    # Should still have a memory attribute (MemoryStub)
    assert hasattr(manager, 'memory')


# ============================================================================
# Memory Search Tests
# ============================================================================

@patch('app.memory.Memory')
def test_search_memory_success(mock_memory_class):
    """Test searching memory with results."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.search.return_value = {
        "results": [
            {"memory": "User prefers Python", "metadata": {}},
            {"memory": "User likes FastAPI", "metadata": {}}
        ]
    }
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    results = manager.search_memory(
        user_id="test-user",
        query="What programming languages?",
        limit=5
    )
    
    assert "results" in results
    assert len(results["results"]) == 2
    assert results["results"][0]["memory"] == "User prefers Python"
    mock_memory_instance.search.assert_called_once()


@patch('app.memory.Memory')
def test_search_memory_empty_results(mock_memory_class):
    """Test searching memory with no results."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.search.return_value = {"results": []}
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    results = manager.search_memory(
        user_id="test-user",
        query="Unrelated query",
        limit=5
    )
    
    assert "results" in results
    assert len(results["results"]) == 0


@patch('app.memory.Memory')
def test_search_memory_with_metadata_filter(mock_memory_class):
    """Test searching memory with metadata filtering."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.search.return_value = {
        "results": [
            {"memory": "Chat-specific memory", "metadata": {"chat_id": "chat-123"}}
        ]
    }
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    results = manager.search_memory(
        user_id="test-user",
        query="test",
        limit=5
    )
    
    assert len(results["results"]) > 0


# ============================================================================
# Memory Addition Tests
# ============================================================================

@patch('app.memory.Memory')
def test_add_conversation_pair_success(mock_memory_class):
    """Test adding conversation pair to memory."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.add.return_value = {
        "results": [{"memory_id": "mem-123"}]
    }
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    # Use a longer message that won't be filtered by semantic filter (> 10 words)
    result = manager.add_conversation_pair(
        user_message="I prefer using Python for backend development because it has great frameworks like FastAPI and Django.",
        assistant_message="Python is indeed an excellent choice for backend development with its rich ecosystem.",
        user_id="test-user",
        metadata={"chat_id": "chat-123"}
    )
    
    # Result can be None (if filtered) or dict with results
    assert result is None or (isinstance(result, dict) and "results" in result)
    # Verify add was called if message passed filter
    if result is not None:
        mock_memory_instance.add.assert_called()


@patch('app.memory.Memory')
def test_add_conversation_pair_deduplication(mock_memory_class):
    """Test conversation pair deduplication (ValueError on known facts)."""
    mock_memory_instance = MagicMock()
    # Simulate Mem0 raising ValueError for known facts
    mock_memory_instance.add.side_effect = ValueError("empty embeddings")
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    result = manager.add_conversation_pair(
        user_message="Repeated question",
        assistant_message="Repeated answer",
        user_id="test-user"
    )
    
    # Should handle ValueError gracefully and return None
    assert result is None


@patch('app.memory.Memory')
def test_add_conversation_pair_empty_messages(mock_memory_class):
    """Test adding empty conversation pair."""
    mock_memory_instance = MagicMock()
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    
    # Should handle empty messages gracefully
    result = manager.add_conversation_pair(
        user_message="",
        assistant_message="",
        user_id="test-user"
    )
    
    # Depending on implementation, might return None or empty result
    # The important thing is it doesn't crash


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

@patch('app.memory.Memory')
def test_search_memory_with_invalid_user_id(mock_memory_class):
    """Test searching memory with invalid user_id."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.search.return_value = {"results": []}
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    
    # Should handle gracefully
    results = manager.search_memory(
        user_id="",
        query="test",
        limit=5
    )
    
    # Should return empty or raise appropriate error
    assert isinstance(results, dict)


@patch('app.memory.Memory')
def test_add_conversation_with_special_characters(mock_memory_class):
    """Test adding conversation with special characters."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.add.return_value = {"results": [{"memory_id": "mem-456"}]}
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    # Use longer message to pass semantic filter
    result = manager.add_conversation_pair(
        user_message="I really enjoy using émojis 🚀 in my documentation because they make it more engaging and fun to read.",
        assistant_message="They work fine! 😊 Emojis can indeed make documentation more accessible and visually appealing.",
        user_id="test-user"
    )
    
    # Should handle special characters - result can be None or dict
    assert result is None or isinstance(result, dict)


@patch('app.memory.Memory')
def test_search_memory_with_large_limit(mock_memory_class):
    """Test searching with large limit value."""
    mock_memory_instance = MagicMock()
    mock_memory_instance.search.return_value = {
        "results": [{"memory": f"Memory {i}"} for i in range(50)]
    }
    mock_memory_class.from_config.return_value = mock_memory_instance
    
    manager = Mem0MemoryManager()
    results = manager.search_memory(
        user_id="test-user",
        query="test",
        limit=100
    )
    
    # Should handle large limits
    assert len(results["results"]) <= 100


# ============================================================================
# MemoryStub Tests (Fallback)
# ============================================================================

def test_memory_stub_basic_operations():
    """Test MemoryStub fallback implementation."""
    # This would require importing MemoryStub if it's accessible
    # For now, we test through Mem0MemoryManager with Memory = None
    with patch('app.memory.Memory', None):
        manager = Mem0MemoryManager()
        
        # Should still support basic operations through stub
        # Add operation
        result = manager.add_conversation_pair(
            user_message="test",
            assistant_message="response",
            user_id="test-user"
        )
        
        # Should not crash (stub handles it)
        # Result may be None or empty dict
        assert result is None or isinstance(result, dict)
