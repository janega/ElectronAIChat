"""
Unit tests for SQLModel database models.

Tests:
- Model creation and validation
- Relationships between models
- Field constraints and defaults
- Pydantic validation
"""
import pytest
from datetime import datetime, timezone
from sqlmodel import Session

from app.database import User, Chat, Message, UserSettings, Document


# ============================================================================
# User Model Tests
# ============================================================================

def test_user_creation(session: Session):
    """Test creating a user with required fields."""
    user = User(username="testuser", email="test@example.com")
    session.add(user)
    session.commit()
    session.refresh(user)
    
    assert user.id is not None
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.created_at is not None
    assert isinstance(user.created_at, datetime)


def test_user_unique_username(session: Session):
    """Test that username must be unique."""
    user1 = User(username="testuser", email="test1@example.com")
    session.add(user1)
    session.commit()
    
    # Try to create another user with same username
    user2 = User(username="testuser", email="test2@example.com")
    session.add(user2)
    
    with pytest.raises(Exception):  # IntegrityError
        session.commit()


def test_user_relationships(session: Session, test_user: User, test_chat: Chat):
    """Test user relationships with chats and settings."""
    # Test chat relationship
    assert len(test_user.chats) > 0
    assert test_user.chats[0].id == test_chat.id


# ============================================================================
# UserSettings Model Tests
# ============================================================================

def test_user_settings_creation(session: Session, test_user: User):
    """Test creating user settings with defaults."""
    settings = UserSettings(user_id=test_user.id)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    
    assert settings.id is not None
    assert settings.user_id == test_user.id
    assert settings.temperature == 0.7
    assert settings.max_tokens == 2048
    assert settings.top_p == 0.9
    assert settings.top_k == 40
    assert settings.use_memory is True


def test_user_settings_validation_temperature():
    """Test temperature validation constraints."""
    # Valid temperature
    settings = UserSettings(user_id="test-id", temperature=0.5)
    assert settings.temperature == 0.5
    
    # Test boundary values
    settings_low = UserSettings(user_id="test-id", temperature=0.0)
    assert settings_low.temperature == 0.0
    
    settings_high = UserSettings(user_id="test-id", temperature=2.0)
    assert settings_high.temperature == 2.0


def test_user_settings_validation_max_tokens():
    """Test max_tokens validation constraints."""
    # Valid max_tokens
    settings = UserSettings(user_id="test-id", max_tokens=1024)
    assert settings.max_tokens == 1024
    
    # Test boundary values
    settings_min = UserSettings(user_id="test-id", max_tokens=1)
    assert settings_min.max_tokens == 1


# ============================================================================
# Chat Model Tests
# ============================================================================

def test_chat_creation(session: Session, test_user: User):
    """Test creating a chat."""
    chat = Chat(user_id=test_user.id, title="Test Chat", search_mode="normal")
    session.add(chat)
    session.commit()
    session.refresh(chat)
    
    assert chat.id is not None
    assert chat.user_id == test_user.id
    assert chat.title == "Test Chat"
    assert chat.search_mode == "normal"
    assert chat.created_at is not None
    assert chat.updated_at is not None


def test_chat_default_values(session: Session, test_user: User):
    """Test chat default values."""
    chat = Chat(user_id=test_user.id)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    
    assert chat.title == "New Chat"
    assert chat.search_mode == "normal"


def test_chat_relationships(session: Session, test_chat: Chat):
    """Test chat relationships with user and messages."""
    # Add a message to the chat
    message = Message(
        chat_id=test_chat.id,
        role="user",
        content="Test message"
    )
    session.add(message)
    session.commit()
    session.refresh(test_chat)
    
    assert len(test_chat.messages) > 0
    assert test_chat.messages[0].content == "Test message"


# ============================================================================
# Message Model Tests
# ============================================================================

def test_message_creation(session: Session, test_chat: Chat):
    """Test creating a message."""
    message = Message(
        chat_id=test_chat.id,
        role="user",
        content="Hello, world!",
        model_used="llama2"
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    
    assert message.id is not None
    assert message.chat_id == test_chat.id
    assert message.role == "user"
    assert message.content == "Hello, world!"
    assert message.model_used == "llama2"
    assert message.created_at is not None


def test_message_roles(session: Session, test_chat: Chat):
    """Test different message roles."""
    roles = ["user", "assistant", "system"]
    
    for role in roles:
        message = Message(
            chat_id=test_chat.id,
            role=role,
            content=f"Message from {role}"
        )
        session.add(message)
    
    session.commit()
    
    # Verify all messages were created
    assert len(test_chat.messages) >= len(roles)


def test_message_optional_fields(session: Session, test_chat: Chat):
    """Test message optional fields."""
    message = Message(
        chat_id=test_chat.id,
        role="assistant",
        content="Response",
        search_mode="embeddings",
        model_used="llama2",
        sources='[{"filename": "test.pdf"}]'
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    
    assert message.search_mode == "embeddings"
    assert message.sources is not None


# ============================================================================
# Document Model Tests
# ============================================================================

def test_document_creation(session: Session, test_chat: Chat):
    """Test creating a document."""
    document = Document(
        chat_id=test_chat.id,
        name="test.pdf",
        size=1024,
        content_type="application/pdf",
        chunks_count=10
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    
    assert document.id is not None
    assert document.chat_id == test_chat.id
    assert document.name == "test.pdf"
    assert document.size == 1024
    assert document.chunks_count == 10
    assert document.uploaded_at is not None


def test_document_relationship(session: Session, test_chat: Chat):
    """Test document relationship with chat."""
    document = Document(
        chat_id=test_chat.id,
        name="test.pdf",
        size=1024,
        content_type="application/pdf",
        chunks_count=5
    )
    session.add(document)
    session.commit()
    session.refresh(test_chat)
    
    assert len(test_chat.documents) > 0
    assert test_chat.documents[0].name == "test.pdf"
