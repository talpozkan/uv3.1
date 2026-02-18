from typing import Any, List, Optional
from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from app.core.limiter import limiter
from app.core.config import settings

from app.api import deps
from app.services.auth_service import AuthService
from app.repositories.user_repository import UserRepository
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.services.audit_service import AuditService
from app.services.email_service import send_password_reset_email, send_username_reminder

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from app.schemas.user import UserCreate, UserUpdate, User as UserSchema

# Redefine UserResponse to include role if needed, or use UserSchema
class UserResponse(UserSchema):
    role: Optional[str] = None
    
    class Config:
        from_attributes = True


@router.post("/login", response_model=dict)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)
    try:
        # Note: OAuth2PasswordRequestForm uses 'username' field, but we treat it as email
        email = form_data.username  # This is actually the email
        result = await auth_service.authenticate_user(email, form_data.password)
        
        # Audit Log: Login Success
        user_result = await db.execute(select(User).filter(User.email == email))
        user = user_result.scalars().first()
        if user:
            await AuditService.log(
                db=db,
                action="USER_LOGIN",
                user_id=user.id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                details={"email": email}
            )

        return result
    except HTTPException as e:
        # Audit Log: Login Failed (Generic)
        await AuditService.log(
            db=db,
            action="USER_LOGIN_FAILED",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"email": form_data.username, "error": e.detail}
        )
        raise e
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(error_msg)
        with open("backend_error.log", "a") as f:
            f.write(f"\n[{datetime.now()}] Login Error:\n{error_msg}\n")
        raise e


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Get current logged-in user info."""
    return current_user


class VerifyPasswordRequest(BaseModel):
    password: str


class ForgotUsernameRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/verify-password")
async def verify_password(
    request: Request,
    data: VerifyPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> dict:
    """
    Verify current user's password without generating new tokens.
    Used for sensitive operations like viewing audit logs.
    """
    if not pwd_context.verify(data.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Şifre hatalı")
    
    return {"valid": True, "is_superuser": current_user.is_superuser}


@router.post("/forgot-username")
@limiter.limit("3/minute")
async def forgot_username(
    request: Request,
    data: ForgotUsernameRequest,
    db: AsyncSession = Depends(deps.get_db)
) -> dict:
    """
    Send username reminder to email address via Brevo SMTP.
    """
    from app.services.email_service import send_username_reminder
    
    result = await db.execute(select(User).filter(User.email == data.email))
    user = result.scalars().first()
    
    if user:
        # Send actual email
        email_sent = await send_username_reminder(data.email, user.username)
        
        # Audit Log
        await AuditService.log(
            db=db,
            action="FORGOT_USERNAME_REQUEST",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"email": data.email, "found": True, "email_sent": email_sent}
        )
    else:
        # Don't reveal if email exists or not (security)
        print(f"[FORGOT-USERNAME] Email: {data.email} -> Not found")
    
    # Always return success message to prevent email enumeration
    return {"message": "Eğer bu email adresi kayıtlıysa, kullanıcı adınız gönderilecektir."}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db)
) -> dict:
    """
    Request password reset. Sends email with reset link.
    Token expires in 5 minutes.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(data.email)
    
    if user:
        # Generate secure token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Invalidate any existing tokens for this user
        existing_tokens = await db.execute(
            select(PasswordResetToken).filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used == False
            )
        )
        for existing_token in existing_tokens.scalars().all():
            existing_token.used = True
        
        # Create new token
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at
        )
        db.add(reset_token)
        await db.commit()
        
        # Build reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        # Send email
        email_sent = await send_password_reset_email(
            to_email=data.email,
            reset_url=reset_url,
            user_name=user.full_name or user.email
        )
        
        # Audit Log
        await AuditService.log(
            db=db,
            action="PASSWORD_RESET_REQUEST",
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"email": data.email, "email_sent": email_sent}
        )
    else:
        # Don't reveal if email exists (security)
        print(f"[FORGOT-PASSWORD] Email not found: {data.email}")
    
    # Always return success to prevent email enumeration
    return {"message": "Eğer bu email adresi kayıtlıysa, şifre sıfırlama linki gönderilecektir."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(deps.get_db)
) -> dict:
    """
    Reset password using token from email.
    """
    # Find token
    result = await db.execute(
        select(PasswordResetToken).filter(
            PasswordResetToken.token == data.token,
            PasswordResetToken.used == False
        )
    )
    reset_token = result.scalars().first()
    
    if not reset_token:
        raise HTTPException(status_code=400, detail="Geçersiz veya kullanılmış token.")
    
    # Check expiration
    if datetime.utcnow() > reset_token.expires_at:
        reset_token.used = True
        await db.commit()
        raise HTTPException(status_code=400, detail="Token süresi dolmuş. Lütfen yeni bir şifre sıfırlama talebi oluşturun.")
    
    # Get user
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(reset_token.user_id)
    
    if not user:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı.")
    
    # Validate password strength
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır.")
    
    # Update password
    hashed_password = pwd_context.hash(data.new_password)
    await user_repo.update_password(user, hashed_password)
    
    # Mark token as used
    reset_token.used = True
    await db.commit()
    
    # Audit Log
    await AuditService.log(
        db=db,
        action="PASSWORD_RESET_COMPLETE",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"email": user.email}
    )
    
    return {"message": "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."}


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """List all users (requires authentication)."""
    # Optional: Only admins can list all users? 
    # For now keep it as is, but maybe restrict to admins later.
    # Filter hidden users
    result = await db.execute(select(User).filter(User.is_hidden == False).order_by(User.id))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Create a new user (requires authentication). Only superusers can create users."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Kullanıcı oluşturma yetkiniz yok.")
        
    # Check if username exists
    result = await db.execute(select(User).filter(User.username == user_in.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten mevcut.")
    
    # Check if email exists (if provided)
    if user_in.email:
        result = await db.execute(select(User).filter(User.email == user_in.email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Bu email zaten kullanılıyor.")
    
    # Create user
    hashed_password = pwd_context.hash(user_in.password)
    # Note: User schema has is_active and is_superuser
    new_user = User(
        username=user_in.email, # Enforce email as username
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        email=user_in.email,
        # role is not in User model's __init__? Let's check the model.
        is_active=user_in.is_active if user_in.is_active is not None else True,
        is_superuser=user_in.is_superuser
    )
    # If the User model has a role field:
    if hasattr(User, 'role'):
        setattr(new_user, 'role', getattr(user_in, 'role', 'DOCTOR'))

    db.add(new_user)
    await db.commit()
    await db.commit()
    await db.refresh(new_user)
    
    # Audit Log
    await AuditService.log(
        db=db,
        action="USER_CREATE",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(new_user.id),
        details={"username": new_user.username, "email": new_user.email, "role": getattr(new_user, 'role', 'DOCTOR')}
    )
    
    return new_user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Delete a user (requires superuser authentication)."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Kullanıcı silme yetkiniz yok.")

    # Check if user exists
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz.")
    
    await db.delete(user)
    
    # Audit Log
    await AuditService.log(
        db=db,
        action="USER_DELETE",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"deleted_username": user.username}
    )

    await db.commit()
    return {"message": "Kullanıcı silindi."}


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Update a user (requires superuser authentication)."""
    if not current_user.is_superuser and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Kullanıcı güncelleme yetkiniz yok.")

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    # Update fields
    if user_in.username:
        user.username = user_in.username
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.email is not None:
        user.email = user_in.email
        user.username = user_in.email # Keep identity synced
    if user_in.password:
        user.hashed_password = pwd_context.hash(user_in.password)
    
    # Only superusers can change role, is_active, is_superuser
    if current_user.is_superuser:
        if user_in.is_active is not None:
            user.is_active = user_in.is_active
        if user_in.is_superuser is not None:
            user.is_superuser = user_in.is_superuser
        # if role exists
        if hasattr(User, 'role') and hasattr(user_in, 'role') and getattr(user_in, 'role'):
            setattr(user, 'role', getattr(user_in, 'role'))
    
    await db.commit()
    await db.commit()
    await db.refresh(user)

    # Audit Log
    await AuditService.log(
        db=db,
        action="USER_UPDATE",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username}
    )

    return user
