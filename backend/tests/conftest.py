"""
Test configuration and shared fixtures.

Provides:
- Mocked LLM responses
- Test database session setup
- Mock managers (LangChain, Mem0, OpenAI)
- FastAPI test client
"""
import pytest
import sys
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Generator, AsyncGenerator
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool
from httpx import AsyncClient, ASGITransport

# Add backend to path for imports
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.database import User, Chat, Message, UserSettings, Document
from app.embeddings import LangChainEmbeddingManager
from app.memory import Mem0MemoryManager
from app.openai_client import EnhancedOpenAIClient


# ============================================================================
# Test Database Fixtures
# ============================================================================

@pytest.fixture(name="test_engine")
def test_engine_fixture():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(test_engine) -> Generator[Session, None, None]:
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture(name="test_user")
def test_user_fixture(session: Session) -> User:
    """Create a test user."""
    user = User(id="test-user-id", username="testuser", email="test@example.com")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="test_user_settings")
def test_user_settings_fixture(session: Session, test_user: User) -> UserSettings:
    """Create test user settings."""
    settings = UserSettings(
        user_id=test_user.id,
        default_model="llama2",
        temperature=0.7,
        max_tokens=2048,
        top_p=0.9,
        top_k=40,
        system_prompt="You are a helpful assistant.",
        use_memory=True
    )
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


@pytest.fixture(name="test_chat")
def test_chat_fixture(session: Session, test_user: User) -> Chat:
    """Create a test chat."""
    chat = Chat(
        id="test-chat-id",
        user_id=test_user.id,
        title="Test Chat",
        search_mode="normal"
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


# ============================================================================
# Mock LLM and Manager Fixtures
# ============================================================================

@pytest.fixture
def mock_llm_response():
    """Mock LLM response data."""
    return {
        "text": "This is a mocked LLM response.",
        "model": "llama2",
        "done": True
    }


@pytest.fixture
def mock_embeddings():
    """Mock embedding vector."""
    return [0.1, 0.2, 0.3, 0.4, 0.5] * 100  # 500-dimensional mock embedding


@pytest.fixture
def mock_langchain_manager(mock_embeddings):
    """Mock LangChainEmbeddingManager."""
    mock_manager = MagicMock(spec=LangChainEmbeddingManager)
    
    # Mock async search_documents method
    async def mock_search(*args, **kwargs):
        return [
            {
                "content": "Mocked document content",
                "metadata": {"filename": "test.pdf", "chatId": "test-chat-id"}
            }
        ]
    
    mock_manager.search_documents = AsyncMock(side_effect=mock_search)
    
    # Mock sync embed_documents method
    mock_manager.embed_documents = MagicMock(return_value=[mock_embeddings])
    
    # Mock add_documents method
    async def mock_add(*args, **kwargs):
        return {"chunks": 5, "collection": "test-collection"}
    
    mock_manager.add_documents = AsyncMock(side_effect=mock_add)
    
    return mock_manager


@pytest.fixture
def mock_mem0_manager():
    """Mock Mem0MemoryManager."""
    mock_manager = MagicMock(spec=Mem0MemoryManager)
    
    # Mock search_memory method
    mock_manager.search_memory = MagicMock(return_value={
        "results": [
            {"memory": "User prefers Python for backend development"},
            {"memory": "User is building an Electron desktop app"}
        ]
    })
    
    # Mock add_conversation_pair method
    mock_manager.add_conversation_pair = MagicMock(return_value={
        "results": [{"memory_id": "mem-123"}]
    })
    
    return mock_manager


@pytest.fixture
def mock_openai_client():
    """Mock EnhancedOpenAIClient."""
    mock_client = MagicMock(spec=EnhancedOpenAIClient)
    
    # Mock streaming chat completion
    async def mock_stream(*args, **kwargs):
        """Mock streaming response generator."""
        tokens = ["This ", "is ", "a ", "test ", "response."]
        for token in tokens:
            yield {"token": token, "done": False}
        yield {"token": "", "done": True}
    
    mock_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    
    # Make sure the async generator is callable
    mock_client.create_chat_completion.return_value = mock_stream()
    
    return mock_client


@pytest.fixture
def mock_ollama_health():
    """Mock Ollama health check response."""
    return {
        "available": True,
        "url": "http://localhost:11434",
        "models": ["llama2:latest", "nomic-embed-text:latest"],
        "model_count": 2,
        "version": "0.1.0"
    }


# ============================================================================
# FastAPI Test Client Fixtures
# ============================================================================

@pytest.fixture
def test_app(mock_langchain_manager, mock_mem0_manager, mock_openai_client):
    """Create a test FastAPI app instance with mocked dependencies."""
    # Import app after setting up test environment
    os.environ["USE_APP_DATA_DIR"] = "false"
    os.environ["LLM_PROVIDER"] = "ollama"
    
    # Set up mock managers in dependencies module
    from app.routes import dependencies
    dependencies.set_managers(
        langchain_manager=mock_langchain_manager,
        mem0_manager=mock_mem0_manager,
        openai_client=mock_openai_client
    )
    
    # We need to import the app in a way that doesn't trigger startup
    # For now, we'll use a simplified approach
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from app.routes.health import router as health_router
    from app.routes.chat import router as chat_router
    
    app = FastAPI(title="Test App")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize app state for health checks
    app.state.startup_errors = []
    
    # Include routers
    app.include_router(health_router)
    app.include_router(chat_router)
    
    return app


@pytest.fixture
async def async_client(test_app, session) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing."""
    # Override get_session dependency
    from app.routes import dependencies
    from app.db_manager import get_session as real_get_session
    
    # Create a custom dependency override
    def override_get_session():
        return session
    
    # Store original and override
    test_app.dependency_overrides[real_get_session] = override_get_session
    
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    # Clean up
    test_app.dependency_overrides.clear()


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
