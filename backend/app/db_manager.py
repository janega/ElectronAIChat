# app/db_manager.py
"""
Database engine and session management.

Provides:
- SQLite engine initialization
- Session management with dependency injection
- Table creation utilities
"""
from sqlmodel import SQLModel, create_engine, Session
from typing import Generator
from app.config import DATABASE_PATH, logger


# Create SQLite engine with connection pooling
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
    echo=False  # Set to True for SQL query debugging
)


def create_db_and_tables():
    """
    Create all database tables defined in SQLModel.
    Safe to call multiple times - only creates missing tables.
    """
    try:
        SQLModel.metadata.create_all(engine)
        logger.info(f"✅ Database initialized: {DATABASE_PATH}")
    except Exception as e:
        logger.exception(f"❌ Failed to create database tables: {e}")
        raise


def get_session() -> Generator[Session, None, None]:
    """
    Database session dependency for FastAPI.
    
    Usage in routes:
        @router.get("/example")
        async def example(session: Session = Depends(get_session)):
            # Use session here
            pass
    
    Yields:
        Session: SQLModel database session
    """
    with Session(engine) as session:
        yield session


def get_db_stats(session: Session) -> dict:
    """
    Get database statistics for monitoring.
    
    Args:
        session: Active database session
        
    Returns:
        Dictionary with table counts
    """
    from app.database import User, Chat, Message, Document, UserSettings
    
    try:
        stats = {
            "users": session.query(User).count(),
            "chats": session.query(Chat).count(),
            "messages": session.query(Message).count(),
            "documents": session.query(Document).count(),
            "settings": session.query(UserSettings).count(),
        }
        return stats
    except Exception as e:
        logger.exception("Failed to get database stats")
        return {"error": str(e)}
