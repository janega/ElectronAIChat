# app/routes/documents.py
"""
Document upload and RAG (Retrieval-Augmented Generation) endpoints.
Handles file uploads, text extraction (with OCR/JSON support), embedding generation, and vector storage.
"""
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlmodel import select
from fastapi.concurrency import run_in_threadpool
from langchain_core.documents import Document as LangChainDocument
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
            user = session.exec(select(User).where(User.username == userId)).first()
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
                    "uploaded_at": datetime.now(timezone.utc).isoformat()
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
                uploaded_at=datetime.now(timezone.utc)
            )
            session.add(document)
            session.commit()
            logger.info(f"Saved document metadata to database: {file.filename} (ID: {file_id})")
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
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
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


@router.post("/upload/stream")
async def upload_document_stream(
    file: UploadFile = File(...),
    chatId: str = Form(...),
    userId: str = Form(...),
    langchain_manager: LangChainManager = None,
    mem0_manager: Mem0Manager = None,
    session: DBSession = None
):
    """
    Upload and process documents with real-time progress updates via Server-Sent Events (SSE).
    
    Streaming Progress Stages:
    1. uploading (0%) - File upload initiated
    2. uploaded (20%) - File received and saved
    3. extracting (20%) - Text extraction started (PDF OCR, JSON parsing, etc.)
    4. extracted (40%) - Text extraction complete
    5. chunking (40%) - Text splitting into chunks
    6. chunking_complete (50%) - Chunking done, ready for embedding
    7. embedding (50-95%) - Generating embeddings (progressive updates per batch)
    8. ready (100%) - Document ready for RAG queries
    
    Returns SSE stream with JSON events:
    - data: {"stage": "uploading", "progress": 0}
    - data: {"stage": "embedding", "progress": 75, "current_chunk": 75, "total_chunks": 100}
    - data: {"stage": "ready", "progress": 100, "document": {...}}
    - data: {"stage": "error", "error": "Error message"}
    
    Args:
        file: Uploaded file (PDF, TXT, JSON, MD, etc.)
        chatId: Chat session to associate document with
        userId: User uploading the document
    
    Returns:
        StreamingResponse with text/event-stream content
    """
    
    async def generate_progress():
        file_path = None
        try:
            # Stage 1: Upload initiated
            yield f"data: {json.dumps({'stage': 'uploading', 'progress': 0})}\n\n"
            
            # Read and validate file size
            content = await file.read()
            size = len(content)
            
            if size > MAX_UPLOAD_SIZE:
                yield f"data: {json.dumps({'stage': 'error', 'error': f'File too large. Maximum: {MAX_UPLOAD_SIZE} bytes'})}\n\n"
                return
            
            # Save file temporarily
            file_id = str(uuid.uuid4())
            suffix = Path(file.filename).suffix
            file_path = UPLOAD_DIR / f"{file_id}{suffix}"
            file_path.write_bytes(content)
            
            # Stage 2: Upload complete
            yield f"data: {json.dumps({'stage': 'uploaded', 'progress': 20})}\n\n"
            
            # Stage 3: Text extraction
            yield f"data: {json.dumps({'stage': 'extracting', 'progress': 20})}\n\n"
            
            try:
                text_content = extract_text_from_file(file_path, file.content_type)
            except Exception as e:
                logger.exception("Text extraction failed")
                if file_path and file_path.exists():
                    file_path.unlink()
                yield f"data: {json.dumps({'stage': 'error', 'error': f'Text extraction failed: {str(e)}'})}\n\n"
                return
            
            # Stage 4: Extraction complete
            yield f"data: {json.dumps({'stage': 'extracted', 'progress': 40})}\n\n"
            
            # Verify/create chat and user
            from app.database import Chat, User
            chat = session.get(Chat, chatId)
            if not chat:
                logger.info(f"Chat '{chatId}' not found, creating automatically")
                user = session.exec(select(User).where(User.username == userId)).first()
                if not user:
                    user = User(id=userId, username=userId)
                    session.add(user)
                    session.commit()
                    logger.info(f"Created user: {userId}")
                
                chat = Chat(
                    id=chatId,
                    user_id=user.id,
                    title=f"Document Upload - {file.filename}",
                    search_mode="embeddings"
                )
                session.add(chat)
                session.commit()
                logger.info(f"Created chat: {chatId}")
            
            # Stage 5: Chunking
            yield f"data: {json.dumps({'stage': 'chunking', 'progress': 40})}\n\n"
            
            # Split text into chunks
            chunks = langchain_manager.text_splitter.split_text(text_content)
            total_chunks = len(chunks)
            
            # Stage 6: Chunking complete
            yield f"data: {json.dumps({'stage': 'chunking_complete', 'progress': 50, 'total_chunks': total_chunks})}\n\n"
            
            # Stage 7: Embedding with progress updates
            yield f"data: {json.dumps({'stage': 'embedding', 'progress': 50, 'current_chunk': 0, 'total_chunks': total_chunks})}\n\n"
            
            # Create vectorstore
            vectorstore = await run_in_threadpool(langchain_manager.create_vectorstore, chatId)
            
            # Process chunks in batches to provide progress updates
            batch_size = 10  # Embed 10 chunks at a time
            for i in range(0, total_chunks, batch_size):
                batch = chunks[i:i+batch_size]
                documents = [
                    LangChainDocument(
                        page_content=chunk,
                        metadata={
                            'doc_id': file_id,
                            'filename': file.filename,
                            'chunk_index': i+j,
                            'uploaded_at': datetime.now(timezone.utc).isoformat()
                        }
                    )
                    for j, chunk in enumerate(batch)
                ]
                
                # Add batch to vectorstore
                await run_in_threadpool(vectorstore.add_documents, documents)
                
                # Calculate progress (50% to 95% range for embedding)
                current_chunk = min(i + len(batch), total_chunks)
                progress = 50 + int((current_chunk / total_chunks) * 45)
                
                yield f"data: {json.dumps({'stage': 'embedding', 'progress': progress, 'current_chunk': current_chunk, 'total_chunks': total_chunks})}\n\n"
            
            # Persist vectorstore
            await run_in_threadpool(vectorstore.persist)
            
            # Save document metadata to database
            from app.database import Document as DBDocument
            try:
                document = DBDocument(
                    id=file_id,
                    chat_id=chatId,
                    name=file.filename,
                    file_path=None,  # Deleted after processing
                    source="upload",
                    content_type=file.content_type,
                    size=size,
                    chunks_count=total_chunks,
                    uploaded_at=datetime.now(timezone.utc)
                )
                session.add(document)
                session.commit()
                logger.info(f"Saved document metadata: {file.filename} (ID: {file_id})")
            except Exception as e:
                session.rollback()
                logger.exception("Failed to save document metadata - continuing")
            
            # Record upload event in user memory
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
            
            # Clean up temporary file
            if file_path and file_path.exists():
                file_path.unlink()
                logger.info(f"Cleaned up temporary file: {file_path}")
            
            # Stage 8: Ready
            yield f"data: {json.dumps({'stage': 'ready', 'progress': 100, 'document': {'id': file_id, 'name': file.filename, 'size': size, 'uploadedAt': datetime.now(timezone.utc).isoformat(), 'contentType': file.content_type, 'chunks': total_chunks}})}\n\n"
            
        except HTTPException as e:
            logger.exception("Upload streaming failed with HTTPException")
            yield f"data: {json.dumps({'stage': 'error', 'error': e.detail})}\n\n"
        except Exception as e:
            logger.exception("Upload streaming failed")
            yield f"data: {json.dumps({'stage': 'error', 'error': str(e)})}\n\n"
            # Clean up on error
            if file_path and file_path.exists():
                try:
                    file_path.unlink()
                except Exception:
                    logger.exception("Failed to cleanup file after error")
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
