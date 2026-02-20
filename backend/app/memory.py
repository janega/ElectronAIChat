# app/memory.py
from typing import Optional, Dict, Any, List
import logging
from .config import CHROMA_DIR, OPENAI_API_KEY, OLLAMA_HOST, DEFAULT_OLLAMA_LLM_MODEL, DEFAULT_OPENAI_LLM_MODEL, PROVIDER

logger = logging.getLogger("chat_backend.memory")

# Memory extraction prompt for deterministic, focused fact extraction
MEMORY_EXTRACTION_PROMPT = """Extract only long-term, explicit user facts suitable for persistence across sessions.
Exclude ephemeral states, time-bound info, jokes, or vague inferences.
Save only if the fact is explicit and unambiguous.
Focus on: user preferences, skills, workflows, projects, tools, and personal information."""

# Try to import mem0; if not available, provide a light fallback stub to avoid crash during dev/testing.
try:
    from mem0 import AsyncMemory
except Exception:
    AsyncMemory = None
    logger.warning("mem0 not available. Install mem0ai for production use or provide a compatible Memory class.")

class MemoryStub:
    """A tiny fallback memory to allow app to run while mem0 isn't installed."""
    def __init__(self):
        self._store = {}
        self._counter = 0

    async def add(self, messages, user_id: str, metadata: Optional[dict] = None):
        entry_id = f"mem_{self._counter}"
        self._counter += 1
        self._store.setdefault(user_id, []).append({
            "id": entry_id,
            "messages": messages,
            "metadata": metadata or {}
        })
        return entry_id

    async def search(self, query: str, user_id: str, limit: int = 5):
        # very naive: return last `limit` messages
        all_for_user = self._store.get(user_id, [])
        results = []
        for item in reversed(all_for_user[-limit:]):
            results.append({"memory": " | ".join([m.get("content", "") for m in item.get("messages", [])]), "metadata": item.get("metadata", {})})
        return {"results": results}  # v1.1 format wrapper

    async def get_all(self, user_id: str):
        return self._store.get(user_id, [])

    async def update(self, memory_id: str, data: Dict[str, Any]):
        # naive update: scan and update
        for uid, items in self._store.items():
            for item in items:
                if item.get("id") == memory_id:
                    item.update(data)
                    return True
        return False

    async def delete(self, memory_id: str):
        for uid, items in list(self._store.items()):
            new_items = [i for i in items if i.get("id") != memory_id]
            self._store[uid] = new_items
            return True
        return False

    async def add_conversation_pair(self, user_id: str, user_message: str, assistant_message: str, metadata: Optional[dict] = None):
        """MemoryStub implementation of add_conversation_pair for fallback consistency"""
        if not user_message or not user_message.strip() or len(user_message.strip()) < 3:
            return None
        if not assistant_message or not assistant_message.strip() or len(assistant_message.strip()) < 3:
            return None
        
        conversation = [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message}
        ]
        return await self.add(messages=conversation, user_id=user_id, metadata=metadata)

