# app/memory.py
from typing import Optional, Dict, Any, List
import logging
from .config import CHROMA_DIR, PROVIDER, OPENAI_API_KEY, OLLAMA_HOST, DEFAULT_OLLAMA_LLM_MODEL, DEFAULT_OPENAI_LLM_MODEL
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger("chat_backend.memory")

# Try to import mem0; if not available, provide a light fallback stub to avoid crash during dev/testing.
try:
    from mem0 import Memory
except Exception:
    Memory = None
    logger.warning("mem0 not available. Install mem0ai for production use or provide a compatible Memory class.")

class MemoryStub:
    """A tiny fallback memory to allow app to run while mem0 isn't installed."""
    def __init__(self):
        self._store = {}
        self._counter = 0

    def add(self, messages, user_id: str, metadata: Optional[dict] = None):
        entry_id = f"mem_{self._counter}"
        self._counter += 1
        self._store.setdefault(user_id, []).append({
            "id": entry_id,
            "messages": messages,
            "metadata": metadata or {}
        })
        return entry_id

    def search(self, query: str, user_id: str, limit: int = 5):
        # very naive: return last `limit` messages
        all_for_user = self._store.get(user_id, [])
        results = []
        for item in reversed(all_for_user[-limit:]):
            results.append({"memory": " | ".join([m.get("content", "") for m in item.get("messages", [])]), "metadata": item.get("metadata", {})})
        return results

    def get_all(self, user_id: str):
        return self._store.get(user_id, [])

    def update(self, memory_id: str, data: Dict[str, Any]):
        # naive update: scan and update
        for uid, items in self._store.items():
            for item in items:
                if item.get("id") == memory_id:
                    item.update(data)
                    return True
        return False

    def delete(self, memory_id: str):
        for uid, items in list(self._store.items()):
            new_items = [i for i in items if i.get("id") != memory_id]
            self._store[uid] = new_items
            return True
        return False

    def add_conversation_pair(self, user_id: str, user_message: str, assistant_message: str, metadata: Optional[dict] = None):
        """MemoryStub implementation of add_conversation_pair for fallback consistency"""
        if not user_message or not user_message.strip() or len(user_message.strip()) < 3:
            return None
        if not assistant_message or not assistant_message.strip() or len(assistant_message.strip()) < 3:
            return None
        
        conversation = [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message}
        ]
        return self.add(messages=conversation, user_id=user_id, metadata=metadata)

