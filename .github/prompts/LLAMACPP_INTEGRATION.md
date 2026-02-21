# LlamaCpp Provider - Integration Guide

## 📋 Overview

This guide provides step-by-step instructions for integrating the LlamaCpp provider into the ElectronAIChat backend. The LlamaCpp provider enables local LLM inference using quantized GGUF models with automatic GPU acceleration support.

## ✨ Features

- **Local Inference**: Run LLMs entirely offline with no API costs
- **Quantized Models**: Use 4-bit quantized GGUF models (~350MB for chat, ~140MB for embeddings)
- **GPU Acceleration**: Auto-detects CUDA (NVIDIA) and Metal (Apple Silicon) for faster inference
- **RAG Support**: Full support for document embeddings and similarity search
- **Streaming**: Real-time token streaming compatible with existing chat interface
- **Memory Integration**: Works with Mem0 for long-term conversation memory (requires Ollama fallback)

## 🗂️ Project Structure

After integration, your project includes:

```
backend/
├── app/
│   ├── config.py                    # ✅ Updated with LlamaCpp config
│   ├── routes/dependencies.py       # ✅ Updated with LlamaCpp DI
│   ├── memory.py                    # ✅ Updated with LlamaCpp fallback
│   ├── llamacpp_client.py          # ✅ NEW - LlamaCpp client implementation
│   ├── openai_client.py            # Existing (Ollama/OpenAI)
│   └── embeddings.py               # Existing (works with all providers)
├── models/                          # ✅ NEW - GGUF model storage
│   ├── .gitkeep                    # Directory tracked in git
│   ├── qwen3-0.6b-q4.gguf         # Download via script (~350MB)
│   └── nomic-embed-text-q4.gguf   # Download via script (~140MB)
├── scripts/                         # ✅ NEW - Utility scripts
│   ├── download_models.py          # ✅ NEW - HuggingFace model downloader
│   └── test_llamacpp.py            # ✅ NEW - Integration test script
├── .env.example                     # ✅ Updated with LlamaCpp config
├── requirements.txt                 # ✅ Updated with llama-cpp-python
└── main.py                          # ✅ Updated to support LlamaCpp
```

## 🚀 Quick Start

### 1. Install Dependencies

#### Option A: CPU Only (Widest Compatibility)

```bash
cd backend
pip install llama-cpp-python huggingface-hub tqdm
```

#### Option B: NVIDIA GPU (CUDA)

```bash
cd backend
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python --no-cache-dir
pip install huggingface-hub tqdm
```

#### Option C: Apple Silicon (Metal)

```bash
cd backend
CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python --no-cache-dir
pip install huggingface-hub tqdm
```

### 2. Download Models

```bash
cd backend
python scripts/download_models.py  # Downloads both models (~490MB total)
```

**Expected output:**
```
LlamaCpp Model Downloader
============================================================
Models directory: /path/to/backend/models

Downloading qwen3-0.6b-q4.gguf (~350MB)...
✓ Downloaded qwen3-0.6b-q4.gguf

Downloading nomic-embed-text-q4.gguf (~140MB)...
✓ Downloaded nomic-embed-text-q4.gguf

✓ All models downloaded successfully!
```

### 3. Configure Environment

Create or update `.env` file:

```bash
# Switch to LlamaCpp provider
LLM_PROVIDER=llamacpp

# Model configuration (defaults work out of the box)
LLAMACPP_MODELS_DIR=./models
LLAMACPP_CHAT_MODEL=qwen3-0.6b-q4.gguf
LLAMACPP_EMBED_MODEL=nomic-embed-text-q4.gguf

# Performance settings
LLAMACPP_N_CTX=2048
LLAMACPP_VERBOSE=false

# Optional: GPU configuration
# LLAMACPP_N_GPU_LAYERS=-1  # -1 for all layers, 0 for CPU-only
```

### 4. Test the Integration

```bash
cd backend
python scripts/test_llamacpp.py
```

