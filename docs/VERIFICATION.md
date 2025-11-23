# Ollama Integration Verification

This document explains how to verify that the Ollama integration is working correctly.

## Verification Script

The repository includes a verification script that checks the Ollama integration without needing Ollama to be running.

### Running the Verification

```bash
cd backend
python verify_ollama_integration.py
```

### What It Checks

The script verifies 7 key aspects:

1. **Configuration Loading** ✅
   - Checks `LLM_PROVIDER=ollama` is set
   - Verifies Ollama host configuration
   - Confirms model settings

2. **Embeddings Manager** 🔧
   - Tests `LangChainEmbeddingManager` import
   - Verifies `langchain-ollama` package
   - Checks `chromadb` availability

3. **OpenAI Client (LLM)** 🔧
   - Tests `EnhancedOpenAIClient` import
   - Verifies `ChatOllama` availability
   - Checks LangChain integration

4. **Memory Manager** 🔧
   - Tests `Mem0MemoryManager` import
   - Checks `mem0ai` package (optional)
   - Verifies fallback mechanism

5. **Database Models** 🔧
   - Tests SQLModel imports
   - Verifies schema definitions

6. **API Routes** 🔧
   - Tests route module imports
   - Verifies endpoint structure

7. **FastAPI Application** ✅
   - Checks main.py structure
   - Verifies dependency injection
   - Confirms abstraction layer usage

### Expected Output

```
╔==============================================================================╗
║                    OLLAMA INTEGRATION VERIFICATION                         ║
╚==============================================================================╝

================================================================================
TEST 1: Configuration Loading
================================================================================
✅ Config loaded successfully
   Provider: ollama
   Ollama Host: http://localhost:11434
   Ollama LLM Model: llama3
   Ollama Embed Model: nomic-embed-text
✅ Provider correctly set to Ollama

[... more tests ...]

================================================================================
SUMMARY
================================================================================
✅ PASS - Configuration Loading
✅ PASS - Embeddings Manager
✅ PASS - OpenAI Client (LLM)
✅ PASS - Memory Manager
✅ PASS - Database Models
✅ PASS - API Routes
✅ PASS - FastAPI Application
================================================================================
Results: 7/7 tests passed
✅ All tests passed! Ollama integration is correctly configured.
```

## Manual Verification Steps

### 1. Check Ollama Installation

```bash
ollama --version
# Expected: Ollama version x.x.x
```

### 2. Check Models

```bash
ollama list
# Expected: nomic-embed-text and at least one LLM model
```

### 3. Test Ollama API

```bash
curl http://localhost:11434/api/tags
# Expected: JSON response with model list
```

### 4. Test Backend Configuration

```bash
cd backend
python -c "from app.config import PROVIDER, OLLAMA_HOST; print(f'Provider: {PROVIDER}, Host: {OLLAMA_HOST}')"
# Expected: Provider: ollama, Host: http://localhost:11434
```

### 5. Test Embeddings Manager

```bash
cd backend
python -c "from app.embeddings import LangChainEmbeddingManager; mgr = LangChainEmbeddingManager('ollama'); print('✅ Embeddings manager initialized')"
# Expected: ✅ Embeddings manager initialized
```

### 6. Test OpenAI Client

```bash
cd backend
python -c "from app.openai_client import EnhancedOpenAIClient; client = EnhancedOpenAIClient(base_url='http://localhost:11434', api_key='ollama', provider='ollama'); print('✅ LLM client initialized')"
# Expected: ✅ LLM client initialized
```

### 7. Test Backend Startup

```bash
cd backend
python main.py
# Wait for: "All managers initialized successfully"
# Press Ctrl+C to stop
```

### 8. Test API Endpoint

```bash
# In another terminal, with backend running:
curl http://127.0.0.1:8000/
# Expected: JSON response with API info

curl http://127.0.0.1:8000/api/health
# Expected: {"status": "healthy", "provider": "ollama", ...}
```

### 9. Test Chat Stream

```bash
curl -N -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-123",
    "userId": "test-user",
    "message": "Hello! Can you hear me?",
    "searchMode": "normal",
    "useMemory": false
  }'
# Expected: Server-Sent Events stream with tokens
```

### 10. Test Document Upload

```bash
# Create test file
echo "This is a test document for RAG." > test.txt

# Upload
curl -X POST http://127.0.0.1:8000/documents/upload \
  -F "file=@test.txt" \
  -F "chatId=test-123" \
  -F "userId=test-user"
# Expected: {"message": "...", "documentId": "...", "chunksAdded": 1}

# Clean up
rm test.txt
```

## Integration Test Checklist

