# Model Switching Plan

## Current State

The `ModelBar` component (below the message input) displays:
- Provider badge (`LlamaCpp` / `Ollama` / `OpenAI`) sourced from `GET /api/models`
- Model dropdown (read-only/disabled) populated from provider-specific source
- Model list is fetched once on backend connect via `apiClient.getModels()`

Model list sources per provider (already implemented in `backend/app/routes/health.py`):
- **LlamaCpp** → scans `LLAMACPP_MODELS_DIR` (`./models/*.gguf`)
- **Ollama** → calls `{OLLAMA_HOST}/api/tags`
- **OpenAI** → hardcoded `["gpt-4o", "gpt-4o-mini"]`

Current model and provider are read from `backend/app/config.py` env vars:
- `LLAMACPP_CHAT_MODEL` (default: `qwen3-0.6b-q4.gguf`)
- `DEFAULT_OLLAMA_LLM_MODEL` (default: `llama2:latest`)
- `DEFAULT_OPENAI_LLM_MODEL` (default: `gpt-3.5-turbo`)
- `PROVIDER` (default: `llamacpp`)

---

## Goal

Allow the user to:
1. Switch LLM provider (LlamaCpp / Ollama / OpenAI) via a dropdown in `ModelBar`
2. Switch model within the selected provider
3. Changes take effect immediately for new chat messages
4. Selection persists across sessions (saved to `UserSettings` in SQLite)

---

## Backend Changes

### 1. `POST /api/models/switch` (new endpoint in `health.py`)

**Request:**
```json
{ "provider": "llamacpp", "model": "qwen2.5-1.5b-q4.gguf" }
```

**Response:**
```json
{ "success": true, "provider": "llamacpp", "model": "qwen2.5-1.5b-q4.gguf" }
```

**Per-provider behaviour:**

| Provider | What happens on switch |
|----------|------------------------|
| **LlamaCpp** | Unload current `Llama()` instance from `LlamaCppClient`, load new `.gguf` file. Takes 5–30s depending on model size. |
| **Ollama** | Update active model name in memory. No load time — Ollama handles model management itself. |
| **OpenAI** | Update model string in memory. Instant — no loading. |

### 2. `app/config.py` — Runtime-mutable provider/model

Currently `PROVIDER`, `LLAMACPP_CHAT_MODEL`, etc. are module-level constants read once at startup. These need to become **mutable runtime state** so a switch endpoint can update them without restart.

**Approach:** Store active provider + model in a `RuntimeConfig` object (module-level singleton) instead of bare constants. All routes that use `PROVIDER` / model names import from this object.

```python
# app/config.py
class RuntimeConfig:
    provider: str = os.getenv("PROVIDER", "llamacpp")
    llamacpp_model: str = os.getenv("LLAMACPP_CHAT_MODEL", "qwen3-0.6b-q4.gguf")
    ollama_model: str = os.getenv("DEFAULT_OLLAMA_LLM_MODEL", "llama2:latest")
    openai_model: str = os.getenv("DEFAULT_OPENAI_LLM_MODEL", "gpt-3.5-turbo")

runtime_config = RuntimeConfig()
```

### 3. `app/routes/dependencies.py` — Hot-swap LlamaCpp client

The `get_llamacpp_client()` singleton needs to support being replaced. When `/api/models/switch` is called with a new LlamaCpp model:
1. Call `get_llamacpp_client().unload()` (new method on `LlamaCppClient`)
2. Re-initialize `LlamaCppClient` with new model path
3. Update the singleton via `set_llamacpp_client(new_client)`

### 4. `app/llamacpp_client.py` — `unload()` method

```python
def unload(self):
    """Release model from memory before loading a new one."""
    if self._chat_llm:
        del self._chat_llm
        self._chat_llm = None
    if self._embed_llm:
        del self._embed_llm
        self._embed_llm = None
```

### 5. `app/database.py` / `UserSettings` — Persist selection

Add two columns to `UserSettings`:
- `active_provider: str` (default: value of `PROVIDER` env var)
- `active_model: str` (default: current model for that provider)

On user login, load these and apply to `RuntimeConfig`. On switch, save new values.

---

## Frontend Changes

### 1. `ModelBar.tsx` — Make interactive

**Provider dropdown:**
- Remove `disabled`
- `onChange` → call `apiClient.switchProvider(provider)` → repopulate model list via `apiClient.getModels()`

**Model dropdown:**
- Remove `disabled`  
- `onChange` → call `apiClient.switchModel(provider, model)`
- Show loading spinner (LlamaCpp only) while switch is in progress

**Loading state:**
```tsx
const [isSwitching, setIsSwitching] = useState(false);

// During LlamaCpp model switch show spinner + disable inputs
```

### 2. `api.ts` — New methods

```typescript
// Switch active model (within current provider)
async switchModel(provider: string, model: string): Promise<{ success: boolean }>

// Switch provider (also updates model list)
async switchProvider(provider: string, model: string): Promise<{ success: boolean }>
```

Both call `POST /api/models/switch`.

### 3. `App.tsx` — Refresh model data after switch

After a successful switch:
- Call `apiClient.getModels()` to refresh `modelsData` state
- Call `apiClient.getCapabilities()` to refresh `modelInfo` (param count → memory default may change)
- Re-evaluate memory default for new model

---

## Cross-Compatibility Note: Ollama vs LlamaCpp

Both providers use GGUF models but manage them differently:

| | LlamaCpp | Ollama |
|---|---|---|
| Model storage | `./models/*.gguf` (local files) | Ollama's internal registry (`~/.ollama/models`) |
| Load mechanism | `Llama(model_path=...)` in Python | `ollama pull <name>` or `ollama create` |
| Model name format | Filename: `qwen2.5-1.5b-q4.gguf` | Tag: `qwen2.5:1.5b` |

A `.gguf` file in `./models` **cannot** be directly used by Ollama without first running `ollama create`. They are **not** transparently interchangeable from the app's perspective. The provider picker controls which inference engine is active — it is not just a model source filter.

---

## Implementation Order

1. `RuntimeConfig` singleton in `config.py`
2. `unload()` on `LlamaCppClient`
3. `set_llamacpp_client()` in `dependencies.py`
4. `POST /api/models/switch` endpoint
5. Persist to `UserSettings` (DB migration needed — delete `chat_history.db` to recreate)
6. `api.ts` new methods
7. `ModelBar.tsx` interactive dropdowns + loading state
8. `App.tsx` refresh after switch

---

## Known Risks

- **LlamaCpp unload**: Python's garbage collector may not immediately free VRAM/RAM after `del`. May need `gc.collect()` after unload.
- **In-flight requests**: A model switch while a chat stream is active could cause errors. The switch endpoint should reject requests while `isLoading` is true on the frontend, or queue the switch until the stream completes.
- **Mem0 re-init**: `Mem0MemoryManager` is initialized with a specific provider config. A provider switch also requires re-initializing `Mem0MemoryManager` with new config. `_pending_config` / `_ensure_initialized()` pattern already supports this — just reset `self.memory = None` and `self._pending_config = new_config`.