class Mem0MemoryManager:
    def __init__(self):
        """
        Initialize Mem0 memory manager with appropriate provider configuration.
        
        Provider Support:
        - Ollama: Native support via ollama provider
        - OpenAI: Native support via openai provider
        - LlamaCpp: Uses internal OpenAI-compatible wrapper (llamacpp_api.py)
          Configures Mem0 with openai provider pointing to http://127.0.0.1:8000/v1
          Falls back to MemoryStub if model files are missing
        
        LlamaCpp Integration:
        - Mem0 doesn't natively support llama-cpp-python
        - We expose internal /v1/completions and /v1/embeddings endpoints
        - Mem0 treats these as OpenAI-compatible API via custom base_url
        - This enables full Mem0 functionality with local GGUF models
        
        Fallback Strategy:
        - mem0 library has strict config schema requirements per provider
        - We gracefully fallback to MemoryStub if initialization fails
        - This allows the app to run even if mem0 is misconfigured
        
        v1.0 Features:
        - custom_instructions: Guides LLM to extract only long-term, explicit facts
        - Deterministic extraction: Low temperature (0.1) and focused top_p (0.2)
        - v1.1 format: All responses return {"results": [...]} wrapper
        """
        self._initialize_memory()
        
    def _initialize_memory(self):    
        # Build base config structure for mem0
        config = {
            "vector_store": {
                "provider": "chroma",
                "config": {
                    "collection_name": "mem0_memory",
                    "path": str(CHROMA_DIR / "mem0"),
                }
            },
            "custom_instructions": MEMORY_EXTRACTION_PROMPT,  # v1.0 feature
        }
        
        # Add provider-specific LLM configuration
        if PROVIDER == "llamacpp":
            # LlamaCpp: Memory disabled to avoid circular dependency deadlock
            #
            # PROBLEM: Mem0 needs to call OpenAI-compatible endpoints (/v1/embeddings, /v1/completions)
            # When these endpoints run on the same FastAPI server (port 8000), Mem0 calls during
            # chat streaming create a circular dependency - the server calls itself and deadlocks.
            #
            # SOLUTION: Run llama-cpp-python endpoints on a separate server (port 8001)
            # This allows Mem0 to call http://127.0.0.1:8001/v1 without blocking the main server.
            #
            # IMPLEMENTATION:
            # 1. Create llamacpp_server.py - standalone FastAPI app with OpenAI-compatible routes
            # 2. Run on port 8001 (separate from main backend on port 8000)
            # 3. Configure Mem0 to use "openai_base_url": "http://127.0.0.1:8001/v1"
            # 4. Update Electron main.ts to spawn both processes
            # 5. Update PyInstaller to build both backend.exe and llamacpp_api.exe
            #
            # TRADE-OFFS:
            # + Full Mem0 functionality with llamacpp (persistent memory across sessions)
            # + No circular dependency deadlock
            # - ~3GB additional RAM usage (llama-cpp-python + loaded models)
            # - 2-3s extra startup time
            # - More complex deployment (two processes to manage)
            #
            # For now, using MemoryStub for simplicity and lower resource usage.
            # TODO: Implement separate llamacpp API server for full Mem0 + llamacpp integration
            
            logger.info("LlamaCpp provider detected - using MemoryStub (Mem0 disabled to avoid deadlock)")
            logger.info("To enable Mem0 with llamacpp, implement separate API server on port 8001")
            self.memory = MemoryStub()
            return
            config["embedder"] = {
                "provider": "openai",  # Use OpenAI provider with custom base_url
                "config": {
                    "model": "llamacpp-embed",
                    "api_key": "dummy",  # Not used by our internal endpoints
                    "openai_base_url": internal_base_url,  # Point to our llamacpp endpoints
                }
            }
            
            logger.info("✅ LlamaCpp configured for Mem0 via OpenAI-compatible endpoints")
            logger.info(f"   Using internal API at {internal_base_url}")
        
        elif PROVIDER == "ollama":
            config["llm"] = {
                "provider": "ollama",
                "config": {
                    "model": DEFAULT_OLLAMA_LLM_MODEL,
                    "temperature": 0.1,  # Deterministic extraction
                    "max_tokens": 250,  # Increased for complex fact extraction
                    "ollama_base_url": OLLAMA_HOST,  # mem0 uses ollama_base_url, not base_url
                    "top_p": 0.2,  # Very focused sampling for explicit facts only
                    "top_k": 10,  # Moderate diversity for extraction quality
                }
            }
            config["embedder"] = {
                "provider": "ollama",
                "config": {
                    "model": "nomic-embed-text:latest",
                    "ollama_base_url": OLLAMA_HOST,
                }
            }
        
        elif PROVIDER == "openai":
            # OpenAI configuration
            config["llm"] = {
                "provider": "openai",
                "config": {
                    "model": DEFAULT_OPENAI_LLM_MODEL,
                    "temperature": 0.1,  # Deterministic extraction
                    "max_tokens": 250,  # Increased for complex fact extraction
                    "api_key": OPENAI_API_KEY,
                    "top_p": 0.2,  # Very focused sampling for explicit facts only
                    # Note: OpenAI doesn't support top_k parameter
                }
            }
            config["embedder"] = {
                "provider": "openai",
                "config": {
                    "model": "text-embedding-3-small",
                    "api_key": OPENAI_API_KEY,
                }
            }
        
        else:
            # Unknown provider - use MemoryStub
            logger.warning(f"Unknown provider '{PROVIDER}' for Mem0, using MemoryStub")
            self.memory = MemoryStub()
            return

        if AsyncMemory is not None:
            try:
                # Debug: Log config structure before initialization
                import json
                logger.info(f"Initializing mem0 with config: {json.dumps({k: v if k != 'custom_instructions' else '...' for k, v in config.items()}, indent=2, default=str)}")
                
                self.memory = AsyncMemory.from_config(config)
                logger.info(f"✅ mem0 AsyncMemory initialized successfully (using {PROVIDER} provider)")
            except TypeError as e:
                # Config schema mismatch - mem0 may have different version requirements
                logger.warning(
                    f"mem0 config schema error (likely version mismatch): {str(e)[:100]}"
                )
                logger.info("Falling back to in-memory MemoryStub")
                self.memory = MemoryStub()
            except Exception as e:
                logger.exception(f"mem0 initialization failed: {type(e).__name__}")
                logger.info("Falling back to in-memory MemoryStub")
                self.memory = MemoryStub()
        else:
            logger.info("mem0 package not available, using in-memory MemoryStub")
            self.memory = MemoryStub()

    def _should_persist(self, message: str) -> bool:
        """
        Semantic filter to determine if a message should be persisted to long-term memory.
        Rejects greetings, filler words, very short messages, and question-only content.
        
        Returns:
            True if message should be stored, False otherwise
        """
        if not message or not message.strip():
            return False
        
        normalized = message.strip().lower()
        
        # Reject very short messages (< 10 words)
        word_count = len(normalized.split())
        if word_count < 10:
            # Allow short declarative statements if they contain key indicators
            key_indicators = ["prefer", "like", "use", "work", "specialize", "live in", "am a", "my"]
            if not any(indicator in normalized for indicator in key_indicators):
                logger.debug(f"Rejecting short message ({word_count} words): '{message[:50]}...'")
                return False
        
        # Reject common greetings and fillers
        greetings = ["hi", "hello", "hey", "thanks", "thank you", "bye", "goodbye", "ok", "okay"]
        filler_patterns = ["hmm", "uh", "um", "ah", "well", "i see", "got it", "makes sense"]
        
        # Check if message is ONLY a greeting/filler (not part of longer content)
        if normalized in greetings or normalized in filler_patterns:
            logger.debug(f"Rejecting greeting/filler: '{message[:50]}...'")
            return False
        
        # Reject question-only messages (unless they reveal user preferences)
        if normalized.endswith("?") and word_count < 15:
            preference_markers = ["should i", "do i", "can i", "would i", "my", "i prefer"]
            if not any(marker in normalized for marker in preference_markers):
                logger.debug(f"Rejecting question-only message: '{message[:50]}...'")
                return False
        
        # Reject vague/ambiguous statements
        vague_patterns = ["it depends", "maybe", "perhaps", "i guess", "not sure", "might be"]
        if any(pattern in normalized for pattern in vague_patterns) and word_count < 15:
            logger.debug(f"Rejecting vague statement: '{message[:50]}...'")
            return False
        
        return True

    async def add_message(self, user_id: str, message: str, role: str = "user", metadata: Optional[Dict] = None):
        # Apply semantic filter before storage
        if not self._should_persist(message):
            logger.debug(f"Semantic filter rejected message for user {user_id}")
            return None

        try:
            # Log what we're sending to mem0
            logger.debug(f"Adding memory for user={user_id}, role={role}, content_length={len(message)}, content_preview='{message[:100]}'")
            
            # Add metadata tag for filtered retrieval
            enriched_metadata = metadata or {}
            enriched_metadata["content_type"] = "user_message"
            
            result = await self.memory.add(
                messages=[{"role": role, "content": message}],
                user_id=user_id,
                metadata=enriched_metadata
            )
            
            # v1.1 format: result is {"results": [...]}
            if result and isinstance(result, dict) and result.get('results'):
                logger.debug(f"mem0 add result: {len(result['results'])} memories added")
            elif result and isinstance(result, dict) and 'results' in result and not result['results']:
                logger.debug(f"mem0 returned empty results (all NOOPs - facts already known)")
            else:
                logger.debug(f"mem0 add result: {result}")
            return result
        except ValueError as e:
            # ValueError typically means empty embeddings - this is expected when mem0 deduplicates
            error_msg = str(e)
            if "empty" in error_msg.lower() or "embeddings" in error_msg.lower():
                logger.debug(f"mem0 skipped storage (likely duplicate/NOOP): {error_msg}")
            else:
                logger.warning(f"mem0 ValueError: {error_msg}")
            return None
        except Exception as e:
            logger.warning(f"Failed to add memory: {type(e).__name__}: {str(e)}")
            # Silently continue - memory storage is not critical for chat functionality
            return None

    async def add_conversation_pair(self, user_id: str, user_message: str, assistant_message: str, metadata: Optional[Dict] = None):
        """
        Store a complete user-assistant conversation pair in memory.
        Mem0 analyzes the full exchange for contextual fact extraction.
        
        Args:
            user_id: Unique identifier for the user
            user_message: The user's message content
            assistant_message: The assistant's response content
            metadata: Optional metadata (e.g., chat_id, timestamp)
            
        Returns:
            mem0 result dict (v1.1 format: {"results": [...]}) or None if filtered/failed
        """
        # Apply semantic filter to user message
        if not self._should_persist(user_message):
            logger.debug(f"Semantic filter rejected conversation pair for user {user_id}")
            return None
            
        # Validate assistant message (less strict - no semantic filter)
        if not assistant_message or not assistant_message.strip() or len(assistant_message.strip()) < 3:
            logger.debug(f"Invalid assistant message for user {user_id}: too short or empty")
            return None

        try:
            logger.debug(f"Adding conversation pair for user={user_id}, user_msg='{user_message[:50]}...', assistant_msg='{assistant_message[:50]}...'")
            
            # Add metadata tags for filtered retrieval
            enriched_metadata = metadata or {}
            enriched_metadata["content_type"] = "conversation"
            enriched_metadata["interaction_type"] = "chat_exchange"
            
            # Store conversation pair in single call
            conversation = [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": assistant_message}
            ]
            
            result = await self.memory.add(
                messages=conversation,
                user_id=user_id,
                metadata=enriched_metadata
            )
            
            # v1.1 format: result is {"results": [...]}
            if result and isinstance(result, dict) and result.get('results'):
                logger.debug(f"mem0 stored conversation pair: {len(result['results'])} memories extracted")
            elif result and isinstance(result, dict) and 'results' in result and not result['results']:
                logger.debug(f"mem0 returned empty results (facts already known)")
            else:
                logger.debug(f"mem0 conversation pair result: {result}")
            
            return result
            
        except ValueError as e:
            # ValueError typically means empty embeddings - mem0's deduplication at work
            error_msg = str(e)
            if "empty" in error_msg.lower() or "embeddings" in error_msg.lower():
                logger.debug(f"mem0 skipped conversation pair (duplicate/NOOP): {error_msg}")
            else:
                logger.warning(f"mem0 ValueError on conversation pair: {error_msg}")
            return None
            
        except Exception as e:
            logger.warning(f"Failed to add conversation pair: {type(e).__name__}: {str(e)}")
            return None

    async def search_memory(self, user_id: str, query: str, limit: int = 5):
        try:
            logger.debug(f"Searching memory for user={user_id}, query='{query[:100]}', limit={limit}")
            result = await self.memory.search(query=query, user_id=user_id, limit=limit)
            
            # v1.1 format: result is {"results": [...]}
            if result and isinstance(result, dict) and 'results' in result:
                logger.debug(f"mem0 search returned {len(result['results'])} results")
            else:
                logger.debug(f"mem0 search returned: {result}")
            return result
        except Exception:
            logger.exception("Memory search failed")
            return {"results": []}  # Return v1.1 format on error

    async def get_all(self, user_id: str):
        try:
            return await self.memory.get_all(user_id=user_id)
        except Exception:
            logger.exception("Failed to get all memories")
            return []

    async def update_memory(self, memory_id: str, data: Dict[str, Any]):
        try:
            return await self.memory.update(memory_id=memory_id, data=data)
        except Exception:
            logger.exception("Failed to update memory")
            return False

    async def delete_memory(self, memory_id: str):
        try:
            return await self.memory.delete(memory_id=memory_id)
        except Exception:
            logger.exception("Failed to delete memory")
            return False

    async def get_user_context(self, user_id: str) -> str:
        memories = await self.get_all(user_id)
        if not memories:
            return ""
        context_parts = []
        for mem in memories[:10]:
            if isinstance(mem, dict) and "memory" in mem:
                context_parts.append(f"- {mem['memory']}")
        if context_parts:
            return "User Context:\n" + "\n".join(context_parts)
        return ""
