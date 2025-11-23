# Ollama Integration Guide

## Overview

ElectronAIChat supports **Ollama** for local LLM hosting, enabling privacy-focused AI chat without cloud dependencies. This guide covers setup, configuration, and troubleshooting for Ollama integration.

## Architecture

The application uses Ollama for three key functions:

1. **Embeddings** - Document vectorization via `nomic-embed-text` model
2. **Chat Completions** - Conversational AI via models like `llama3`, `llama2`, `mistral`
3. **Memory System** - Long-term context via Mem0 with Ollama backend

### Component Integration

```
FastAPI Backend → LangChain → Ollama
                      ↓
                  ChromaDB (Embeddings)
                      ↓
                Streaming Response
                      ↓
                Mem0 + ChromaDB (Memory)
```

**Key Files:**
- `backend/app/config.py` - Provider selection and configuration
- `backend/app/embeddings.py` - LangChain Ollama embeddings
- `backend/app/openai_client.py` - ChatOllama LLM client
- `backend/app/memory.py` - Mem0 with Ollama backend

## Prerequisites

### 1. Install Ollama

**Windows/macOS/Linux:**
```bash
# Visit https://ollama.ai and download installer (recommended)
# Or use command line (macOS/Linux - inspect script first for security):
# curl -fsSL https://ollama.com/install.sh | sh
```

**Verify Installation:**
```bash
ollama --version
```

### 2. Pull Required Models

**Embedding Model (Required):**
```bash
ollama pull nomic-embed-text
```

**LLM Models (Choose one or more):**
```bash
# Recommended for chat (faster, smaller)
ollama pull llama3        # 4.7GB - Best performance
ollama pull mistral       # 4.1GB - Good quality

# Alternative options
ollama pull llama2        # 3.8GB - Reliable baseline
ollama pull codellama     # 3.8GB - Code-focused
ollama pull phi           # 1.6GB - Lightweight
```

**Check Downloaded Models:**
```bash
ollama list
```

## Configuration

### Backend Environment Variables

Create or edit `backend/.env`:

```bash
# =============================================================================
# LLM PROVIDER CONFIGURATION
# =============================================================================
LLM_PROVIDER=ollama

# -----------------------------------------------------------------------------
# OLLAMA SETTINGS
# -----------------------------------------------------------------------------
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3           # Change to your preferred model

# -----------------------------------------------------------------------------
# APPLICATION SETTINGS
# -----------------------------------------------------------------------------
APP_NAME=ElectronAIChat
USE_APP_DATA_DIR=false
BASE_DIR=.
LOG_LEVEL=INFO

# -----------------------------------------------------------------------------
# FILE UPLOAD SETTINGS
# -----------------------------------------------------------------------------
MAX_UPLOAD_SIZE_MB=100

# OCR Configuration (Optional - for PDF processing)
# Windows example: D:\path\to\poppler-xx.xx.x\Library\bin
POPPLER_PATH=
```

### Model Selection

Edit `OLLAMA_LLM_MODEL` in `.env` to use different models:

| Model | Size | Use Case | Quality | Speed |
|-------|------|----------|---------|-------|
| `llama3` | 4.7GB | General chat | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| `mistral` | 4.1GB | Balanced | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| `llama2` | 3.8GB | Reliable baseline | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| `codellama` | 3.8GB | Code assistance | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| `phi` | 1.6GB | Lightweight/testing | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## Running with Ollama

### Development Mode

**Terminal 1 - Start Ollama (if not already running):**
```bash
ollama serve
```

**Terminal 2 - Start Backend:**
```bash
cd backend
python main.py
```

**Terminal 3 - Start Frontend:**
```bash
cd electron
npm run start
```

### Production Build

Ollama must be running on the system where the packaged app is deployed:

```bash
# Ensure Ollama is running
ollama serve

# Package application
cd electron
npm run package
```

## Verification

