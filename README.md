# ElectronAIChat

A desktop RAG (Retrieval-Augmented Generation) application with **Electron** frontend and **Python (FastAPI)** backend, featuring **Ollama integration** for local LLM hosting.

## ✨ Features

- 🤖 **Local LLM Support** - Run AI models locally with Ollama (privacy-focused, no cloud required)
- 📚 **Document RAG** - Upload PDFs, text files, and JSON for context-aware chat
- 🧠 **Long-term Memory** - Mem0 integration for persistent conversation context
- 💬 **Streaming Chat** - Real-time token streaming for responsive UI
- 🔍 **Vector Search** - ChromaDB-powered semantic document retrieval
- 🎨 **Modern UI** - React 19 + TailwindCSS 4 with dark mode
- 🔧 **Flexible Provider** - Switch between Ollama (local) and OpenAI (cloud)

## 🚀 Quick Start

### Prerequisites

1. **Install Ollama** (for local LLM):
   ```bash
   # Visit https://ollama.ai or:
   curl -fsSL https://ollama.com/install.sh | sh  # macOS/Linux
   ```

2. **Pull Required Models**:
   ```bash
   ollama pull nomic-embed-text  # Embeddings (required)
   ollama pull llama3            # Chat model (recommended)
   ```

3. **Install Python Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Install Node Dependencies**:
   ```bash
   cd electron
   npm install
   ```

### Configuration

Create `backend/.env` (or copy from `.env.example`):

```bash
# LLM Provider
LLM_PROVIDER=ollama

# Ollama Settings
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3

# App Settings
APP_NAME=ElectronAIChat
USE_APP_DATA_DIR=false
LOG_LEVEL=INFO
```

**📖 Full Ollama setup guide:** [docs/OLLAMA_SETUP.md](docs/OLLAMA_SETUP.md)

### Development Mode

**Terminal 1 - Start Ollama:**
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

App will open at `http://localhost:5173` with Electron.

## 📦 Production Build

### 1. Build Backend Executable

```bash
cd backend
pip install pyinstaller
pyinstaller backend.spec
```

This creates `backend/dist/backend.exe`.

### 2. Package Electron App

```bash
cd electron
npm run prepackage  # Copies backend.exe to electron/dist/
npm run package     # Creates installer
```

Output: `electron/dist/ElectronAIChat-Setup.exe` (Windows)

## 🏗️ Architecture

```
┌─────────────────┐
│  Electron Main  │ ─┐
│  Process        │  │ Spawns subprocess
└─────────────────┘  │
         │           │
         │ Loads     ▼
         │      ┌──────────────┐
         ▼      │  backend.exe │
┌─────────────┐ │  (FastAPI)   │
│  React UI   │ └──────────────┘
│  (Vite)     │        │
└─────────────┘        │ HTTP/SSE
         │             │
         └─────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
  ┌─────────┐      ┌──────────┐
  │ Ollama  │      │ ChromaDB │
  │ (LLM)   │      │ (Vectors)│
  └─────────┘      └──────────┘
```

**Tech Stack:**
- **Frontend:** Electron 26, React 19, TypeScript, Vite, TailwindCSS 4
- **Backend:** FastAPI, SQLModel, LangChain, ChromaDB, Mem0
- **LLM:** Ollama (local) or OpenAI (cloud)
- **Persistence:** SQLite, ChromaDB

## 📚 Documentation

- **[Ollama Setup Guide](docs/OLLAMA_SETUP.md)** - Complete Ollama integration documentation
- **[Architecture Overview](.github/copilot-instructions.md)** - Detailed system architecture

## 🔧 Key Npm Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Run Vite dev server + Electron |
| `npm run build` | Build React app for production |
| `npm run package` | Create production installer |
| `npm run prepackage` | Copy backend.exe to electron dist |

## 🛠️ Configuration Options

### Switching to OpenAI

Edit `backend/.env`:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_LLM_MODEL=gpt-3.5-turbo
OPENAI_EMBED_MODEL=text-embedding-3-small
```

Restart backend - no code changes needed!

### Storage Locations

**Development:**
- SQLite: `backend/chat_history.db`
- ChromaDB: `backend/chroma_db/`
- Uploads: `backend/uploads/`

**Production (Packaged):**
- Windows: `%APPDATA%/ElectronAIChat/`
- macOS: `~/Library/Application Support/ElectronAIChat/`
- Linux: `~/.config/ElectronAIChat/`

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check Ollama is running
ollama list

# Check logs
tail -f backend/logs/app.log
```

### Models not found

```bash
# Pull required models
ollama pull nomic-embed-text
ollama pull llama3
```

### Slow responses

- First request loads model into memory (30-60s)
- Use smaller model: `OLLAMA_LLM_MODEL=phi`
- Consider GPU acceleration (NVIDIA CUDA, AMD ROCm, Apple Metal)

**See full troubleshooting guide:** [docs/OLLAMA_SETUP.md#troubleshooting](docs/OLLAMA_SETUP.md#troubleshooting)

## 📄 License

See [LICENSE](LICENSE) file.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🌟 Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM runtime
- [LangChain](https://python.langchain.com/) - LLM framework
- [ChromaDB](https://www.trychroma.com/) - Vector database
- [Mem0](https://mem0.ai/) - Memory layer for LLMs
- [Electron](https://www.electronjs.org/) - Desktop framework
