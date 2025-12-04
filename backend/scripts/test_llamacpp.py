#!/usr/bin/env python3
"""
LlamaCpp Provider Test Script

Tests LlamaCpp integration with chat completions and embeddings.

Usage:
    python scripts/test_llamacpp.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from app.llamacpp_client import LlamaCppClient, LlamaCppEmbeddingManager
except ImportError as e:
    print(f"ERROR: Failed to import LlamaCpp client: {e}")
    print("\nMake sure llama-cpp-python is installed:")
    print("  pip install llama-cpp-python")
    sys.exit(1)


async def test_chat_completion(client: LlamaCppClient):
    """Test chat completion streaming."""
    print("\n=== Testing Chat Completion ===")
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is 2 + 2? Answer briefly."}
    ]
    
    print(f"GPU layers: {client.n_gpu_layers}")
    print(f"Models loaded: {client._chat_llm is not None}")
    print("\nStreaming response:")
    
    full_response = ""
    async for chunk in client.create_chat_completion(
        model="",  # Model is loaded in __init__
        messages=messages,
        temperature=0.7,
        max_tokens=100,
        stream=True
    ):
        if chunk.get("error"):
            print(f"\n✗ Error: {chunk['error']}")
            return False
        
        token = chunk.get("token", "")
        if token:
            print(token, end="", flush=True)
            full_response += token
        
        if chunk.get("done"):
            break
    
    print("\n✓ Chat completion successful")
    return True


async def test_embeddings(client: LlamaCppClient):
    """Test embedding generation."""
    print("\n=== Testing Embeddings ===")
    
    texts = [
        "The quick brown fox jumps over the lazy dog",
        "Machine learning is a subset of artificial intelligence"
    ]
    
    print(f"Embedding {len(texts)} texts...")
    
    try:
        embeddings = await client.create_embeddings(texts)
        
        print(f"✓ Generated {len(embeddings)} embeddings")
        print(f"  Dimension: {len(embeddings[0])}")
        print(f"  Sample values: {[f'{v:.3f}' for v in embeddings[0][:5]]}")
        
        return True
    except Exception as e:
        print(f"✗ Embedding generation failed: {e}")
        return False


async def main():
    """Main test function."""
    print("Testing LlamaCpp Provider")
    print("=" * 60)
    
    # Check if models exist
    models_dir = Path("models")
    chat_model = models_dir / "qwen3-0.6b-q4.gguf"
    embed_model = models_dir / "nomic-embed-text-q4.gguf"
    
    if not chat_model.exists():
        print(f"✗ Chat model not found: {chat_model}")
        print("\nRun: python scripts/download_models.py")
        sys.exit(1)
    
    if not embed_model.exists():
        print(f"✗ Embedding model not found: {embed_model}")
        print("\nRun: python scripts/download_models.py")
        sys.exit(1)
    
    # Initialize client
    try:
        client = LlamaCppClient(
            chat_model_path="qwen3-0.6b-q4.gguf",
            embedding_model_path="nomic-embed-text-q4.gguf",
            models_dir="models",
            n_ctx=2048,
            verbose=False
        )
    except Exception as e:
        print(f"✗ Failed to initialize LlamaCpp client: {e}")
        sys.exit(1)
    
    # Print model info
    info = client.get_model_info()
    print("\n=== Model Information ===")
    for key, value in info.items():
        print(f"{key}: {value}")
    
    # Run tests
    chat_success = await test_chat_completion(client)
    embed_success = await test_embeddings(client)
    
    # Summary
    print("\n" + "=" * 60)
    if chat_success and embed_success:
        print("✓ All tests passed!")
        print("\nLlamaCpp provider is ready to use.")
        print("Set PROVIDER=llamacpp in .env and start your server.")
    else:
        print("✗ Some tests failed. See errors above.")
        sys.exit(1)
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
