# app/schemas.py
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any

class DocumentMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    size: int
    uploadedAt: str
    contentType: str
    chunks: int

class UploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    success: bool
    document: DocumentMetadata

class EmbeddingTestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    success: bool
    text: str
    embedding_length: int
    provider: str
    sample: List[float]

class HealthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    status: str
    provider: str
    components: dict
