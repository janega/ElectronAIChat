# app/routes/models.py
"""
Model management endpoints.

Handles listing available models and switching the active provider/model at
runtime without requiring a backend restart.
"""
import re
import asyncio
import logging
import subprocess
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlmodel import select
from datetime import datetime, timezone

from app.config import (
    PROVIDER,
    OLLAMA_HOST,
    LLAMACPP_MODELS_DIR,
    LLAMACPP_EMBED_MODEL,
    LLAMACPP_ENABLE_PARALLEL,
    LLAMACPP_N_CTX,
    LLAMACPP_VERBOSE,
    LLAMACPP_N_GPU_LAYERS,
    DEFAULT_OLLAMA_LLM_MODEL,
    DEFAULT_OPENAI_LLM_MODEL,
    runtime_config,
    logger,
)
from .dependencies import DBSession

router = APIRouter(prefix="/api/models", tags=["models"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _estimate_params_billions(model_name: str) -> float:
    """
    Estimate parameter count in billions from a model filename or tag name.
    Returns 0.0 if unknown (treated as 'large enough' by callers).
    """
    name = model_name.lower()
    match = re.search(r'[-_](\d+\.?\d*)b(?:[qiQ_\-.]|$)', name)
    if match:
        return float(match.group(1))
    match = re.search(r'(\d+\.?\d*)b(?:[^a-z]|$)', name)
    if match:
        return float(match.group(1))
    match = re.search(r'(\d+)m(?:[^a-z]|$)', name)
    if match:
        return float(match.group(1)) / 1000.0
    return 0.0


def _pick_best_model(available: List[str], preferred: Optional[str]) -> Optional[str]:
    """
    Return the best model to activate from `available`.

    Priority:
    1. `preferred` if it exists in `available` (user's last-used or explicit choice)
    2. Smallest model by estimated parameter count
    3. First model in the list (alphabetical, since the callers sort it)
    """
    if not available:
        return None

    if preferred and preferred in available:
        return preferred

    # Sort by estimated params (ascending), fall back to name
    def sort_key(name):
        p = _estimate_params_billions(name)
        return (p if p > 0 else float('inf'), name)

    return sorted(available, key=sort_key)[0]


async def _is_ollama_reachable() -> bool:
    """Return True if Ollama is currently reachable."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def _ensure_ollama_running() -> bool:
    """
    Check if Ollama is reachable; if not, attempt to start it via `ollama serve`.
    Returns True if Ollama is reachable after attempts, False otherwise.
    """
    if await _is_ollama_reachable():
        return True

    logger.info("Ollama not reachable — attempting to start 'ollama serve'...")
    try:
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),  # Windows: no console
        )
    except FileNotFoundError:
        logger.warning("'ollama' executable not found in PATH — is Ollama installed?")
        return False
    except Exception as exc:
        logger.warning(f"Failed to spawn 'ollama serve': {exc}")
        return False

    # Poll up to 10 s for Ollama to become ready
    for _ in range(10):
        await asyncio.sleep(1)
        if await _is_ollama_reachable():
            logger.info("Ollama started successfully")
            return True

    logger.warning("Ollama did not become reachable within 10 s")
    return False


async def _fetch_ollama_models() -> List[str]:
    """Query Ollama for available model tags. Returns empty list on failure."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception as exc:
        logger.warning(f"Could not reach Ollama to list models: {exc}")
        return []


# ---------------------------------------------------------------------------
# Request / response schema
# ---------------------------------------------------------------------------

class ModelSwitchRequest(BaseModel):
    provider: str
    model: Optional[str] = None   # None → backend picks best model automatically
    user_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/switch")
async def switch_model(
    body: ModelSwitchRequest,
    session: DBSession,
):
    """
    Hot-swap the active LLM provider and/or model.

    Phase 2 supports LlamaCpp and Ollama.

    **Model selection when `model` is omitted or not in the available list:**
    1. The model saved in UserSettings.default_model for this provider (last used)
    2. The smallest model by estimated parameter count
    3. First alphabetical model

    **Returns** `{ success, provider, model, models, changed, warning }`.
    `warning` is non-null when no models were found for the requested provider.

    Changes take effect for all chat requests that START after this call
    returns.  Any stream already in progress continues with the old model.
    """
    import app.config as config_module
    from app.routes.dependencies import (
        get_llamacpp_client,
        set_llamacpp_client,
        set_openai_client,
    )

    new_provider = body.provider.strip().lower()
    current_provider = runtime_config.provider

    if new_provider not in ("llamacpp", "ollama", "openai"):
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{new_provider}'. Supported: llamacpp, ollama, openai.",
        )

    # -----------------------------------------------------------------------
    # 1. Gather available models for the target provider
    # -----------------------------------------------------------------------
    warning = None

    if new_provider == "llamacpp":
        try:
            available = sorted([f.name for f in LLAMACPP_MODELS_DIR.glob("*.gguf")])
        except Exception:
            available = []
    elif new_provider == "ollama":
        # Attempt to start Ollama if it isn't running
        ollama_running = await _ensure_ollama_running()
        if not ollama_running:
            return {
                "success": False,
                "provider": new_provider,
                "model": None,
                "models": [],
                "changed": False,
                "warning": (
                    "Ollama is not running and could not be started automatically. "
                    "Install Ollama from https://ollama.com and run 'ollama serve'."
                ),
            }
        available = await _fetch_ollama_models()
    else:  # openai
        available = ["gpt-4o", "gpt-4o-mini"]

    if not available and new_provider in ("llamacpp", "ollama"):
        warning = (
            f"No models found for provider '{new_provider}'. "
            + ("Download a .gguf file into the models directory."
               if new_provider == "llamacpp"
               else "Pull a model with: ollama pull <model-name>")
        )
        logger.warning(warning)
        return {
            "success": False,
            "provider": new_provider,
            "model": None,
            "models": [],
            "changed": False,
            "warning": warning,
        }

    # -----------------------------------------------------------------------
    # 2. Determine which model to activate
    # -----------------------------------------------------------------------

    # Load UserSettings to check last-used model (used as preference hint)
    saved_model: Optional[str] = None
    user_settings = None
    if body.user_id:
        from app.database import UserSettings
        user_settings = session.exec(
            select(UserSettings).where(UserSettings.user_id == body.user_id)
        ).first()
        if user_settings:
            saved_model = user_settings.default_model

    # Preference order: explicit request > last-used in settings > smallest/first
    preferred = body.model or saved_model
    selected_model = _pick_best_model(available, preferred)

    # -----------------------------------------------------------------------
    # 3. Determine if anything actually changes
    # -----------------------------------------------------------------------
    provider_changed = new_provider != current_provider
    model_changed = (
        (new_provider == "llamacpp" and selected_model != runtime_config.llamacpp_chat_model)
        or (new_provider == "ollama" and selected_model != runtime_config.ollama_model)
        or (new_provider == "openai" and selected_model != DEFAULT_OPENAI_LLM_MODEL)
    )

    if not provider_changed and not model_changed:
        logger.info(f"Switch requested but already on {current_provider}/{selected_model} — skipping")
        return {
            "success": True,
            "provider": new_provider,
            "model": selected_model,
            "models": available,
            "changed": False,
            "warning": None,
        }

    # -----------------------------------------------------------------------
    # 4. Perform the switch
    # -----------------------------------------------------------------------

    try:
        if new_provider == "llamacpp":
            # Validate model file exists
            model_path = LLAMACPP_MODELS_DIR / selected_model
            if not model_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"LlamaCpp model file not found: '{selected_model}'",
                )

            # Preserve GPU layer count from existing client to avoid re-detection
            existing_gpu_layers = LLAMACPP_N_GPU_LAYERS
            try:
                current_client = get_llamacpp_client()
                existing_gpu_layers = current_client.n_gpu_layers
                if model_changed:
                    current_client.unload()
            except Exception as e:
                logger.warning(f"Could not unload existing LlamaCpp model: {e}")

            from app.llamacpp_client import LlamaCppClient
            new_client = LlamaCppClient(
                chat_model_path=selected_model,
                embedding_model_path=LLAMACPP_EMBED_MODEL,
                models_dir=str(LLAMACPP_MODELS_DIR),
                enable_parallel=LLAMACPP_ENABLE_PARALLEL,
                n_ctx=LLAMACPP_N_CTX,
                verbose=LLAMACPP_VERBOSE,
                n_gpu_layers=existing_gpu_layers,
            )
            set_llamacpp_client(new_client)
            runtime_config.llamacpp_chat_model = selected_model

        elif new_provider == "ollama":
            if provider_changed:
                # Unload LlamaCpp chat model if switching away from it to free memory
                if current_provider == "llamacpp":
                    try:
                        current_client = get_llamacpp_client()
                        current_client.unload()
                        logger.info("Unloaded LlamaCpp chat model (switching to Ollama)")
                    except Exception as e:
                        logger.warning(f"Could not unload LlamaCpp model: {e}")
                # Build a fresh Ollama client
                from app.openai_client import EnhancedOpenAIClient
                new_client = EnhancedOpenAIClient(
                    base_url=OLLAMA_HOST,
                    api_key="ollama",
                    provider="ollama",
                )
                set_openai_client(new_client)
            runtime_config.ollama_model = selected_model

        elif new_provider == "openai":
            if provider_changed:
                # Unload LlamaCpp chat model if switching away from it to free memory
                if current_provider == "llamacpp":
                    try:
                        current_client = get_llamacpp_client()
                        current_client.unload()
                        logger.info("Unloaded LlamaCpp chat model (switching to OpenAI)")
                    except Exception as e:
                        logger.warning(f"Could not unload LlamaCpp model: {e}")
                from app.config import OPENAI_API_KEY
                from app.openai_client import EnhancedOpenAIClient
                new_client = EnhancedOpenAIClient(
                    base_url="https://api.openai.com/v1",
                    api_key=OPENAI_API_KEY,
                    provider="openai",
                )
                set_openai_client(new_client)

        # Update the module-level PROVIDER and runtime_config so all subsequent
        # requests (including health.py / capabilities) see the new provider
        if provider_changed:
            config_module.PROVIDER = new_provider
            runtime_config.provider = new_provider

        # -----------------------------------------------------------------------
        # 5. Persist to UserSettings
        # -----------------------------------------------------------------------
        if user_settings:
            user_settings.default_model = selected_model
            user_settings.provider = new_provider
            user_settings.updated_at = datetime.now(timezone.utc)
            session.add(user_settings)
            session.commit()
            logger.info(
                f"Persisted provider='{new_provider}' model='{selected_model}' "
                f"to UserSettings for user {body.user_id}"
            )

        logger.info(f"✅ Switched to provider='{new_provider}' model='{selected_model}'")
        return {
            "success": True,
            "provider": new_provider,
            "model": selected_model,
            "models": available,
            "changed": True,
            "warning": None,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to switch to provider='{new_provider}' model='{selected_model}'")
        raise HTTPException(status_code=500, detail=f"Model switch failed: {str(exc)}")