**Expected output:**
```
Testing LlamaCpp Provider
============================================================

=== Model Information ===
chat_model: {'path': 'models/qwen3-0.6b-q4.gguf', 'loaded': False, 'exists': True}
embedding_model: {'path': 'models/nomic-embed-text-q4.gguf', 'loaded': False, 'exists': True}
gpu_layers: -1
context_window: 2048

=== Testing Chat Completion ===
Streaming response:
2 + 2 equals 4.
✓ Chat completion successful

=== Testing Embeddings ===
✓ Generated 2 embeddings
  Dimension: 768

============================================================
✓ All tests passed!
```

### 5. Start the Backend

```bash
cd backend
python main.py
```

The backend will start with LlamaCpp provider:
```
ElectronAIChat Backend Starting
LLM Provider: llamacpp
LlamaCpp config: provider=llamacpp, models_dir=models
LlamaCpp provider selected - using lazy initialization
All managers initialized successfully
```

## 🔧 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | Set to `llamacpp` to use LlamaCpp |
| `LLAMACPP_MODELS_DIR` | `./models` | Directory containing GGUF files |
| `LLAMACPP_CHAT_MODEL` | `qwen3-0.6b-q4.gguf` | Chat model filename |
| `LLAMACPP_EMBED_MODEL` | `nomic-embed-text-q4.gguf` | Embedding model filename |
| `LLAMACPP_N_CTX` | `2048` | Context window size |
| `LLAMACPP_N_GPU_LAYERS` | `None` (auto-detect) | GPU layers: -1=all, 0=CPU |
| `LLAMACPP_VERBOSE` | `false` | Enable llama.cpp debug logs |
| `LLAMACPP_ENABLE_PARALLEL` | `false` | Parallel processing (experimental) |

### Model Selection

The default models are optimized for balance between quality and size:

- **Chat Model**: Qwen 2.5 0.5B Instruct (Q4_K_M) - ~350MB
  - Fast inference on CPU
  - Good instruction following
  - Suitable for chat and QA tasks

- **Embedding Model**: Nomic Embed Text v1.5 (Q4_K_M) - ~140MB
  - 768-dimensional embeddings
  - Optimized for retrieval tasks
  - Compatible with ChromaDB

**Alternative models** can be downloaded from HuggingFace and configured via environment variables. Look for models with `-GGUF` suffix.

## 🎯 API Compatibility

The LlamaCpp provider is **fully compatible** with the existing API:

### Chat Streaming Endpoint

```http
POST /api/chat/stream
Content-Type: application/json

{
  "chatId": "chat-123",
  "userId": "user-456",
  "message": "What is Python?",
  "searchMode": "embeddings",
  "useMemory": true
}
```

Response format (SSE):
```
data: {"token": "Python", "done": false}
data: {"token": " is", "done": false}
data: {"token": " a", "done": false}
data: {"token": "", "done": true}
```

### Document Upload

```http
POST /documents/upload
Content-Type: multipart/form-data

chatId=chat-123&userId=user-456&file=document.pdf
```

Works identically - LlamaCpp generates embeddings for RAG.

### Settings Management

All existing settings endpoints work unchanged:
- `/api/users/{username}/settings` - GET/PUT
- Temperature, max_tokens, system_prompt - All supported

## 📊 Performance Characteristics

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 2GB | 4GB+ |
| **Storage** | 500MB | 1GB+ |
| **CPU** | Dual-core | Quad-core+ |
| **GPU** | None (CPU works) | NVIDIA/Apple Silicon |

### Inference Speed

Approximate speeds on different hardware:

| Hardware | Tokens/Second | Typical Response Time |
|----------|---------------|----------------------|
| **Apple M1/M2** (Metal) | 30-50 | 3-5 seconds |
| **NVIDIA RTX 3060** (CUDA) | 40-60 | 2-4 seconds |
| **Intel i7 CPU** | 8-15 | 10-15 seconds |

**Note**: First request loads models into memory (~30 seconds startup). Subsequent requests are fast.

### Memory Usage

| Model | RAM Usage | VRAM Usage (GPU) |
|-------|-----------|-----------------|
| **Chat Model** (loaded) | ~500MB | ~350MB |
| **Embedding Model** (loaded) | ~200MB | ~140MB |
| **Both Models** | ~700MB | ~490MB |

Models are **lazy-loaded** - only loaded when first used.

## 🔍 Troubleshooting

### Problem: Import Error - llama-cpp-python not found

**Cause**: Package not installed or compilation failed

