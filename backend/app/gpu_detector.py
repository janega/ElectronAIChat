"""
GPU Detection and Auto-Configuration for LlamaCpp

Detects NVIDIA GPU availability and automatically upgrades llama-cpp-python
to CUDA-accelerated version if compatible hardware is found.
"""
import subprocess
import sys
import json
from pathlib import Path
from typing import Optional, Dict
from app.config import logger, BASE_DIR

# Cache file to store detection result
GPU_CACHE_FILE = BASE_DIR / ".gpu_detection_cache.json"


def detect_nvidia_gpu() -> Dict[str, any]:
    """
    Detect NVIDIA GPU using nvidia-smi.
    
    Returns:
        Dict with detected GPU info or empty dict if not found
    """
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,compute_cap", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(", ")
            if len(parts) >= 2:
                gpu_name = parts[0]
                vram_mb = int(parts[1].split()[0])
                compute_cap = parts[2] if len(parts) >= 3 else "unknown"
                
                return {
                    "available": True,
                    "name": gpu_name,
                    "vram_mb": vram_mb,
                    "compute_capability": compute_cap,
                    "recommended": vram_mb >= 4096  # Recommend GPU for 4GB+ VRAM
                }
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        logger.debug(f"nvidia-smi not available: {e}")
    
    return {"available": False}


def check_cuda_support() -> bool:
    """
    Check if current llama-cpp-python installation supports CUDA.
    
    Returns:
        True if CUDA is supported, False otherwise
    """
    try:
        import llama_cpp
        return llama_cpp.llama_supports_gpu_offload()
    except Exception as e:
        logger.warning(f"Failed to check CUDA support: {e}")
        return False


def load_cached_detection() -> Optional[Dict]:
    """Load cached GPU detection result."""
    if GPU_CACHE_FILE.exists():
        try:
            with open(GPU_CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load GPU cache: {e}")
    return None


def save_detection_cache(gpu_info: Dict, cuda_available: bool):
    """Save GPU detection result to cache."""
    try:
        cache_data = {
            "gpu_info": gpu_info,
            "cuda_available": cuda_available,
            "version": "1.0"
        }
        with open(GPU_CACHE_FILE, 'w') as f:
            json.dump(cache_data, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to save GPU cache: {e}")


def upgrade_to_cuda_version() -> bool:
    """
    Attempt to upgrade llama-cpp-python to CUDA version.
    
    Returns:
        True if upgrade successful, False otherwise
    """
    logger.info("🚀 Upgrading llama-cpp-python to CUDA version...")
    logger.info("   This will take 2-3 minutes (one-time operation)")
    
    try:
        # Uninstall current version
        subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "-y", "llama-cpp-python"],
            capture_output=True,
            timeout=60
        )
        
        # Install CUDA version
        result = subprocess.run(
            [
                sys.executable, "-m", "pip", "install",
                "llama-cpp-python==0.3.2",
                "--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cu121",
                "--no-cache-dir"
            ],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes
        )
        
        if result.returncode == 0:
            logger.info("✅ Successfully upgraded to CUDA version")
            logger.info("   Restart required for changes to take effect")
            return True
        else:
            logger.error(f"❌ CUDA upgrade failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ CUDA upgrade error: {e}")
        return False


def auto_detect_and_configure() -> Dict[str, any]:
    """
    Auto-detect GPU and configure llama-cpp-python accordingly.
    
    Returns:
        Dict with detection results and configuration status
    """
    logger.info("=" * 60)
    logger.info("🔍 GPU Auto-Detection for LlamaCpp")
    logger.info("=" * 60)
    
    # Check cache first
    cached = load_cached_detection()
    if cached:
        logger.info("📦 Using cached GPU detection result")
        cuda_available = check_cuda_support()
        if cached.get("cuda_available") == cuda_available:
            logger.info(f"   GPU: {cached['gpu_info'].get('name', 'N/A')}")
            logger.info(f"   CUDA: {cuda_available}")
            return cached
        else:
            logger.info("   Cache outdated, re-detecting...")
    
    # Detect GPU
    gpu_info = detect_nvidia_gpu()
    cuda_available = check_cuda_support()
    
    if gpu_info["available"]:
        logger.info(f"✅ NVIDIA GPU Detected: {gpu_info['name']}")
        logger.info(f"   VRAM: {gpu_info['vram_mb']} MB")
        logger.info(f"   Compute Capability: {gpu_info.get('compute_capability', 'unknown')}")
        
        if not cuda_available and gpu_info["recommended"]:
            logger.warning("⚠️  GPU detected but llama-cpp-python is CPU-only")
            logger.info("   Would you like to upgrade to GPU version?")
            logger.info("   Set AUTO_UPGRADE_GPU=true in .env to enable automatic upgrade")
            
            # Check if auto-upgrade is enabled
            import os
            if os.getenv("AUTO_UPGRADE_GPU", "false").lower() == "true":
                success = upgrade_to_cuda_version()
                if success:
                    cuda_available = True
                    logger.info("   Please restart the backend to use GPU acceleration")
        elif cuda_available:
            logger.info("✅ CUDA acceleration enabled")
    else:
        logger.info("ℹ️  No NVIDIA GPU detected")
        logger.info("   Using CPU-only version (slower but works)")
    
    # Save cache
    result = {
        "gpu_info": gpu_info,
        "cuda_available": cuda_available
    }
    save_detection_cache(gpu_info, cuda_available)
    
    logger.info("=" * 60)
    return result


if __name__ == "__main__":
    # Run detection when script is executed directly
    result = auto_detect_and_configure()
    print(json.dumps(result, indent=2))