### Test Ollama Connection

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Expected response: JSON list of installed models
```

### Test Backend Integration

```bash
# Start backend and check logs
cd backend
python main.py

# Look for these log messages:
# ✅ "LLM Provider: ollama"
# ✅ "Ollama Host: http://localhost:11434"
# ✅ "Ollama LLM Model: llama3"
# ✅ "Ollama Embed Model: nomic-embed-text"
# ✅ "All managers initialized successfully"
```

### Test Chat Completion

```bash
# Test streaming endpoint
curl -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-chat",
    "userId": "test-user",
    "message": "Hello, how are you?",
    "searchMode": "normal",
    "useMemory": false
  }'

# Expected: Server-Sent Events with streaming tokens
```

### Test Embeddings

```bash
# Upload a test document
curl -X POST http://127.0.0.1:8000/documents/upload \
  -F "file=@test.txt" \
  -F "chatId=test-chat" \
  -F "userId=test-user"

# Expected: JSON response with document ID and chunk count
```

## Features Powered by Ollama

### 1. Document RAG (Retrieval-Augmented Generation)

**How it works:**
1. Upload PDF/TXT/JSON documents via `/documents/upload`
2. Backend uses `nomic-embed-text` to generate embeddings
3. Embeddings stored in ChromaDB per-chat collection
4. During chat, relevant document chunks retrieved via similarity search
5. Context injected into LLM prompt for informed responses

**Code reference:** `backend/app/embeddings.py`

### 2. Streaming Chat Completions

**How it works:**
1. Frontend sends chat request to `/api/chat/stream`
2. Backend uses `ChatOllama` from `langchain-ollama`
3. Tokens stream via Server-Sent Events (SSE)
4. Frontend displays tokens progressively

**Code reference:** `backend/app/openai_client.py`

### 3. Long-Term Memory (Mem0)

**How it works:**
1. After each chat, messages stored in Mem0
2. Mem0 uses Ollama to extract semantic facts
3. Facts stored in ChromaDB with deduplication
4. Relevant memories retrieved before generating responses
5. Context enhances continuity across sessions

**Code reference:** `backend/app/memory.py`

## Troubleshooting

### Issue: "Connection refused" to Ollama

**Solution:**
```bash
# Check if Ollama is running
ps aux | grep ollama  # Linux/Mac
tasklist | findstr ollama  # Windows

# Start Ollama if not running
ollama serve
```

### Issue: Model not found

**Symptoms:** 
```
Error: model 'llama3' not found
```

**Solution:**
```bash
# Pull the missing model
ollama pull llama3

# Verify it's installed
ollama list
```

### Issue: Slow response times

**Causes:**
- Model too large for hardware (needs GPU acceleration)
- First request loads model into memory (20-60s)
- Context window too large

**Solutions:**
```bash
# Use smaller model
OLLAMA_LLM_MODEL=phi  # 1.6GB lightweight model

# Check system resources
# Ollama benefits from:
# - 8GB+ RAM for small models (phi, llama2)
# - 16GB+ RAM for large models (llama3, mistral)
# - GPU acceleration (NVIDIA CUDA, AMD ROCm, Apple Metal)
```

### Issue: Embeddings fail

**Symptoms:**
```
Error: Failed to generate embeddings
```

**Solution:**
```bash
# Ensure embedding model is installed
ollama pull nomic-embed-text