**Solution**:
```bash
# Verify installation
pip list | grep llama-cpp-python

# Reinstall if missing
pip install llama-cpp-python

# For GPU support, use CMAKE_ARGS
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python --no-cache-dir
```

### Problem: Models Not Found

**Cause**: Models not downloaded or wrong directory

**Solution**:
```bash
# Check models directory
ls -la backend/models/

# Download models if missing
cd backend
python scripts/download_models.py

# Verify .env configuration
cat .env | grep LLAMACPP
```

### Problem: Slow Inference on GPU

**Cause**: GPU layers not offloaded

**Solution**:
```bash
# Set in .env
LLAMACPP_N_GPU_LAYERS=-1

# Verify GPU detection in logs
# Look for: "GPU layers: -1" in startup logs

# Test GPU availability
python -c "import torch; print(torch.cuda.is_available())"
```

### Problem: Memory Integration Fails

**Cause**: Mem0 doesn't support LlamaCpp directly

**Solution**:
The integration automatically falls back to Ollama for memory extraction. Ensure Ollama is running:

```bash
# Start Ollama
ollama serve

# Pull required model
ollama pull llama2:latest

# Memory will work with this fallback
```

### Problem: Different Model Loading Times

**Cause**: First-time model loading initializes weights

**Solution**:
This is normal behavior:
- **First request**: ~30 seconds (loading models)
- **Subsequent requests**: <1 second (models cached in memory)

Backend keeps models in memory until shutdown.

## 🧪 Testing

### Unit Tests

Test the LlamaCpp client directly:

```bash
cd backend
python scripts/test_llamacpp.py
```

### Integration Tests

Test with the full backend:

```bash
# 1. Start backend
python main.py

# 2. In another terminal, test chat endpoint
curl -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-chat",
    "userId": "test-user",
    "message": "Hello, how are you?",
    "searchMode": "normal",
    "useMemory": false
  }'
```

### RAG Testing

Test document embeddings:

```bash
# 1. Upload a document
curl -X POST http://127.0.0.1:8000/documents/upload \
  -F "chatId=test-chat" \
  -F "userId=test-user" \
  -F "file=@test.pdf"

# 2. Query with RAG enabled
curl -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-chat",
    "userId": "test-user",
    "message": "What does the document say about X?",
    "searchMode": "embeddings",
    "useMemory": false
  }'
```

## 🔄 Provider Switching

Switch between providers easily:

### To LlamaCpp (Local)

```bash
# .env
LLM_PROVIDER=llamacpp
```

### To Ollama (Local)

```bash
# .env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
```

### To OpenAI (Cloud)

```bash
# .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**No code changes needed** - restart backend to apply.

## 📦 Deployment Considerations

### PyInstaller Integration

When packaging with PyInstaller (for Electron distribution):

1. **Include models directory** in `backend.spec`:
```python
datas=[
    ('models/*.gguf', 'models'),
],
```

2. **Bundle llama-cpp-python** binary:
```python
hiddenimports=[
    'llama_cpp',
    'llama_cpp._utils',
],
```

3. **Models are ~490MB** - consider:
   - Separate model download step
   - Host models externally
   - Use smaller quantization (Q3 instead of Q4)

### Production Recommendations

1. **GPU Hardware**: Use NVIDIA/Apple Silicon for production speed
2. **Context Window**: Increase `LLAMACPP_N_CTX` for longer conversations (4096+)
3. **Model Selection**: Consider larger models for better quality (1B-3B range)
4. **Monitoring**: Watch RAM/VRAM usage with multiple concurrent users
5. **Caching**: Models stay loaded - restart backend to free memory

## 🔗 Resources

- [llama-cpp-python Documentation](https://llama-cpp-python.readthedocs.io/)
- [GGUF Model Hub](https://huggingface.co/models?library=gguf)
- [Quantization Guide](https://huggingface.co/docs/optimum/concept_guides/quantization)
- [ElectronAIChat Repository](https://github.com/janega/ElectronAIChat)

## 📝 License

This integration follows the same license as ElectronAIChat. GGUF models have their own licenses - check model cards on HuggingFace.

## 🤝 Contributing

Found a bug or have a suggestion? Open an issue or PR on GitHub!

---

**Need help?** Check the troubleshooting section or open a GitHub issue.