class Mem0MemoryManager:
    def __init__(self):
        """
        Initialize Mem0 memory manager with appropriate provider configuration.
        
        Tradeoffs:
        - mem0 library has strict config schema requirements per provider
        - We gracefully fallback to MemoryStub if initialization fails
        - This allows the app to run even if mem0 is misconfigured
        """
        
        # Build base config structure for mem0
        config = {
            "vector_store": {
                "provider": "chroma",
                "config": {
                    "collection_name": "mem0_memory",
                    "path": str(CHROMA_DIR / "mem0"),
                }
            },
        }
        
        # Add provider-specific LLM configuration
        if PROVIDER == "ollama":
            config["llm"] = {
                "provider": "ollama",
                "config": {
                    "model": DEFAULT_OLLAMA_LLM_MODEL,
                    "temperature": 0.1,
                    "max_tokens": 2000,
                    "ollama_base_url": OLLAMA_HOST,  # mem0 uses ollama_base_url, not base_url,
                    "top_p": 0.8,  # Slightly more focused than 0.9
                    "top_k": 40,
                }
            }
            config["embedder"] = {
                "provider": "ollama",
                "config": {
                    "model": "nomic-embed-text",
                    "ollama_base_url": OLLAMA_HOST,  # mem0 uses ollama_base_url, not base_url
                }
            }
        else:
            # OpenAI configuration
            config["llm"] = {
                "provider": "openai",
                "config": {
                    "model": DEFAULT_OPENAI_LLM_MODEL,
                    "temperature": 0.1,
                    "max_tokens": 2000,
                    "api_key": OPENAI_API_KEY,
                    "top_p": 0.8,  # Slightly more focused than 0.9
                    "top_k": 40,
                }
            }
            config["embedder"] = {
                "provider": "openai",
                "config": {
                    "model": "text-embedding-3-small",
                    "api_key": OPENAI_API_KEY,
                }
            }

        if Memory is not None:
            try:
                self.memory = Memory.from_config(config)
                logger.info(f"mem0 Memory initialized successfully with provider: {PROVIDER}")
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

    def add_message(self, user_id: str, message: str, role: str = "user", metadata: Optional[Dict] = None):
        # Validate inputs before attempting to store
        if not message or not message.strip():
            logger.debug(f"Skipping empty message for user {user_id}")
            return None
        
        # Additional validation: ensure minimum content length
        if len(message.strip()) < 3:
            logger.debug(f"Skipping too-short message for user {user_id}: '{message[:50]}'")
            return None

        try:
            # Log what we're sending to mem0
            logger.debug(f"Adding memory for user={user_id}, role={role}, content_length={len(message)}, content_preview='{message[:100]}'")
            
            # mem0 expects messages list objects
            result = self.memory.add(messages=[{"role": role, "content": message}], user_id=user_id, metadata=metadata or {})
            
            # Log mem0's response
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

    def add_conversation_pair(self, user_id: str, user_message: str, assistant_message: str, metadata: Optional[Dict] = None):
        """
        Store a complete user-assistant conversation pair in memory.
        Mem0 analyzes the full exchange for contextual fact extraction.
        
        Args:
            user_id: Unique identifier for the user
            user_message: The user's message content
            assistant_message: The assistant's response content
            metadata: Optional metadata (e.g., chat_id, timestamp)
            
        Returns:
            mem0 result dict or None if validation fails or deduplication occurs
        """
        # Validate both messages upfront
        if not user_message or not user_message.strip() or len(user_message.strip()) < 3:
            logger.debug(f"Invalid user message for user {user_id}: too short or empty")
            return None
            
        if not assistant_message or not assistant_message.strip() or len(assistant_message.strip()) < 3:
            logger.debug(f"Invalid assistant message for user {user_id}: too short or empty")
            return None

        try:
            logger.debug(f"Adding conversation pair for user={user_id}, user_msg='{user_message[:50]}...', assistant_msg='{assistant_message[:50]}...'")
            
            # Store conversation pair in single call
            conversation = [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": assistant_message}
            ]
            
            result = self.memory.add(
                messages=conversation,
                user_id=user_id,
                metadata=metadata or {}
            )
            
            # Log result at debug level
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

    def search_memory(self, user_id: str, query: str, limit: int = 5):
        try:
            logger.debug(f"Searching memory for user={user_id}, query='{query[:100]}', limit={limit}")
            result = self.memory.search(query=query, user_id=user_id, limit=limit)
            logger.debug(f"mem0 search returned {len(result) if result else 0} results")
            return result
        except Exception:
            logger.exception("Memory search failed")
            return []

    def get_all(self, user_id: str):
        try:
            return self.memory.get_all(user_id=user_id)
        except Exception:
            logger.exception("Failed to get all memories")
            return []

    def update_memory(self, memory_id: str, data: Dict[str, Any]):
        try:
            return self.memory.update(memory_id=memory_id, data=data)
        except Exception:
            logger.exception("Failed to update memory")
            return False

    def delete_memory(self, memory_id: str):
        try:
            return self.memory.delete(memory_id=memory_id)
        except Exception:
            logger.exception("Failed to delete memory")
            return False

    def get_user_context(self, user_id: str) -> str:
        memories = self.get_all(user_id)
        if not memories:
            return ""
        context_parts = []
        for mem in memories[:10]:
            if isinstance(mem, dict) and "memory" in mem:
                context_parts.append(f"- {mem['memory']}")
        if context_parts:
            return "User Context:\n" + "\n".join(context_parts)
        return ""
