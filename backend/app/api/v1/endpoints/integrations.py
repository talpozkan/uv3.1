from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import os
import json
from datetime import datetime, timedelta

from app.core.config import settings
from app.api import deps
from app.models.user_oauth import UserOAuth
from app.models.user import User
from sqlalchemy.future import select

router = APIRouter()

SCOPES = ['https://www.googleapis.com/auth/calendar.events']

@router.get("/google/auth-url")
async def get_google_auth_url(
    current_user: User = Depends(deps.get_current_user)
):
    """Google OAuth login URL'ini oluşturur."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google API ayarları eksik")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    # State parametresine user_id ve rastgele bir string ekleyerek güvenliği artırıyoruz
    state_payload = {"user_id": current_user.id, "random": os.urandom(8).hex()}
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        state=json.dumps(state_payload)
    )
    
    return {"url": authorization_url, "state": state}

@router.get("/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(deps.get_db)):
    """Google'dan dönen callback'i işler."""
    try:
        state_data = json.loads(state)
        user_id = state_data.get("user_id")
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz state parametresi")

    if not user_id:
        raise HTTPException(status_code=400, detail="State içinde kullanıcı ID bulunamadı")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    # Veritabanına kaydet/güncelle
    result = await db.execute(
        select(UserOAuth).filter(UserOAuth.user_id == user_id, UserOAuth.provider == "google")
    )
    db_oauth = result.scalars().first()
    
    expiry = datetime.utcnow() + timedelta(seconds=credentials.expiry.timestamp() - datetime.now().timestamp() if credentials.expiry else 3600)

    if db_oauth:
        db_oauth.access_token = credentials.token
        if credentials.refresh_token:
            db_oauth.refresh_token = credentials.refresh_token
        db_oauth.token_expiry = expiry
    else:
        db_oauth = UserOAuth(
            user_id=user_id,
            provider="google",
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_expiry=expiry,
            scopes=",".join(credentials.scopes)
        )
        db.add(db_oauth)
    
    await db.commit()
    
    # Frontend'e geri yönlendir
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?google_sync=success")

@router.get("/google/status")
async def get_google_status(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Bağlantı durumunu döner."""
    result = await db.execute(
        select(UserOAuth).filter(UserOAuth.user_id == current_user.id, UserOAuth.provider == "google")
    )
    db_oauth = result.scalars().first()
    
    if not db_oauth:
        return {"connected": False}
        
    return {
        "connected": True,
        "expiry": db_oauth.token_expiry,
        "is_expired": db_oauth.token_expiry < datetime.utcnow()
    }
