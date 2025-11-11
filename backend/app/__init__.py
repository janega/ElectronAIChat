# app/__init__.py
"""
ElectronAIChat Backend Application Package

Provides:
- SQLModel database models (User, Chat, Message, Document, UserSettings)
- LangChain embeddings with ChromaDB vector storage
- Mem0 memory management system
- Enhanced OpenAI client for Ollama/OpenAI
- Document processing with OCR and JSON support
- FastAPI routes for chat, documents, health, and chat management
"""
__version__ = "2.0.0"
