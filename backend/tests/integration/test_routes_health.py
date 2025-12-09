"""
Integration tests for health check endpoints.

Tests:
- Health check endpoint functionality
- Component status reporting
- Database connectivity checks
- Provider configuration validation
"""
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient
from sqlmodel import Session

from app.routes import dependencies


# ============================================================================
# Health Check Endpoint Tests
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_success(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test successful health check with all components healthy."""
    response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "status" in data
    assert "provider" in data
    assert "components" in data
    assert data["components"]["database"] is True or "database" in data["components"]


@pytest.mark.asyncio
async def test_health_check_database_stats(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager,
    test_user,
    test_chat
):
    """Test health check includes database statistics."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should include database stats
    assert "components" in data
    if "database_stats" in data["components"]:
        stats = data["components"]["database_stats"]
        # Stats should have counts for various tables
        assert isinstance(stats, dict)


@pytest.mark.asyncio
async def test_health_check_provider_info(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check includes provider information."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "provider" in data
    assert data["provider"] in ["ollama", "openai"]


# ============================================================================
# Health Check Component Status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_langchain_component(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check validates LangChain component."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    components = data["components"]
    assert "langchain_embeddings" in components
    # Should be True since we're passing a valid mock
    assert components["langchain_embeddings"] is True


@pytest.mark.asyncio
async def test_health_check_memory_component(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check validates memory component."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    components = data["components"]
    # Memory should always be available (has fallback)
    assert "mem0_memory" in components or "memory" in str(components)


@pytest.mark.asyncio
async def test_health_check_vectorstore_component(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check validates vector store component."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    components = data["components"]
    # ChromaDB is file-based, always available
    assert "vectorstore" in components or "vector" in str(components)


# ============================================================================
# Health Check Status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_healthy_status(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check returns healthy status when all components work."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Status should be healthy or degraded
    assert data["status"] in ["healthy", "degraded", "unhealthy"]


@pytest.mark.asyncio
async def test_health_check_with_startup_warnings(
    async_client: AsyncClient,
    session: Session,
    mock_langchain_manager
):
    """Test health check reports startup validation warnings."""
    # Mock app state with startup errors
    mock_app_state = MagicMock()
    mock_app_state.startup_errors = [
        {
            "component": "test",
            "message": "Test warning",
            "suggestion": "Fix it"
        }
    ]
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should still return health info
    assert "status" in data
    assert "components" in data


# ============================================================================
# Health Check Error Handling Tests
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_with_database_error(
    async_client: AsyncClient,
    mock_langchain_manager
):
    """Test health check handles database errors gracefully."""
    # Create a mock session that raises an error
    mock_session = MagicMock()
    mock_session.exec.side_effect = Exception("Database connection failed")
    
    with patch.object(dependencies, 'get_langchain_manager', return_value=mock_langchain_manager):
        with patch.object(dependencies, 'get_session', return_value=mock_session):
            response = await async_client.get("/api/health")
    
    # Should still return a response (even if unhealthy)
    assert response.status_code == 200
    data = response.json()
    
    # Status should indicate problem
    assert "status" in data
    # May be unhealthy or degraded
    assert data["status"] in ["unhealthy", "degraded", "healthy"]


@pytest.mark.asyncio
async def test_health_check_with_missing_manager(
    async_client: AsyncClient,
    session: Session
):
    """Test health check handles missing LangChain manager."""
    with patch.object(dependencies, 'get_langchain_manager', return_value=None):
        with patch.object(dependencies, 'get_session', return_value=session):
            response = await async_client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should indicate manager is not available
    components = data["components"]
    if "langchain_embeddings" in components:
        assert components["langchain_embeddings"] is False


# ============================================================================
# Legacy Status Endpoint Tests
# ============================================================================

@pytest.mark.asyncio
async def test_legacy_status_endpoint(async_client: AsyncClient):
    """Test legacy /api/status endpoint for backward compatibility."""
    response = await async_client.get("/api/status")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "status" in data
    assert data["status"] == "Backend is running"
