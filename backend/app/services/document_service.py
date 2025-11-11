import json
import hashlib
import numpy as np
from pathlib import Path
import ollama
import redis
from typing import List, Optional, Union, Dict, Any
from tqdm import tqdm

class DocumentService:
    def __init__(self, redis_url: str, embed_model: str, ollama_host: str = "http://localhost:11434"):
        self.redis_client = redis.from_url(redis_url)
        self.embed_model = embed_model
        self.ollama_client = ollama.Client(host=ollama_host)        

    def compute_hash(self, file_path: str) -> str:
        """Create a hash of the file contents for cache invalidation."""
        with open(file_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def embed_text(self, text: str) -> np.ndarray:
        """Get vector embedding using Ollama."""
        response = self.ollama_client.embeddings(model=self.embed_model, prompt=text)
        return np.array(response["embedding"], dtype=np.float32)

    def store_embeddings(self, key_prefix: str, data: List[Union[str, Dict]]) -> None:
        """Store embeddings in Redis if not already present."""
        for i, entry in enumerate(tqdm(data, desc="Embedding entries")):
            text = entry if isinstance(entry, str) else json.dumps(entry)
            vector = self.embed_text(text)
            self.redis_client.hset(f"{key_prefix}:{i}", mapping={
                "text": text,
                "vector": vector.tobytes()
            })

    def load_or_build_vectors(self, file_path: str, allow_ocr: bool = False) -> str:
        """Smartly load or build vectors from JSON or PDF."""
        from utils.helpers import load_pdf, load_json, load_pdf_with_ocr
        
        file_hash = self.compute_hash(file_path)
        key_prefix = f"docs:{file_hash}"

        if self.redis_client.exists(f"{key_prefix}:0"):
            return key_prefix

        file_path_obj = Path(file_path)
        if file_path_obj.suffix.lower() == '.pdf':
            data = load_pdf(str(file_path_obj))
            if (not data or len(data) == 0) and allow_ocr:
                data = load_pdf_with_ocr(str(file_path_obj))
        else:
            data = load_json(str(file_path_obj))

        if not data:
            raise ValueError(f"No data could be extracted from {file_path_obj}")

        self.store_embeddings(key_prefix, data)
        return key_prefix

    def query_documents(self, key_prefixes: Optional[Union[str, List[str]]], 
                       query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search Redis for closest notes to query."""
        query_vector = self.embed_text(query)
        results = []

        def iter_keys():
            if key_prefixes is None:
                pattern = "docs:*:*"
                yield from self.redis_client.scan_iter(pattern)
            elif isinstance(key_prefixes, str):
                pattern = f"{key_prefixes}:*"
                yield from self.redis_client.scan_iter(pattern)
            elif isinstance(key_prefixes, (list, tuple, set)):
                for p in key_prefixes:
                    pattern = f"{p}:*"
                    yield from self.redis_client.scan_iter(pattern)

        for key in iter_keys():
            entry = self.redis_client.hgetall(key)
            if not entry:
                continue
            
            vector = np.frombuffer(entry[b'vector'], dtype=np.float32)
            similarity = np.dot(query_vector, vector)
            
            results.append({
                'text': entry[b'text'].decode('utf-8'),
                'similarity': float(similarity),
                'key': key.decode('utf-8')
            })

        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]
    
    

