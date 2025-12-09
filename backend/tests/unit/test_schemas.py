"""
Unit tests for Pydantic schemas.

Tests:
- Schema validation
- Type checking
- Field constraints
- Serialization/deserialization
"""
import pytest
from pydantic import ValidationError

from app.schemas import DocumentMetadata, UploadResponse, HealthResponse, EmbeddingTestResponse


# ============================================================================
# DocumentMetadata Schema Tests
# ============================================================================

def test_document_metadata_valid():
    """Test DocumentMetadata with valid data."""
    doc = DocumentMetadata(
        id="doc-123",
        name="test.pdf",
        size=1024,
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=5
    )
    
    assert doc.id == "doc-123"
    assert doc.name == "test.pdf"
    assert doc.size == 1024
    assert doc.chunks == 5


def test_document_metadata_type_validation():
    """Test DocumentMetadata type validation."""
    # Valid creation
    doc = DocumentMetadata(
        id="doc-123",
        name="test.pdf",
        size=1024,
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=5
    )
    
    assert isinstance(doc.size, int)
    assert isinstance(doc.chunks, int)
    assert isinstance(doc.name, str)


def test_document_metadata_missing_required_field():
    """Test DocumentMetadata with missing required field."""
    with pytest.raises(ValidationError):
        DocumentMetadata(
            id="doc-123",
            name="test.pdf",
            # Missing size
            uploadedAt="2023-01-01T00:00:00Z",
            contentType="application/pdf",
            chunks=5
        )


# ============================================================================
# UploadResponse Schema Tests
# ============================================================================

def test_upload_response_valid():
    """Test UploadResponse with valid data."""
    doc = DocumentMetadata(
        id="doc-123",
        name="test.pdf",
        size=1024,
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=5
    )
    
    response = UploadResponse(success=True, document=doc)
    
    assert response.success is True
    assert response.document.id == "doc-123"


def test_upload_response_failure():
    """Test UploadResponse for failure case."""
    doc = DocumentMetadata(
        id="doc-456",
        name="failed.pdf",
        size=0,
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=0
    )
    
    response = UploadResponse(success=False, document=doc)
    
    assert response.success is False


# ============================================================================
# HealthResponse Schema Tests
# ============================================================================

def test_health_response_healthy():
    """Test HealthResponse for healthy status."""
    response = HealthResponse(
        status="healthy",
        provider="ollama",
        components={
            "database": True,
            "langchain": True,
            "memory": True
        }
    )
    
    assert response.status == "healthy"
    assert response.provider == "ollama"
    assert response.components["database"] is True


def test_health_response_unhealthy():
    """Test HealthResponse for unhealthy status."""
    response = HealthResponse(
        status="unhealthy",
        provider="ollama",
        components={
            "database": False,
            "error": "Connection failed"
        }
    )
    
    assert response.status == "unhealthy"
    assert "error" in response.components


def test_health_response_different_providers():
    """Test HealthResponse with different providers."""
    providers = ["ollama", "openai"]
    
    for provider in providers:
        response = HealthResponse(
            status="healthy",
            provider=provider,
            components={}
        )
        assert response.provider == provider


# ============================================================================
# EmbeddingTestResponse Schema Tests
# ============================================================================

def test_embedding_test_response_valid():
    """Test EmbeddingTestResponse with valid data."""
    response = EmbeddingTestResponse(
        success=True,
        text="Test text",
        embedding_length=768,
        provider="ollama",
        sample=[0.1, 0.2, 0.3, 0.4, 0.5]
    )
    
    assert response.success is True
    assert response.embedding_length == 768
    assert len(response.sample) == 5


def test_embedding_test_response_validation():
    """Test EmbeddingTestResponse field validation."""
    response = EmbeddingTestResponse(
        success=True,
        text="Test",
        embedding_length=1536,
        provider="openai",
        sample=[0.0] * 10
    )
    
    assert isinstance(response.embedding_length, int)
    assert isinstance(response.sample, list)
    assert all(isinstance(x, float) for x in response.sample)


# ============================================================================
# Schema Serialization Tests
# ============================================================================

def test_document_metadata_serialization():
    """Test DocumentMetadata JSON serialization."""
    doc = DocumentMetadata(
        id="doc-123",
        name="test.pdf",
        size=1024,
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=5
    )
    
    # Convert to dict (Pydantic v2)
    doc_dict = doc.model_dump()
    
    assert isinstance(doc_dict, dict)
    assert doc_dict["id"] == "doc-123"
    assert doc_dict["size"] == 1024


def test_health_response_serialization():
    """Test HealthResponse JSON serialization."""
    response = HealthResponse(
        status="healthy",
        provider="ollama",
        components={"database": True}
    )
    
    # Convert to dict
    response_dict = response.model_dump()
    
    assert isinstance(response_dict, dict)
    assert response_dict["status"] == "healthy"
    assert "components" in response_dict


# ============================================================================
# Edge Cases and Constraints
# ============================================================================

def test_document_metadata_with_large_size():
    """Test DocumentMetadata with large file size."""
    doc = DocumentMetadata(
        id="doc-large",
        name="large.pdf",
        size=1024 * 1024 * 100,  # 100 MB
        uploadedAt="2023-01-01T00:00:00Z",
        contentType="application/pdf",
        chunks=1000
    )
    
    assert doc.size == 1024 * 1024 * 100


def test_health_response_with_complex_components():
    """Test HealthResponse with nested component data."""
    response = HealthResponse(
        status="degraded",
        provider="ollama",
        components={
            "database": {
                "connected": True,
                "tables": ["users", "chats", "messages"]
            },
            "langchain": {
                "initialized": True,
                "provider": "ollama"
            }
        }
    )
    
    assert response.status == "degraded"
    assert isinstance(response.components["database"], dict)
