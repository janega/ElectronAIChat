"""
Admin routes for application management (reset, data cleanup, etc.)
"""
from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select, delete
from app.config import DATABASE_PATH, CHROMA_DIR, LOGS_DIR, BASE_DIR, UPLOAD_DIR, logger
from app.db_manager import create_db_and_tables, engine
from app.database import User, Chat, Message, Document, UserSettings
import shutil
import os
import sys

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.post("/reset")
async def reset_application_data():
    """
    DANGER: Delete all user data (database, vector storage, memory, logs).
    Use only for user-initiated full reset or development/testing.
    
    Returns:
        dict: Summary of deleted data locations
    """
    try:
        logger.warning("=" * 80)
        logger.warning("ADMIN RESET: Deleting all application data!")
        logger.warning("=" * 80)
        
        deleted_items = []
        
        # 1. Delete all data from database tables (safer than deleting locked file)
        if DATABASE_PATH.exists():
            with Session(engine) as session:
                # Delete in order to respect foreign key constraints
                # Messages first (references Chats)
                result = session.exec(delete(Message))
                logger.info(f"Deleted {result.rowcount} messages")
                
                # Documents (references Chats)
                result = session.exec(delete(Document))
                logger.info(f"Deleted {result.rowcount} documents")
                
                # Chats (references Users)
                result = session.exec(delete(Chat))
                logger.info(f"Deleted {result.rowcount} chats")
                
                # UserSettings (references Users)
                result = session.exec(delete(UserSettings))
                logger.info(f"Deleted {result.rowcount} user settings")
                
                # Users last
                result = session.exec(delete(User))
                logger.info(f"Deleted {result.rowcount} users")
                
                session.commit()
                logger.info("All database tables cleared")
            
            deleted_items.append(f"{DATABASE_PATH} (tables cleared)")
        
        # 2. Delete all ChromaDB collections (documents + mem0)
        if CHROMA_DIR.exists():
            # Try to delete, but handle locked files gracefully
            def remove_readonly(func, path, excinfo):
                """Error handler for Windows readonly/locked files"""
                import stat
                try:
                    os.chmod(path, stat.S_IWRITE)
                    func(path)
                except Exception as e:
                    logger.warning(f"Could not delete {path}: {e}")
            
            try:
                shutil.rmtree(CHROMA_DIR, onerror=remove_readonly)
                logger.info(f"Deleted vector storage: {CHROMA_DIR}")
                deleted_items.append(str(CHROMA_DIR))
            except Exception as e:
                logger.warning(f"Could not fully delete ChromaDB (some files locked): {e}")
                # Try to delete individual collection directories
                deleted_count = 0
                for item in CHROMA_DIR.iterdir():
                    try:
                        if item.is_dir():
                            shutil.rmtree(item, onerror=remove_readonly)
                            deleted_count += 1
                    except Exception:
                        pass
                if deleted_count > 0:
                    deleted_items.append(f"{CHROMA_DIR} ({deleted_count} collections)")
            
            # Recreate empty directory
            CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        
        # 3. Delete uploads directory
        if UPLOAD_DIR.exists():
            try:
                shutil.rmtree(UPLOAD_DIR)
                logger.info(f"Deleted uploads: {UPLOAD_DIR}")
                deleted_items.append(str(UPLOAD_DIR))
            except Exception as e:
                logger.warning(f"Could not delete uploads directory: {e}")
            
            # Recreate empty directory
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # 4. Clear logs (keep directory, delete files)
        if LOGS_DIR.exists():
            for log_file in LOGS_DIR.glob("*.log*"):
                try:
                    log_file.unlink()
                    logger.info(f"Deleted log file: {log_file}")
                except PermissionError:
                    logger.warning(f"Could not delete active log file: {log_file}")
            deleted_items.append(f"{LOGS_DIR}/*.log")
        
        logger.warning("=" * 80)
        logger.warning("ADMIN RESET: Complete! All data deleted.")
        logger.warning("=" * 80)
        
        return {
            "success": True,
            "message": "All application data deleted. Database tables cleared, directories recreated.",
            "deleted": deleted_items,
            "cleared": "All database tables",
            "recreated": [
                str(CHROMA_DIR),
                str(UPLOAD_DIR)
            ]
        }
        
    except Exception as e:
        logger.exception("Failed to reset application data")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset failed: {str(e)}"
        )

@router.get("/data-locations")
async def get_data_locations():
    """
    Get paths to all application data directories.
    Useful for users who want to manually delete data.
    """
    return {
        "base_directory": str(BASE_DIR),
        "database": str(DATABASE_PATH),
        "vector_storage": str(CHROMA_DIR),
        "logs": str(LOGS_DIR),
        "uploads": str(UPLOAD_DIR),
        "platform": {
            "name": os.name,
            "system": sys.platform
        }
    }

@router.get("/has-data")
async def check_has_data():
    """
    Check if application has any user data.
    Returns true if database exists and has users/chats.
    """
    try:
        if not DATABASE_PATH.exists():
            return {"has_data": False}
        
        # Check if database has any users
        with Session(engine) as session:
            user = session.exec(select(User)).first()
            return {"has_data": user is not None}
            
    except Exception as e:
        logger.error(f"Failed to check data existence: {e}")
        return {"has_data": False}