# Verify OLLAMA_EMBED_MODEL matches installed model
# In .env: OLLAMA_EMBED_MODEL=nomic-embed-text
```

### Issue: Backend initialization timeout

**Symptoms:**
```
Error: Backend health check failed after 30 seconds
```

**Causes:**
- First startup loads models into memory (slow)
- Database initialization on first run

**Solution:**
1. Wait longer (first startup can take 60s)
2. Pre-load models manually:
   ```bash
   # Pre-warm Ollama models
   ollama run llama3 "test"
   ollama run nomic-embed-text
   ```
3. Check logs in `{BASE_DIR}/logs/app.log` for actual errors

### Issue: Mem0 initialization fails

**Symptoms:**
```
WARNING: mem0 initialization failed
INFO: Falling back to in-memory MemoryStub
```

**Solutions:**
1. **Install mem0ai package:**
   ```bash
   cd backend
   pip install mem0ai
   ```

2. **Check Ollama connectivity:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

3. **Verify config in logs:**
   - Look for `"mem0 Memory initialized successfully with provider: ollama"`
   - If using MemoryStub, long-term memory is disabled (app still works)

### Debug Mode

Enable detailed logging:

```bash
# In backend/.env
LOG_LEVEL=DEBUG

# Run backend and check logs
cd backend
python main.py

# Logs location:
# - Console: INFO and above
# - File: {BASE_DIR}/logs/app.log (everything)
# - Errors: {BASE_DIR}/logs/error.log (errors only)
```

## Performance Tuning

### Hardware Recommendations

**Minimum:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 10GB for models

**Recommended:**
- CPU: 8+ cores
- RAM: 16GB+
- GPU: NVIDIA GPU with 6GB+ VRAM (10x faster)
- Storage: SSD with 20GB+ for models

### GPU Acceleration

**NVIDIA (CUDA):**
```bash
# Ollama automatically uses CUDA if available
nvidia-smi  # Check GPU availability
```

**AMD (ROCm):**
```bash
# Ollama supports ROCm on Linux
rocm-smi  # Check GPU availability
```

**Apple Silicon (Metal):**
```bash
# Ollama uses Metal acceleration automatically on M1/M2/M3
```

### Model Context Window

Adjust in user settings via frontend or `backend/app/config.py`:

```python
DEFAULT_SETTINGS = {
    "temperature": 0.7,
    "max_tokens": 2048,      # Smaller = faster, less memory
    "top_p": 0.9,
    "top_k": 40,
    "system_prompt": "You are a helpful assistant.",
    "use_memory": True,
}
```

## Switching to OpenAI

To compare Ollama vs OpenAI or use cloud LLMs:

```bash
# Edit backend/.env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_LLM_MODEL=gpt-3.5-turbo
OPENAI_EMBED_MODEL=text-embedding-3-small

# Restart backend
cd backend
python main.py
```

No code changes needed - dependency injection handles provider switching.

## Advanced Configuration

### Custom Ollama Models

Use fine-tuned or custom models:

```bash
# Create custom model (Modelfile)
ollama create my-custom-model -f Modelfile

# Update .env
OLLAMA_LLM_MODEL=my-custom-model
```

### Remote Ollama Server

Run Ollama on a separate machine:

```bash
# On remote server (192.168.1.100):
OLLAMA_HOST=0.0.0.0 ollama serve

# In backend/.env:
OLLAMA_HOST=http://192.168.1.100:11434
```

### Ollama API Parameters

Fine-tune generation quality in `backend/app/openai_client.py`:

```python
# ChatOllama initialization
ChatOllama(
    base_url=OLLAMA_HOST,
    model=DEFAULT_OLLAMA_LLM_MODEL,
    temperature=0.7,       # Creativity (0.0-1.0)
    num_ctx=2048,         # Context window size
    top_p=0.9,            # Nucleus sampling
    top_k=40,             # Token filtering
    repeat_penalty=1.1,   # Reduce repetition
    num_predict=2048,     # Max output tokens
)
```

## Resources

- **Ollama Documentation:** https://github.com/ollama/ollama
- **LangChain Ollama Integration:** https://python.langchain.com/docs/integrations/llms/ollama
- **Model Library:** https://ollama.com/library
- **Mem0 Documentation:** https://docs.mem0.ai/

## Support

For issues specific to:
- **Ollama installation:** https://github.com/ollama/ollama/issues
- **ElectronAIChat integration:** Open an issue in this repository
- **LangChain integration:** https://github.com/langchain-ai/langchain/issues
