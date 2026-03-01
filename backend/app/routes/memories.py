# app/routes/memories.py
"""
Memory management endpoints.
Provides CRUD operations for user long-term memories via Mem0.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routes.dependencies import Mem0Manager
from app.config import logger

router = APIRouter(prefix="/api/memories", tags=["memories"])


class MemoryUpdate(BaseModel):
    memory: str  # New text for the memory


def _normalize_memories(raw) -> list:
    """Normalize Mem0 get_all result to a plain list with consistent item shape."""
    if isinstance(raw, dict) and "results" in raw:
        return raw["results"]
    if isinstance(raw, list):
        return raw
    return []


@router.get("/{user_id}")
async def get_memories(user_id: str, mem0_manager: Mem0Manager):
    """Return all stored memories for a user."""
    try:
        raw = await mem0_manager.get_all(user_id=user_id)
        memories = _normalize_memories(raw)
        return {"memories": memories}
    except Exception as e:
        logger.exception("Failed to get memories for user %s", user_id)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve memories: {str(e)}")


@router.put("/{memory_id}")
async def update_memory(memory_id: str, update: MemoryUpdate, mem0_manager: Mem0Manager):
    """Update the text of a specific memory."""
    try:
        success = await mem0_manager.update_memory(
            memory_id=memory_id,
            data={"memory": update.memory}
        )
        if not success:
            raise HTTPException(status_code=404, detail=f"Memory '{memory_id}' not found")
        return {"success": True, "memory_id": memory_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update memory %s", memory_id)
        raise HTTPException(status_code=500, detail=f"Failed to update memory: {str(e)}")


@router.delete("/{user_id}/all")
async def clear_all_memories(user_id: str, mem0_manager: Mem0Manager):
    """Delete all memories for a user.

    Note: this route matches two path segments (/{user_id}/all) so it does not
    conflict with the single-memory DELETE route below (/{memory_id}).
    """
    try:
        deleted = await mem0_manager.delete_all(user_id=user_id)
        return {"success": True, "deleted": deleted}
    except Exception as e:
        logger.exception("Failed to clear all memories for user %s", user_id)
        raise HTTPException(status_code=500, detail=f"Failed to clear memories: {str(e)}")


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, mem0_manager: Mem0Manager):
    """Delete a specific memory by ID."""
    try:
        success = await mem0_manager.delete_memory(memory_id=memory_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Memory '{memory_id}' not found")
        return {"success": True, "memory_id": memory_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete memory %s", memory_id)
        raise HTTPException(status_code=500, detail=f"Failed to delete memory: {str(e)}")
