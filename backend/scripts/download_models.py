#!/usr/bin/env python3
"""
Model Download Script for LlamaCpp Provider

Downloads quantized GGUF models from HuggingFace Hub for local inference.

Default Models:
- Chat: Qwen/Qwen2.5-0.5B-Instruct-GGUF (qwen3-0.6b-q4.gguf) ~350MB
- Embeddings: nomic-ai/nomic-embed-text-v1.5-GGUF (nomic-embed-text-q4.gguf) ~140MB

Usage:
    python scripts/download_models.py              # Download both models
    python scripts/download_models.py --chat-only  # Download chat model only
    python scripts/download_models.py --embed-only # Download embedding model only
"""
import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from huggingface_hub import hf_hub_download
    from tqdm import tqdm
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("ERROR: Required packages not installed")
    print("Install with: pip install huggingface-hub tqdm")
    sys.exit(1)


# Model configurations
MODELS = {
    "chat": {
        "repo_id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "local_name": "qwen3-0.6b-q4.gguf",
        "size": "~350MB",
        "description": "Qwen 2.5 0.5B Instruct (Q4_K_M quantization)"
    },
    "embedding": {
        "repo_id": "nomic-ai/nomic-embed-text-v1.5-GGUF",
        "filename": "nomic-embed-text-v1.5.Q4_K_M.gguf",
        "local_name": "nomic-embed-text-q4.gguf",
        "size": "~140MB",
        "description": "Nomic Embed Text v1.5 (Q4_K_M quantization)"
    }
}


def download_model(model_type: str, models_dir: Path) -> bool:
    """
    Download a model from HuggingFace Hub.
    
    Args:
        model_type: Type of model to download ('chat' or 'embedding')
        models_dir: Directory to save model files
        
    Returns:
        True if successful, False otherwise
    """
    if model_type not in MODELS:
        print(f"ERROR: Unknown model type '{model_type}'")
        return False
    
    model_config = MODELS[model_type]
    local_path = models_dir / model_config["local_name"]
    
    # Check if already downloaded
    if local_path.exists():
        print(f"✓ {model_config['local_name']} already exists")
        return True
    
    print(f"\nDownloading {model_config['local_name']} ({model_config['size']})...")
    print(f"  Source: {model_config['repo_id']}/{model_config['filename']}")
    print(f"  Description: {model_config['description']}")
    
    try:
        # Download with progress bar
        downloaded_path = hf_hub_download(
            repo_id=model_config["repo_id"],
            filename=model_config["filename"],
            cache_dir=str(models_dir / ".cache"),
            local_dir=str(models_dir),
            local_dir_use_symlinks=False,
        )
        
        # Rename to expected filename
        downloaded_file = Path(downloaded_path)
        if downloaded_file.name != model_config["local_name"]:
            downloaded_file.rename(local_path)
            print(f"✓ Downloaded {model_config['local_name']}")
        else:
            print(f"✓ Downloaded {model_config['local_name']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to download {model_config['local_name']}: {e}")
        return False


def main():
    """Main entry point for model download script."""
    parser = argparse.ArgumentParser(
        description="Download GGUF models for LlamaCpp provider",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/download_models.py              # Download both models
  python scripts/download_models.py --chat-only  # Chat model only
  python scripts/download_models.py --embed-only # Embedding model only
        """
    )
    parser.add_argument(
        "--chat-only",
        action="store_true",
        help="Download only the chat model"
    )
    parser.add_argument(
        "--embed-only",
        action="store_true",
        help="Download only the embedding model"
    )
    parser.add_argument(
        "--models-dir",
        type=str,
        default="models",
        help="Directory to save models (default: models/)"
    )
    
    args = parser.parse_args()
    
    # Determine which models to download
    download_chat = not args.embed_only
    download_embed = not args.chat_only
    
    # Create models directory
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("LlamaCpp Model Downloader")
    print("=" * 60)
    print(f"Models directory: {models_dir.absolute()}")
    
    # Download models
    success = True
    
    if download_chat:
        success = download_model("chat", models_dir) and success
    
    if download_embed:
        success = download_model("embedding", models_dir) and success
    
    # Summary
    print("\n" + "=" * 60)
    if success:
        print("✓ All models downloaded successfully!")
        print("\nNext steps:")
        print("1. Set PROVIDER=llamacpp in your .env file")
        print("2. Run: python scripts/test_llamacpp.py")
        print("3. Start your FastAPI server: python main.py")
    else:
        print("✗ Some downloads failed. Please check errors above.")
        sys.exit(1)
    print("=" * 60)


if __name__ == "__main__":
    main()
