# app/routes/users.py
"""
User management endpoints.
Handles user creation and retrieval for the application.
"""
from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.database import User, UserCreate, UserResponse, UserSettings, SettingsUpdate
from app.routes.dependencies import DBSession
from app.config import logger, DEFAULT_SETTINGS
from datetime import datetime, timezone

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/create", response_model=UserResponse)
async def create_user(user_data: UserCreate, session: DBSession):
    """Create a new user or return existing user if username already exists."""
    try:
        # Check if user already exists
        existing_user = session.exec(
            select(User).where(User.username == user_data.username)
        ).first()
        
        if existing_user:
            logger.info(f"User already exists: {user_data.username} (ID: {existing_user.id})")
            return UserResponse(
                id=existing_user.id,
                username=existing_user.username,
                email=existing_user.email,
                created_at=existing_user.created_at
            )
        
        # Create new user
        user = User(
            username=user_data.username,
            email=user_data.email
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # Create default settings for user
        default_settings = UserSettings(user_id=user.id)
        session.add(default_settings)
        session.commit()
        
        logger.info(f"Created new user: {user.username} (ID: {user.id})")
        
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    except Exception as e:
        session.rollback()
        logger.exception("Failed to create user")
        raise HTTPException(status_code=500, detail=f"User creation failed: {str(e)}")


@router.get("/{username}", response_model=UserResponse)
async def get_user_by_username(username: str, session: DBSession):
    """Get user information by username."""
    try:
        user = session.exec(
            select(User).where(User.username == username)
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User '{username}' not found")
        
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get user")
        raise HTTPException(status_code=500, detail=f"User retrieval failed: {str(e)}")


@router.get("/id/{user_id}", response_model=UserResponse)
async def get_user_by_id(user_id: str, session: DBSession):
    """Get user information by ID."""
    try:
        user = session.get(User, user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found")
        
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get user")
        raise HTTPException(status_code=500, detail=f"User retrieval failed: {str(e)}")


@router.get("/{user_id}/settings", response_model=UserSettings)
async def get_user_settings(user_id: str, session: DBSession):
    """Get user settings by user ID."""
    try:
        # Query UserSettings by user_id
        user_settings = session.exec(
            select(UserSettings).where(UserSettings.user_id == user_id)
        ).first()
        
        if not user_settings:
            # Verify user exists
            user = session.get(User, user_id)
            if not user:
                raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found")
            
            # Create default settings if missing (safety fallback)
            logger.warning(f"UserSettings missing for user {user_id}, creating defaults")
            user_settings = UserSettings(
                user_id=user_id,
                temperature=DEFAULT_SETTINGS["temperature"],
                max_tokens=DEFAULT_SETTINGS["max_tokens"],
                top_p=DEFAULT_SETTINGS["top_p"],
                top_k=DEFAULT_SETTINGS["top_k"],
                system_prompt=DEFAULT_SETTINGS["system_prompt"],
                use_memory=DEFAULT_SETTINGS["use_memory"]
            )
            session.add(user_settings)
            session.commit()
            session.refresh(user_settings)
        
        return user_settings
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get user settings")
        raise HTTPException(status_code=500, detail=f"Settings retrieval failed: {str(e)}")


@router.put("/{user_id}/settings", response_model=UserSettings)
async def update_user_settings(user_id: str, settings_update: SettingsUpdate, session: DBSession):
    """Update user settings by user ID."""
    try:
        # Query existing settings
        user_settings = session.exec(
            select(UserSettings).where(UserSettings.user_id == user_id)
        ).first()
        
        if not user_settings:
            raise HTTPException(status_code=404, detail=f"Settings not found for user '{user_id}'")
        
        # Update only provided fields (partial update)
        update_data = settings_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user_settings, key, value)
        
        # Update timestamp
        user_settings.updated_at = datetime.now(timezone.utc)
        
        session.add(user_settings)
        session.commit()
        session.refresh(user_settings)
        
        logger.info(f"Updated settings for user {user_id}: {list(update_data.keys())}")
        return user_settings
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception("Failed to update user settings")
        raise HTTPException(status_code=500, detail=f"Settings update failed: {str(e)}")
