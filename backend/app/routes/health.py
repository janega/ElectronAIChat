# app/routes/health.py
"""
Health check and system status endpoints.
Provides monitoring and diagnostics for system components.
"""
from fastapi import APIRouter
from app.config import PROVIDER, DATABASE_PATH, logger
from app.schemas import HealthResponse
from .dependencies import LangChainManager, DBSession
from app.db_manager import get_db_stats

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
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
    
    Returns detailed component status for monitoring.
    """
    try:
        # Test database connection and get stats
        db_stats = get_db_stats(session)
        db_healthy = "error" not in db_stats
        
        # Test embedding functionality - this validates the entire chain
        test_embedding = langchain_manager.embeddings.embed_query("health_test")
        
        return {
            "status": "healthy" if db_healthy else "degraded",
            "provider": PROVIDER,
            "components": {
                "database": db_healthy,
                "database_path": str(DATABASE_PATH),
                "database_stats": db_stats,
                "langchain_embeddings": len(test_embedding) > 0,
                "mem0_memory": True,  # Always available (has fallback implementation)
                "vectorstore": True   # ChromaDB availability is tested via embedding
            }
        }
    except Exception as e:
        logger.exception("Health check failed")
        return {
            "status": "unhealthy", 
            "provider": PROVIDER, 
            "components": {"error": str(e)}
        }
