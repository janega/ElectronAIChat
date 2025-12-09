# ElectronAIChat Backend Tests

Comprehensive test suite for the ElectronAIChat backend using pytest, pytest-asyncio, and FastAPI TestClient.

## Test Structure

```
tests/
├── conftest.py                    # Shared fixtures and test configuration
├── pytest.ini                     # Pytest configuration (in parent directory)
├── unit/                         # Unit tests for isolated components
│   ├── test_database.py          # SQLModel database models
│   ├── test_embeddings.py        # LangChain embedding manager
│   ├── test_memory.py            # Mem0 memory manager
│   ├── test_schemas.py           # Pydantic schema validation
│   └── test_utils.py             # Utility functions
└── integration/                  # Integration tests for API endpoints
    ├── test_routes_health.py     # Health check endpoints
    └── test_routes_chat.py       # Chat streaming endpoints
```

## Running Tests

### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

The requirements include:
- `pytest>=7.4.0` - Test framework
- `pytest-asyncio>=0.21.0` - Async test support
- `pytest-mock>=3.11.0` - Mocking utilities
- `pytest-cov>=4.1.0` - Code coverage reporting

### Run All Tests

```bash
# Run all tests with coverage
pytest

# Run all tests quietly
pytest -q

# Run with verbose output
pytest -v
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# Specific test file
pytest tests/unit/test_database.py

# Specific test function
pytest tests/unit/test_database.py::test_user_creation
```

### Run Tests with Coverage Report

```bash
# Terminal coverage report
pytest --cov=app --cov-report=term-missing

# HTML coverage report (opens in browser)
pytest --cov=app --cov-report=html
open htmlcov/index.html  # macOS/Linux
start htmlcov/index.html # Windows
```

### CI/CD Mode

For continuous integration (as specified in requirements):

```bash
pytest --maxfail=1 --disable-warnings -q
```

This configuration:
- Stops after first failure (`--maxfail=1`)
- Suppresses warnings for cleaner output
- Runs in quiet mode

## Test Categories

### Unit Tests

**test_database.py** - SQLModel Database Models
- User, UserSettings, Chat, Message, Document models
- Field validation and constraints
- Relationships between models
- Default values and auto-generation

**test_embeddings.py** - LangChain Embedding Manager
- Initialization with different providers (Ollama, OpenAI)
- Text splitting and chunking
- Embedding generation
- Document search (mocked)
- Error handling

**test_memory.py** - Mem0 Memory Manager
- Memory initialization with fallback
- Memory search and retrieval
- Conversation pair storage
- Deduplication behavior
- Semantic filtering

**test_schemas.py** - Pydantic Schema Validation
- DocumentMetadata, UploadResponse schemas
- HealthResponse schema validation
- EmbeddingTestResponse schema
- Type checking and constraints
- Serialization/deserialization

**test_utils.py** - Utility Functions
- Ollama health checks
- Ollama server startup
- Connection error handling
- Timeout scenarios

### Integration Tests

**test_routes_health.py** - Health Check Endpoints
- Health check endpoint functionality
- Component status reporting
- Database connectivity validation
- Provider configuration checks
- Error handling

**test_routes_chat.py** - Chat Streaming Endpoints
- SSE streaming format
- Message persistence to database
- RAG (Retrieval-Augmented Generation) context
- Memory context integration
- User settings application
- Auto-creation of chats and users
- Error handling scenarios

## Test Fixtures

### Database Fixtures (conftest.py)

- `test_engine` - In-memory SQLite database
- `session` - Database session for tests
- `test_user` - Pre-created test user
- `test_user_settings` - User settings for tests
- `test_chat` - Pre-created test chat

### Mock Manager Fixtures

- `mock_langchain_manager` - Mocked LangChain embedding manager
- `mock_mem0_manager` - Mocked Mem0 memory manager
- `mock_openai_client` - Mocked OpenAI/LLM client
- `mock_llm_response` - Sample LLM response data
- `mock_embeddings` - Sample embedding vectors

### FastAPI Test Client

- `test_app` - FastAPI application instance for testing
- `async_client` - Async HTTP client for API requests

## Mocking Strategy

### External LLM Calls

All LLM API calls are mocked to ensure:
- **Reproducibility**: Tests produce consistent results
- **Speed**: No network latency or actual LLM processing
- **Isolation**: Tests don't depend on external services

