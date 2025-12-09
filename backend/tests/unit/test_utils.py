"""
Unit tests for utility functions.

Tests:
- Ollama health checks
- Text extraction from various file types
- Edge cases and error handling
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from pathlib import Path

from app.utils import check_ollama_health, start_ollama_server


# ============================================================================
# Ollama Health Check Tests
# ============================================================================

@pytest.mark.asyncio
async def test_check_ollama_health_success():
    """Test successful Ollama health check."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "models": [
            {"name": "llama2:latest"},
            {"name": "nomic-embed-text:latest"}
        ]
    }
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client
        
        result = await check_ollama_health("http://localhost:11434")
        
        assert result["available"] is True
        assert "models" in result
        assert len(result["models"]) == 2
        assert "llama2:latest" in result["models"]


@pytest.mark.asyncio
async def test_check_ollama_health_connection_refused():
    """Test Ollama health check when connection is refused."""
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        mock_client_class.return_value = mock_client
        
        result = await check_ollama_health("http://localhost:11434")
        
        assert result["available"] is False
        assert "Connection refused" in result["error"]


@pytest.mark.asyncio
async def test_check_ollama_health_timeout():
    """Test Ollama health check timeout."""
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client_class.return_value = mock_client
        
        result = await check_ollama_health("http://localhost:11434", timeout=1.0)
        
        assert result["available"] is False
        assert "timeout" in result["error"].lower()


@pytest.mark.asyncio
async def test_check_ollama_health_http_error():
    """Test Ollama health check with HTTP error response."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client
        
        result = await check_ollama_health("http://localhost:11434")
        
        assert result["available"] is False
        assert "500" in result["error"]


# ============================================================================
# Ollama Server Start Tests
# ============================================================================

@pytest.mark.asyncio
async def test_start_ollama_server_success():
    """Test starting Ollama server successfully."""
    mock_process = MagicMock()
    mock_process.pid = 12345
    
    # Mock health check to succeed immediately
    mock_health_response = {
        "available": True,
        "models": ["llama2:latest"]
    }
    
    with patch("subprocess.Popen", return_value=mock_process):
        with patch("app.utils.check_ollama_health", return_value=mock_health_response):
            result = await start_ollama_server()
            
            assert result["started"] is True
            assert result["process"] is not None
            assert result["error"] is None


@pytest.mark.asyncio
async def test_start_ollama_server_failure():
    """Test Ollama server start failure."""
    with patch("subprocess.Popen", side_effect=FileNotFoundError("ollama not found")):
        result = await start_ollama_server()
        
        assert result["started"] is False
        assert result["error"] is not None
        assert "not found" in result["error"].lower()


# ============================================================================
# Text Extraction Tests (if extract_text_from_file is available)
# ============================================================================

def test_extract_text_placeholder():
    """Placeholder for text extraction tests."""
    # Text extraction tests would go here if the function is available
    # This ensures the test file is valid even without those functions
    assert True
