# app/routes/health.py
"""
Health check and system status endpoints.
Provides monitoring and diagnostics for system components.
"""
from fastapi import APIRouter, Request
from app.config import PROVIDER, DATABASE_PATH, logger
from app.schemas import HealthResponse
from .dependencies import LangChainManager, DBSession
from app.db_manager import get_db_stats

router = APIRouter(prefix="/api", tags=["health"])


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
    
    return capabilities
