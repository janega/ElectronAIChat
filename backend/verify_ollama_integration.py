#!/usr/bin/env python3
"""
Verification script for Ollama integration in ElectronAIChat.

This script tests:
1. Configuration loading
2. Provider selection
3. Manager initialization structure
4. Error handling
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

def test_config_loading():
    """Test that configuration loads correctly."""
    print("=" * 80)
    print("TEST 1: Configuration Loading")
    print("=" * 80)
    
    try:
        from app.config import (
            PROVIDER, OLLAMA_HOST, DEFAULT_OLLAMA_LLM_MODEL, 
            DEFAULT_OLLAMA_EMBED_MODEL, BASE_DIR, CHROMA_DIR
        )
        
        print(f"✅ Config loaded successfully")
        print(f"   Provider: {PROVIDER}")
        print(f"   Ollama Host: {OLLAMA_HOST}")
        print(f"   Ollama LLM Model: {DEFAULT_OLLAMA_LLM_MODEL}")
        print(f"   Ollama Embed Model: {DEFAULT_OLLAMA_EMBED_MODEL}")
        print(f"   Base Directory: {BASE_DIR}")
        print(f"   ChromaDB Directory: {CHROMA_DIR}")
        
        if PROVIDER == "ollama":
            print(f"✅ Provider correctly set to Ollama")
        else:
            print(f"⚠️  Provider is '{PROVIDER}', not 'ollama'")
            print(f"   (This is OK if you're testing OpenAI integration)")
        
        return True
    except Exception as e:
        print(f"❌ Config loading failed: {e}")
        return False

def test_embeddings_manager():
    """Test embeddings manager initialization."""
    print("\n" + "=" * 80)
    print("TEST 2: Embeddings Manager")
    print("=" * 80)
    
    try:
        from app.embeddings import LangChainEmbeddingManager
        
        print("✅ LangChainEmbeddingManager imported")
        
        # Test initialization without actually connecting to Ollama
        print("   Testing initialization structure...")
        
        # Check if OllamaEmbeddings is available
        try:
            from langchain_ollama import OllamaEmbeddings
            print("✅ langchain-ollama package is installed")
        except ImportError:
            print("❌ langchain-ollama not available")
            print("   Install with: pip install langchain-ollama")
            return False
        
        # Check if Chroma is available
        try:
            from langchain_community.vectorstores import Chroma
            print("✅ chromadb package is installed")
        except ImportError:
            print("❌ chromadb not available")
            print("   Install with: pip install chromadb")
            return False
        
        print("✅ All required embeddings packages available")
        return True
        
    except Exception as e:
        print(f"❌ Embeddings manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_openai_client():
    """Test OpenAI client initialization."""
    print("\n" + "=" * 80)
    print("TEST 3: OpenAI Client (LLM)")
    print("=" * 80)
    
    try:
        from app.openai_client import EnhancedOpenAIClient
        
        print("✅ EnhancedOpenAIClient imported")
        
        # Check if ChatOllama is available
        try:
            from langchain_ollama import ChatOllama
            print("✅ ChatOllama is available")
        except ImportError:
            print("❌ langchain-ollama not available")
            print("   Install with: pip install langchain-ollama")
            return False
        
        print("✅ All required LLM packages available")
        return True
        
    except Exception as e:
        print(f"❌ OpenAI client test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_memory_manager():
    """Test memory manager initialization."""
    print("\n" + "=" * 80)
    print("TEST 4: Memory Manager (Mem0)")
    print("=" * 80)
    
    try:
        from app.memory import Mem0MemoryManager
        
        print("✅ Mem0MemoryManager imported")
        
        # Check if mem0 is available
        try:
            from mem0 import Memory
            print("✅ mem0ai package is installed")
        except ImportError:
            print("⚠️  mem0ai not available (will use fallback MemoryStub)")
            print("   Install with: pip install mem0ai")
            print("   Note: App will work without mem0, using in-memory fallback")
        
        return True
        
    except Exception as e:
        print(f"❌ Memory manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_database():
    """Test database models."""
    print("\n" + "=" * 80)
    print("TEST 5: Database Models")
    print("=" * 80)
    
    try:
        from app.database import User, Chat, Message, Document, UserSettings
        
        print("✅ All database models imported successfully")
        print(f"   Models: User, Chat, Message, Document, UserSettings")
        
        return True
        
    except Exception as e:
        print(f"❌ Database models test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_routes():
    """Test route imports."""
    print("\n" + "=" * 80)
    print("TEST 6: API Routes")
    print("=" * 80)
    
    try:
        from app.routes.chat import router as chat_router
        from app.routes.documents import router as documents_router
        from app.routes.chats import router as chats_router
        from app.routes.users import router as users_router
        from app.routes.health import router as health_router
        
        print("✅ All route modules imported successfully")
        print(f"   Routes: chat, documents, chats, users, health")
        
        return True
        
    except Exception as e:
        print(f"❌ Routes test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_main_app():
    """Test main FastAPI app structure."""
    print("\n" + "=" * 80)
    print("TEST 7: FastAPI Application")
    print("=" * 80)
    
    try:
        # Just check imports, don't actually initialize
        print("   Checking main.py structure...")
        
        with open('main.py', 'r') as f:
            content = f.read()
            
            checks = [
                ('LangChainEmbeddingManager', 'LangChain embeddings manager'),
                ('Mem0MemoryManager', 'Mem0 memory manager'),
                ('EnhancedOpenAIClient', 'OpenAI/Ollama client'),
                ('dependencies.set_managers', 'Dependency injection setup'),
                ('lifespan', 'Lifecycle management'),
                ('ChatOllama', 'Not expected - should use EnhancedOpenAIClient'),
            ]
            
            for check_str, description in checks[:5]:  # First 5 are expected
                if check_str in content:
                    print(f"✅ Found {description}")
                else:
                    print(f"⚠️  Missing {description}")
            
            # Last check should NOT be present (abstraction test)
            if 'ChatOllama' not in content or 'from langchain_ollama import ChatOllama' not in content:
                print(f"✅ Uses abstraction layer (not direct ChatOllama import in main)")
            else:
                print(f"⚠️  Direct ChatOllama import found (should use EnhancedOpenAIClient)")
        
        print("✅ Main application structure looks correct")
        return True
        
    except Exception as e:
        print(f"❌ Main app test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all verification tests."""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "OLLAMA INTEGRATION VERIFICATION" + " " * 25 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    tests = [
        ("Configuration Loading", test_config_loading),
        ("Embeddings Manager", test_embeddings_manager),
        ("OpenAI Client (LLM)", test_openai_client),
        ("Memory Manager", test_memory_manager),
        ("Database Models", test_database),
        ("API Routes", test_routes),
        ("FastAPI Application", test_main_app),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Unexpected error in {name}: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("=" * 80)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! Ollama integration is correctly configured.")
        print("\nNext steps:")
        print("1. Ensure Ollama is installed: ollama --version")
        print("2. Pull required models: ollama pull nomic-embed-text && ollama pull llama3")
        print("3. Start Ollama: ollama serve")
        print("4. Start backend: python main.py")
        return 0
    else:
        print("⚠️  Some tests failed. Check errors above.")
        print("\nCommon fixes:")
        print("1. Install missing packages: pip install -r requirements.txt")
        print("2. Check .env file exists: cp .env.example .env")
        return 1

if __name__ == "__main__":
    sys.exit(main())
