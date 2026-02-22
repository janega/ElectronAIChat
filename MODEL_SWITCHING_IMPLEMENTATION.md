# Model Switching Implementation Summary

## Overview

Implemented runtime LLM provider and model switching without requiring a backend restart. Work was split into two phases.

---

## Phase 1 — LlamaCpp Model Switching

### Backend

**`app/config.py`**
- Added `RuntimeConfig` class and `runtime_config` singleton.
- Holds `llamacpp_chat_model` (and later `provider`, `ollama_model`).
- Route handlers read mutable state from here instead of the frozen module-level constants.

**`app/llamacpp_client.py`**
- Added `unload()` method — frees `_chat_llm` and calls `gc.collect()`.
- The embedding model (`_embedding_llm`) is deliberately **not** unloaded so existing ChromaDB collections remain valid.

**`app/routes/dependencies.py`**
- Added `set_llamacpp_client(new_client)` — atomically replaces the `_llamacpp_client` singleton and resets `_llamacpp_embedding_manager = None` (lazily rebuilt on next request using the same embedding GGUF).

**`app/routes/models.py`** *(new file)*
- Owns `POST /api/models/switch`.
- Moved here from `health.py` (which is for diagnostics, not model management).

### Frontend

**`electron/src/utils/api.ts`**
- Added `switchModel(provider, model, userId?)`.

**`electron/src/components/ModelBar.tsx`**
- Enabled the model dropdown for LlamaCpp when `models.length > 1`.
- Added loading spinner + "loading…" label while switching.

**`electron/src/App.tsx`**
- Added `isSwitching` state and `handleModelSwitch` callback.
- Added auto-restore `useEffect` — fires once per session when `modelsData` and `userId` are first available. If `UserSettings.default_model` differs from the backend's active model and the file exists in the model list, it triggers a switch automatically.

---

## Phase 2 — Provider Switching + Ollama Model Switching

### Design Decisions

| Decision | Choice |
|---|---|
| Embedding backend after provider switch | **Fixed at startup provider** — avoids invalidating ChromaDB vectors |
| Default model when switching provider | Last used (UserSettings) → smallest by param count → first alphabetical |
| Model list refresh after switch | **Included in switch response** — no extra `GET /models` round-trip |
| Streams in progress when switch is called | **Continue with old model** — switch takes effect on next request |

### Backend

**`app/config.py`**
- `RuntimeConfig` extended with `provider: str` and `ollama_model: str`.
- `provider` is set in `main.py` lifespan after auto-detection; is the live source of truth for all route handlers.

**`app/routes/dependencies.py`**
- `_started_with_llamacpp` flag recorded in `set_managers()`.
- `get_langchain_manager()` always returns the LlamaCpp embedding manager when the app *started* with LlamaCpp, regardless of the current chat provider. This keeps embeddings stable.
- `get_openai_client()` reads `runtime_config.provider` (live) instead of the static `PROVIDER` constant.
- Added `set_openai_client(new_client)` — hot-swaps the Ollama/OpenAI client singleton.

**`app/routes/models.py`** — Full rewrite
- Accepts any provider (`llamacpp`, `ollama`, `openai`); `model` is optional.
- Helper `_pick_best_model(available, preferred)` sorts by estimated parameter count (ascending) so the smallest model is auto-selected when no preference is given.
- Helper `_estimate_params_billions(name)` parses sizes from filenames/tags (`0.6b`, `7b`, `500m`, etc.).
- Helper `_fetch_ollama_models()` queries `GET {OLLAMA_HOST}/api/tags`.
- On success: persists **both** `provider` and `default_model` to `UserSettings`, updates `runtime_config`, and swaps the client singleton.
- Returns `{ success, provider, model, models, changed, warning }` so the frontend can update in one call.
- Returns a `warning` (not a 4xx error) when no models are found, with a human-readable suggestion.

**`app/routes/health.py`**
- `GET /models`, `GET /capabilities`, `GET /health` all now read `runtime_config.provider` instead of the stale `PROVIDER` import so they reflect mid-session switches.

**`main.py`**
- Sets `runtime_config.provider` immediately after provider detection.
- Imports `runtime_config` for use in lifespan.

### Frontend

**`electron/src/utils/api.ts`**
- `switchModel(provider, model?, userId?)` — `model` is now optional.
- Return type extended with `models: string[]` and `warning: string | null`.

**`electron/src/components/ModelBar.tsx`**
- Provider badge replaced with a styled `<select>` dropdown (LlamaCpp / Ollama / OpenAI) using provider-specific colours.
- Changing provider calls `onModelSwitch(newProvider)` — backend picks best model.
- Changing model calls `onModelSwitch(currentProvider, newModel)`.
- Inline warning bar renders below the controls when `switchWarning` is set.
- "No models available" text shown in place of model dropdown when list is empty.

**`electron/src/App.tsx`**
- `switchWarning` state added; cleared on each new switch attempt.
- `handleModelSwitch(provider, model?)` — updates `modelsData` directly from the switch response (no extra `GET /models`), refreshes `modelInfo` via `GET /capabilities`.
- Auto-restore effect updated to pass provider to `handleModelSwitch`.

---

## File Map

| File | Change |
|---|---|
| `backend/app/config.py` | Added `RuntimeConfig` with `provider`, `llamacpp_chat_model`, `ollama_model` |
| `backend/app/llamacpp_client.py` | Added `unload()` method |
| `backend/app/routes/dependencies.py` | Added `_started_with_llamacpp`, `set_llamacpp_client`, `set_openai_client`; updated `get_langchain_manager` and `get_openai_client` |
| `backend/app/routes/models.py` | New file — owns `POST /api/models/switch` |
| `backend/app/routes/health.py` | Uses `runtime_config.provider` throughout; `POST /models/switch` removed |
| `backend/main.py` | Sets `runtime_config.provider` after detection; registers `models_router` |
| `electron/src/utils/api.ts` | `switchModel()` updated |
| `electron/src/components/ModelBar.tsx` | Provider + model dropdowns, warning bar |
| `electron/src/App.tsx` | `handleModelSwitch`, `switchWarning` state, auto-restore |