Example:
```python
@pytest.mark.asyncio
async def test_chat_with_mocked_llm(mock_openai_client):
    async def mock_stream(*args, **kwargs):
        yield {"token": "Hello", "done": False}
        yield {"token": "", "done": True}
    
    mock_openai_client.create_chat_completion = AsyncMock(return_value=mock_stream())
    # Test uses mocked response
```

### Database Operations

Tests use in-memory SQLite databases:
- Created fresh for each test
- No cleanup required
- Fast execution

### Vector Storage

ChromaDB and vector operations are mocked:
- No actual embedding generation
- No disk I/O
- Predictable search results

## Code Coverage

Current coverage: **27%** (58 tests passing)

Coverage highlights:
- `app/schemas.py`: 100%
- `app/database.py`: 94%
- `app/config.py`: 84%

Areas for improvement:
- Route handlers (currently 0% - need integration tests)
- Document processing utilities
- OpenAI client wrapper

## Test Validation Approach

Following validation-first principles:

1. **Type Correctness**: Assert Pydantic model types
2. **Business Logic**: Validate expected behavior
3. **Edge Cases**: Test boundary conditions
4. **Error Handling**: Verify graceful failure modes
5. **Reproducibility**: Use deterministic mocks

Example:
```python
def test_user_settings_validation_temperature():
    """Test temperature validation constraints."""
    # Type correctness
    settings = UserSettings(user_id="test-id", temperature=0.5)
    assert isinstance(settings.temperature, float)
    
    # Business logic - boundary values
    settings_min = UserSettings(user_id="test-id", temperature=0.0)
    assert settings_min.temperature == 0.0
    
    settings_max = UserSettings(user_id="test-id", temperature=2.0)
    assert settings_max.temperature == 2.0
```

## Adding New Tests

### Unit Test Template

```python
import pytest
from unittest.mock import MagicMock, patch

def test_my_function():
    """Test description following docstring convention."""
    # Arrange
    expected = "expected_value"
    
    # Act
    result = my_function()
    
    # Assert
    assert result == expected
```

### Async Test Template

```python
@pytest.mark.asyncio
async def test_async_function():
    """Test async function."""
    result = await async_function()
    assert result is not None
```

### Integration Test Template

```python
@pytest.mark.asyncio
async def test_api_endpoint(async_client, session, mock_dependencies):
    """Test API endpoint with mocked dependencies."""
    with patch.object(dependencies, 'get_manager', return_value=mock_dependencies):
        response = await async_client.post(
            "/api/endpoint",
            json={"key": "value"}
        )
    
    assert response.status_code == 200
    assert "expected_field" in response.json()
```

## Troubleshooting

### Import Errors

If you see `ModuleNotFoundError`:
```bash
# Ensure backend directory is in PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/path/to/backend"
# Or install in development mode
pip install -e .
```

### Async Test Warnings

If you see `RuntimeWarning: coroutine was never awaited`:
- Add `@pytest.mark.asyncio` decorator
- Ensure `pytest-asyncio` is installed
- Use `await` for async functions

### Database Errors

If tests fail with database constraints:
- Check test fixtures in `conftest.py`
- Verify model field requirements match test data
- Use `session.rollback()` in cleanup

### Mock Not Being Called

If `assert_called` fails:
- Verify the mock is being injected correctly
- Check import paths match exactly
- Use `patch.object()` for class methods

## Best Practices

1. **Test Independence**: Each test should be self-contained
2. **Descriptive Names**: Use clear, descriptive test function names
3. **Single Assertion**: Prefer single logical assertion per test
4. **Mock External Deps**: Always mock external services (LLM, APIs)
5. **Use Fixtures**: Leverage conftest.py for shared setup
6. **Document Tests**: Include docstrings explaining test purpose
7. **Fast Execution**: Keep unit tests under 1 second each
8. **Reproducible**: Tests should always produce same result

## Contributing

When adding new features to the backend:

1. Write tests first (TDD approach)
2. Ensure existing tests pass: `pytest`
3. Add new tests for new functionality
4. Update fixtures in `conftest.py` if needed
5. Maintain or improve code coverage
6. Document any special test requirements

## References

- [Pytest Documentation](https://docs.pytest.org/)
- [Pytest-Asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pydantic Validation](https://docs.pydantic.dev/)
- [SQLModel Testing](https://sqlmodel.tiangolo.com/tutorial/testing/)
