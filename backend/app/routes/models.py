# app/routes/models.py
"""
Model management endpoints.

Handles listing available models and switching the active model at runtime
without requiring a backend restart.
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlmodel import select

from app.config import (
    PROVIDER,
    LLAMACPP_MODELS_DIR,
    LLAMACPP_EMBED_MODEL,
    LLAMACPP_ENABLE_PARALLEL,
    LLAMACPP_N_CTX,
    LLAMACPP_VERBOSE,
    LLAMACPP_N_GPU_LAYERS,
    runtime_config,
    logger,
)
from .dependencies import DBSession

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelSwitchRequest(BaseModel):
    provider: str
    model: str
    user_id: Optional[str] = None


@router.post("/switch")
async def switch_model(
    body: ModelSwitchRequest,
    session: DBSession,
):
    """
    Hot-swap the active LLM model.

    Phase 1 supports LlamaCpp only.  The current chat model is unloaded from
    memory, the new GGUF file is validated, and a fresh LlamaCppClient is
    created.  The embedding model is **not** changed so existing ChromaDB
    vector collections remain valid.

    Changes take effect for all chat requests that start *after* this call
    returns.  Any stream that is already in progress continues with the old
    model until it finishes.

    If `user_id` is supplied the selection is persisted to UserSettings so
    that it is restored when the frontend reloads settings on the next login.
    """
    from app.routes.dependencies import get_llamacpp_client, set_llamacpp_client

    # Phase 1: LlamaCpp only
    if PROVIDER != "llamacpp":
        raise HTTPException(
            status_code=400,
            detail=f"Model switching not yet supported for provider '{PROVIDER}'. Only 'llamacpp' is supported in Phase 1.",
        )

    if body.provider != "llamacpp":
        raise HTTPException(
            status_code=400,
            detail=f"Provider switching not supported in Phase 1. Requested provider: '{body.provider}'.",
        )

    model_name = body.model.strip()
    model_path = LLAMACPP_MODELS_DIR / model_name

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model file not found in models directory: '{model_name}'",
        )

    # No-op if already active
    if runtime_config.llamacpp_chat_model == model_name:
        logger.info(f"Model switch requested but '{model_name}' is already active — skipping reload")
        return {"success": True, "provider": "llamacpp", "model": model_name, "changed": False}

    try:
        # Preserve n_gpu_layers from the existing client so we don't re-detect GPU
        existing_gpu_layers = LLAMACPP_N_GPU_LAYERS
        try:
            current_client = get_llamacpp_client()
            existing_gpu_layers = current_client.n_gpu_layers
            current_client.unload()
        except Exception as unload_err:
            logger.warning(f"Could not unload existing model (may not have been loaded yet): {unload_err}")

        # Build new client — chat model changes, everything else stays the same
        from app.llamacpp_client import LlamaCppClient
        new_client = LlamaCppClient(
            chat_model_path=model_name,
            embedding_model_path=LLAMACPP_EMBED_MODEL,
            models_dir=str(LLAMACPP_MODELS_DIR),
            enable_parallel=LLAMACPP_ENABLE_PARALLEL,
            n_ctx=LLAMACPP_N_CTX,
            verbose=LLAMACPP_VERBOSE,
            n_gpu_layers=existing_gpu_layers,
        )

        # Atomically swap the singleton
        set_llamacpp_client(new_client)

        # Update mutable runtime config
        runtime_config.llamacpp_chat_model = model_name

        # Persist to UserSettings so the selection survives backend restarts
        if body.user_id:
            from app.database import UserSettings
            from datetime import datetime, timezone
            user_settings = session.exec(
                select(UserSettings).where(UserSettings.user_id == body.user_id)
            ).first()
            if user_settings:
                user_settings.default_model = model_name
                user_settings.updated_at = datetime.now(timezone.utc)
                session.add(user_settings)
                session.commit()
                logger.info(f"Persisted model '{model_name}' to UserSettings for user {body.user_id}")
            else:
                logger.warning(f"user_id '{body.user_id}' provided but UserSettings row not found — skipping persistence")

        logger.info(f"✅ Active LlamaCpp chat model switched to: {model_name}")
        return {"success": True, "provider": "llamacpp", "model": model_name, "changed": True}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to switch model to '{model_name}'")
        raise HTTPException(status_code=500, detail=f"Model switch failed: {str(exc)}")
