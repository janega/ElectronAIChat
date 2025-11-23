# Quick Start Guide

Get ElectronAIChat running in 5 minutes with Ollama.

## Step 1: Install Ollama

### Windows
1. Download from https://ollama.ai/download/windows
2. Run the installer
3. Ollama will start automatically

### macOS
```bash
# Option 1: Download from https://ollama.ai/download/mac (recommended)
# Option 2: Use command line (inspect script first for security)
# curl -fsSL https://ollama.com/install.sh | sh
```

### Linux
```bash
# Option 1: Download from https://ollama.ai/download (recommended)
# Option 2: Use install script (inspect first for security)
# curl -fsSL https://ollama.com/install.sh | sh
```

**Verify installation:**
```bash
ollama --version
```

## Step 2: Download Models

```bash
# Required for embeddings (document search)
ollama pull nomic-embed-text

# Recommended for chat (best quality)
ollama pull llama3

# Alternative: lightweight model for testing
ollama pull phi
```

**Check downloaded models:**
```bash
ollama list
```

## Step 3: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Note:** This may take 2-3 minutes to install all packages.

## Step 4: Configure Backend

```bash
cd backend
cp .env.example .env
```

**Edit `.env` if needed:**
- Default uses `llama3` - change `OLLAMA_LLM_MODEL` if you pulled a different model
- Default Ollama host is `http://localhost:11434` - usually doesn't need changes

## Step 5: Install Frontend Dependencies

```bash
cd electron
npm install
```

**Note:** This may take 3-5 minutes on first run.

## Step 6: Run the App

Open **3 terminals**:

**Terminal 1 - Ollama:**
```bash
ollama serve
```
Leave this running. You should see: `Ollama is running`

**Terminal 2 - Backend:**
```bash
cd backend
python main.py
```
Wait for: `All managers initialized successfully`

**Terminal 3 - Frontend:**
```bash
cd electron
npm run start
```
Wait for Electron window to open.

## You're Done! 🎉

The app should now be running. Try:

1. **Create a chat** - Click "New Chat"
2. **Send a message** - Type and press Enter
3. **Upload a document** - Click upload icon, select PDF/TXT file
4. **Ask about the document** - Enable "Search Documents" toggle

## Troubleshooting

### Ollama not running

**Symptoms:** Backend logs show "Connection refused" to localhost:11434

**Fix:**
```bash
# Check if Ollama is running
ps aux | grep ollama  # Mac/Linux
tasklist | findstr ollama  # Windows

# Start if not running
ollama serve
```

### Model not found

**Symptoms:** Error: `model 'llama3' not found`

**Fix:**
```bash
# Pull the model
ollama pull llama3

# Or use a different model you have
# Edit backend/.env: OLLAMA_LLM_MODEL=phi
```

### Backend initialization takes too long

**First startup is slow (30-60s) because:**
- Database tables created
- Models loaded into memory
- ChromaDB initialized

**This is normal!** Subsequent startups are faster (5-10s).

### Port already in use

**Symptoms:** `Address already in use: 127.0.0.1:8000`

**Fix:**
```bash
# Kill existing backend process
# Mac/Linux
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Can't install Python packages

**Symptoms:** pip install fails with permission errors

**Fix:**
```bash
# Use virtual environment (recommended)
cd backend
python -m venv venv

# Activate
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate  # Windows

# Install
pip install -r requirements.txt
```

## Next Steps

- **Upload documents:** Try uploading a PDF with the upload button
- **Enable memory:** Toggle "Use Memory" to enable long-term context
- **Change models:** Edit `backend/.env` to try different Ollama models
- **Read full docs:** See [OLLAMA_SETUP.md](OLLAMA_SETUP.md) for advanced configuration

## Need Help?

- **Ollama issues:** https://github.com/ollama/ollama/issues
- **App issues:** Open an issue in this repository
- **Check logs:** `backend/logs/app.log` for detailed errors

## Performance Tips

### First message is slow?
- First request loads model into memory (20-60s)
- Keep Ollama running to avoid reloading
- Use smaller models like `phi` for faster responses

### Running out of memory?
- Close other applications
- Use smaller models: `phi` (1.6GB) vs `llama3` (4.7GB)
- Reduce `max_tokens` in settings

### Want faster responses?
- Use GPU acceleration (NVIDIA/AMD/Apple Silicon)
- Ollama automatically detects and uses GPU
- Check with `nvidia-smi` (NVIDIA) or Activity Monitor (Mac)

## System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 10GB (for models)

**Recommended:**
- CPU: 8+ cores
- RAM: 16GB
- GPU: NVIDIA with 6GB+ VRAM
- Storage: SSD with 20GB+

**Models require:**
- `phi`: 1.6GB RAM
- `llama2`: 3.8GB RAM
- `llama3`: 4.7GB RAM
- `mistral`: 4.1GB RAM
