# app/routes/documents.py
"""
Document upload and RAG (Retrieval-Augmented Generation) endpoints.
Handles file uploads, text extraction (with OCR/JSON support), embedding generation, and vector storage.
"""
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from app.config import UPLOAD_DIR, MAX_UPLOAD_SIZE, logger
from app.utils import extract_text_from_file
from app.schemas import UploadResponse
from .dependencies import LangChainManager, Mem0Manager, DBSession

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    chatId: str = Form(...),
    userId: str = Form(...),
    langchain_manager: LangChainManager = None,
    mem0_manager: Mem0Manager = None,
    session: DBSession = None
):
    """
    Upload and process documents for RAG functionality.
    
    Process:
    1. Validate file size and type
    2. Extract text content (PDF with OCR fallback, JSON, plain text)
    3. Generate embeddings and store in ChromaDB
    4. Create memory record of upload event
    5. Clean up temporary files (per security requirement)
    
    Args:
        file: Uploaded file (PDF, TXT, JSON, MD, PY, etc.)
        chatId: Chat session to associate document with
        userId: User uploading the document
    
    Returns:
        Document metadata including ID, chunks created, and upload timestamp
    
    Security Notes:
    - Files are deleted after embedding to prevent disk accumulation
    - Size limits enforced to prevent DoS attacks
    - Content type validation for supported formats
    """
    try:
        # 1. Validate file size
        content = await file.read()
        size = len(content)
        
        if size > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE} bytes"
            )

        # 2. Generate unique file ID and save temporarily
        file_id = str(uuid.uuid4())
        suffix = Path(file.filename).suffix
        file_path = UPLOAD_DIR / f"{file_id}{suffix}"
        
        # Write to disk for text extraction
        file_path.write_bytes(content)

        # 3. Extract text content (with OCR and JSON support)
        try:
            text_content = extract_text_from_file(file_path, file.content_type)
        except Exception as e:
            # Clean up file on extraction failure
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(
                status_code=422, 
                detail=f"Failed to extract text from file: {str(e)}"
            )

        # 4. Verify chat exists (or create it)
        from app.database import Chat, User
        chat = session.get(Chat, chatId)
        if not chat:
            # Auto-create chat if it doesn't exist
            logger.info(f"Chat '{chatId}' not found, creating automatically")
            
            # Verify user exists first
            user = session.query(User).filter(User.username == userId).first()
            if not user:
                # Create user if needed
                user = User(id=userId, username=userId)
                session.add(user)
                session.commit()
                logger.info(f"Created user: {userId}")
            
            # Create chat
            chat = Chat(
                id=chatId,
                user_id=user.id,
                title=f"Document Upload - {file.filename}",
                search_mode="embeddings"
            )
            session.add(chat)
            session.commit()
            logger.info(f"Created chat: {chatId}")

        # 5. Generate embeddings and store in ChromaDB
        try:
            num_chunks = await langchain_manager.add_document(
                chat_id=chatId,
                text=text_content,
                metadata={
                    "doc_id": file_id,
                    "filename": file.filename,
                    "uploaded_at": datetime.utcnow().isoformat()
                }
            )
        except Exception as e:
            # Clean up on embedding failure
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to generate embeddings: {str(e)}"
            )
        
        # 6. Save document metadata to database
        from app.database import Document as DBDocument
        try:
            document = DBDocument(
                id=file_id,
                chat_id=chatId,
                name=file.filename,
                file_path=None,  # File deleted after processing per security requirement
                source="upload",
                content_type=file.content_type,
                size=size,
                chunks_count=num_chunks,
                uploaded_at=datetime.utcnow()
            )
            session.add(document)
            session.commit()
            logger.info(f"💾 Saved document metadata to database: {file.filename} (ID: {file_id})")
        except Exception as e:
            session.rollback()
            logger.exception("Failed to save document metadata - continuing")
            # Don't fail upload if metadata storage fails

        # 7. Record upload event in user memory
        try:
            mem0_manager.add_message(
                user_id=userId,
                message=f"Uploaded document: {file.filename}",
                role="system",
                metadata={
                    "doc_id": file_id, 
                    "chat_id": chatId, 
                    "action": "document_upload"
                }
            )
        except Exception:
            logger.exception("Failed to record upload in memory - continuing")

        # 8. Clean up temporary file (security requirement)
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception:
            logger.exception(f"Failed to delete temporary file: {file_path}")

        return {
            "success": True,
            "document": {
                "id": file_id,
                "name": file.filename,
                "size": size,
                "uploadedAt": datetime.utcnow().isoformat(),
                "contentType": file.content_type,
                "chunks": num_chunks
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document upload failed")
        raise HTTPException(
            status_code=500, 
            detail=f"Upload processing failed: {str(e)}"
        )
