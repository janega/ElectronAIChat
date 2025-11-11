from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from app.routes import document_routes

# Load environment variables
load_dotenv()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama2")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

app = FastAPI(title="Document Processing API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic status endpoint
@app.get("/api/status")
def status():
    return JSONResponse({"status": "Backend is running"})

# Include document routes
app.include_router(
    document_routes.init_router(REDIS_URL, EMBED_MODEL, CHAT_MODEL, OLLAMA_HOST),
    prefix="/api/documents",
    tags=["documents"]
)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
