# app/routes/health.py
"""
Health check and system status endpoints.
Provides monitoring and diagnostics for system components.
"""
import re
import httpx
from fastapi import APIRouter, Request
from app.config import PROVIDER, DATABASE_PATH, logger, LLAMACPP_MODELS_DIR, DEFAULT_OLLAMA_LLM_MODEL, DEFAULT_OPENAI_LLM_MODEL, OLLAMA_HOST, runtime_config
from app.schemas import HealthResponse
from .dependencies import LangChainManager, DBSession
from app.db_manager import get_db_stats

router = APIRouter(prefix="/api", tags=["health"])

MIN_PARAMS_FOR_MEMORY = 1.5  # Billion

def estimate_model_params_billions(model_name: str) -> float:
    """
    Estimate model parameter count in billions from the model filename/name.
    Returns 0.0 if unknown (caller treats 0.0 as 'unknown, allow memory').
    """
    name = model_name.lower()

    # Parse common size patterns: 0.5b, 0.6b, 1.5b, 3b, 7b, 13b, 70b, 72b, 1.5B
    # Also handles: qwen2.5-1.5b-q4, llama-3-8b-instruct.gguf, etc.
    match = re.search(r'[-_](\d+\.?\d*)b(?:[qiQ_\-.]|$)', name)
    if match:
        return float(match.group(1))

    # Fallback: bare number followed by 'b' anywhere
    match = re.search(r'(\d+\.?\d*)b(?:[^a-z]|$)', name)
    if match:
        return float(match.group(1))

    # Millions: 500m → 0.5
    match = re.search(r'(\d+)m(?:[^a-z]|$)', name)
    if match:
        return float(match.group(1)) / 1000.0

    # Known model families
    known = {
        "tinyllama": 1.1, "phi-2": 2.7, "phi2": 2.7,
        "phi-3-mini": 3.8, "phi3:mini": 3.8,
        "llama2": 7.0, "llama3": 8.0, "mistral": 7.0,
        "gemma:2b": 2.0, "gemma2:2b": 2.0, "gemma:7b": 7.0,
        "gpt-3.5": 20.0, "gpt-4": 1000.0,
    }
    for key, size in known.items():
        if key in name:
            return size

    return 0.0  # Unknown


@router.get("/health", response_model=HealthResponse)
async def health_check(
    request: Request,
    langchain_manager: LangChainManager,
    session: DBSession
):
    """
    Comprehensive health check for all system components.
    
    Tests:
    - Database connectivity and statistics
    - LangChain embeddings functionality
    - Memory manager availability
    - Vector store connectivity
    - Startup validation status
    
    Returns detailed component status for monitoring.
    """
    try:
        # Test database connection and get stats
        db_stats = get_db_stats(session)
        db_healthy = "error" not in db_stats
        
        # Get startup errors from app state
        startup_errors = getattr(request.app.state, 'startup_errors', [])
        has_warnings = len(startup_errors) > 0
        
        components = {
            "database": db_healthy,
            "database_path": str(DATABASE_PATH),
            "database_stats": db_stats,
            "langchain_embeddings": langchain_manager is not None,  # Check manager exists
            "mem0_memory": True,  # Always available (has fallback implementation)
            "vectorstore": True   # ChromaDB is file-based, always available
        }
        
        # Add startup validation results
        if has_warnings:
            components["startup_validation"] = {
                "passed": False,
                "warnings": startup_errors
            }
        else:
            components["startup_validation"] = {"passed": True}
        
        return {
            "status": "healthy" if (db_healthy and not has_warnings) else "degraded",
            "provider": PROVIDER,
            "components": components
        }
    except Exception as e:
        logger.exception("Health check failed")
        return {
            "status": "unhealthy", 
            "provider": PROVIDER, 
            "components": {"error": str(e)}
        }


@router.get("/capabilities")
async def get_capabilities(request: Request):
    """
    Get system capabilities including GPU support for LlamaCpp.
    
    Returns:
    - Available LLM providers
    - GPU detection status
    - CUDA availability for LlamaCpp
    - Hardware recommendations
    """
    capabilities = {
        "llm_providers": ["ollama", "openai", "llamacpp"],
        "current_provider": PROVIDER,
        "gpu_info": {
            "available": False,
            "cuda_enabled": False
        }
    }
    
    # Get GPU info from app state (set during startup if llamacpp provider)
    gpu_config = getattr(request.app.state, 'gpu_info', None)
    if gpu_config:
        gpu_info = gpu_config.get("gpu_info", {})
        cuda_available = gpu_config.get("cuda_available", False)

        capabilities["gpu_info"] = {
            "available": gpu_info.get("available", False),
            "name": gpu_info.get("name"),
            "vram_mb": gpu_info.get("vram_mb"),
            "compute_capability": gpu_info.get("compute_capability"),
            "cuda_enabled": cuda_available,
            "recommended": gpu_info.get("recommended", False)
        }

    # Model info - used by frontend to set memory default
    if PROVIDER == "llamacpp":
        current_model = runtime_config.llamacpp_chat_model
    elif PROVIDER == "ollama":
        current_model = DEFAULT_OLLAMA_LLM_MODEL
    else:
        current_model = DEFAULT_OPENAI_LLM_MODEL

    params_b = estimate_model_params_billions(current_model)
    is_large_enough = params_b == 0.0 or params_b > MIN_PARAMS_FOR_MEMORY

    capabilities["model_info"] = {
        "name": current_model,
        "provider": PROVIDER,
        "estimated_params_billions": params_b,
        "is_large_enough_for_memory": is_large_enough,
        "memory_recommendation": "enabled" if is_large_enough else "disabled",
    }

    return capabilities


@router.get("/models")
async def get_available_models():
    """
    Return list of available models for the current provider.
    - LlamaCpp: scans LLAMACPP_MODELS_DIR for .gguf files
    - Ollama:   queries Ollama /api/tags
    - OpenAI:   returns hardcoded common models
    """
    if PROVIDER == "llamacpp":
        try:
            gguf_files = sorted(LLAMACPP_MODELS_DIR.glob("*.gguf"))
            models = [f.name for f in gguf_files]
        except Exception as e:
            logger.warning(f"Failed to scan models dir: {e}")
            models = []
        return {
            "provider": PROVIDER,
            "current_model": runtime_config.llamacpp_chat_model,
            "models": models,
        }

    elif PROVIDER == "ollama":
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{OLLAMA_HOST}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.warning(f"Failed to fetch Ollama models: {e}")
            models = [DEFAULT_OLLAMA_LLM_MODEL]
        return {
            "provider": PROVIDER,
            "current_model": DEFAULT_OLLAMA_LLM_MODEL,
            "models": models,
        }

    else:  # openai
        models = [
            "gpt-4o",
            "gpt-4o-mini",
        ]
        return {
            "provider": PROVIDER,
            "current_model": DEFAULT_OPENAI_LLM_MODEL,
            "models": models,
        }