Use this checklist to verify end-to-end functionality:

- [ ] Ollama installed and running
- [ ] Required models pulled (`nomic-embed-text`, `llama3`)
- [ ] Backend dependencies installed
- [ ] Backend starts without errors
- [ ] Health endpoint returns `"provider": "ollama"`
- [ ] Chat streaming works
- [ ] Document upload works
- [ ] RAG retrieval works (upload doc, ask about it)
- [ ] Memory system works (send messages, verify storage)
- [ ] Frontend connects to backend
- [ ] Full app workflow (create chat, send message, upload doc)

## Common Issues and Fixes

### Issue: "langchain-ollama not available"

**Fix:**
```bash
pip install langchain-ollama
```

### Issue: "ChatOllama not available"

This is the same as above - `ChatOllama` comes from `langchain-ollama`:
```bash
pip install langchain-ollama
```

### Issue: "chromadb not available"

**Fix:**
```bash
pip install chromadb
```

### Issue: "mem0 not available"

**Fix (optional):**
```bash
pip install mem0ai
```

**Note:** App works without mem0 using fallback `MemoryStub`.

### Issue: Configuration not loading

**Check:**
```bash
# Verify .env file exists
ls backend/.env

# If not, copy from example
cp backend/.env.example backend/.env
```

### Issue: Wrong provider selected

**Fix:**
```bash
# Edit backend/.env
echo "LLM_PROVIDER=ollama" >> backend/.env
```

## Automated Testing

For CI/CD pipelines, use the verification script:

```bash
cd backend
python verify_ollama_integration.py
exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "✅ Ollama integration verified"
else
    echo "❌ Ollama integration verification failed"
    exit 1
fi
```

## Code Quality Checks

### Syntax Check

```bash
cd backend
python -m py_compile main.py
python -m py_compile app/config.py
python -m py_compile app/embeddings.py
python -m py_compile app/openai_client.py
python -m py_compile app/memory.py
```

### Import Check

```bash
cd backend
python -c "import app.config"
python -c "import app.database"
python -c "import app.db_manager"
```

### Type Hints (Optional)

```bash
cd backend
pip install mypy
mypy app/config.py --ignore-missing-imports
```

## Performance Benchmarks

### Expected Response Times

| Operation | First Run | Subsequent Runs |
|-----------|-----------|-----------------|
| Backend startup | 20-30s | 5-10s |
| First chat response | 30-60s | 2-5s |
| Document upload (1MB) | 5-10s | 5-10s |
| Embedding generation | 2-5s | 2-5s |
| Memory search | <1s | <1s |

**Note:** First runs are slower due to model loading into memory.

### Hardware Impact

| Model | RAM Usage | First Token Latency | Tokens/sec |
|-------|-----------|-------------------|-----------|
| `phi` | ~2GB | 5-10s | 20-30 |
| `llama2` | ~4GB | 10-20s | 15-25 |
| `llama3` | ~5GB | 15-30s | 10-20 |
| `mistral` | ~4.5GB | 10-20s | 15-25 |

With GPU acceleration, tokens/sec can increase 5-10x.

## Troubleshooting Tips

1. **Check logs:** `backend/logs/app.log` has detailed info
2. **Enable debug:** Set `LOG_LEVEL=DEBUG` in `.env`
3. **Test Ollama separately:** `ollama run llama3 "test"`
4. **Verify port availability:** `lsof -ti:8000` (should be empty)
5. **Check Python version:** `python --version` (needs 3.8+)

## Success Criteria

The Ollama integration is successfully verified when:

1. ✅ All verification script tests pass
2. ✅ Backend starts with "All managers initialized successfully"
3. ✅ Health endpoint shows `"provider": "ollama"`
4. ✅ Chat stream returns tokens from Ollama
5. ✅ Documents can be uploaded and embedded
6. ✅ RAG retrieval returns relevant context
7. ✅ Memory system stores and retrieves memories

## Next Steps After Verification

Once verified, you can:

1. **Customize models:** Edit `OLLAMA_LLM_MODEL` in `.env`
2. **Tune parameters:** Adjust temperature, top_p, top_k in settings
3. **Add custom prompts:** Modify system prompt in user settings
4. **Deploy production:** Build with `npm run package`
5. **Monitor performance:** Check `logs/app.log` for metrics

## Resources

- **Verification Script:** `backend/verify_ollama_integration.py`
- **Setup Guide:** [OLLAMA_SETUP.md](OLLAMA_SETUP.md)
- **Quick Start:** [QUICKSTART.md](QUICKSTART.md)
- **Main README:** [../README.md](../README.md)
