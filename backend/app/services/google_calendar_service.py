"""
Google Calendar Service
=======================
Handles Google Calendar API operations including:
- OAuth token management
- Calendar creation/lookup
- Event sync (create, update, delete)
"""

from datetime import datetime, timezone
from typing import Optional, Tuple
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user_oauth import UserOAuth
from app.models.appointment import Randevu
from app.core.config import settings


class GoogleCalendarService:
    """Service for Google Calendar sync operations."""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar']
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_credentials(self, user_id: int) -> Optional[Credentials]:
        """
        Get Google OAuth credentials for a user.
        Refreshes token if expired.
        """
        result = await self.db.execute(
            select(UserOAuth).filter(
                UserOAuth.user_id == user_id,
                UserOAuth.provider == "google"
            )
        )
        db_oauth = result.scalars().first()
        
        if not db_oauth:
            return None
        
        credentials = Credentials(
            token=db_oauth.access_token,
            refresh_token=db_oauth.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=db_oauth.scopes.split(",") if db_oauth.scopes else self.SCOPES
        )
        
        # Refresh if expired
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Update tokens in DB
                db_oauth.access_token = credentials.token
                db_oauth.token_expiry = credentials.expiry
                await self.db.commit()
            except Exception as e:
                print(f"Token refresh failed: {e}")
                return None
        
        return credentials
    
    def find_or_create_calendar(self, credentials: Credentials, calendar_name: str = None) -> str:
        """
        Find or createُ the UroLOG calendar.
        Returns the calendar ID.
        """
        if not calendar_name:
            calendar_name = settings.GOOGLE_CALENDAR_NAME
            
        service = build('calendar', 'v3', credentials=credentials)
        
        # List existing calendars
        calendar_list = service.calendarList().list().execute()
        
        for calendar in calendar_list.get('items', []):
            if calendar.get('summary') == calendar_name:
                return calendar['id']
        
        # Create new calendar if not found
        new_calendar = {
            'summary': calendar_name,
            'description': 'UroLog EMR Randevu Takvimi',
            'timeZone': 'Europe/Istanbul'
        }
        
        created = service.calendars().insert(body=new_calendar).execute()
        return created['id']
    
    async def sync_appointment(self, appointment: Randevu, user_id: int) -> Tuple[bool, str]:
        """
        Sync an appointment to Google Calendar.
        Creates new event or updates existing one.
        Returns (success, message).
        """
        credentials = await self.get_credentials(user_id)
        if not credentials:
            return False, "Google hesabı bağlı değil"
        
        try:
            service = build('calendar', 'v3', credentials=credentials)
            calendar_id = self.find_or_create_calendar(credentials)
            
            # Build event body
            hasta_adi = ""
            if appointment.hasta:
                hasta_adi = f"{appointment.hasta.ad} {appointment.hasta.soyad}"
            
            event = {
                'summary': f"{hasta_adi} - {appointment.title}" if hasta_adi else appointment.title,
                'description': self._build_description(appointment),
                'start': {
                    'dateTime': appointment.start.isoformat(),
                    'timeZone': 'Europe/Istanbul',
                },
                'end': {
                    'dateTime': appointment.end.isoformat(),
                    'timeZone': 'Europe/Istanbul',
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'popup', 'minutes': 30},
                    ],
                },
            }
            
            if appointment.google_event_id:
                # Update existing event
                updated_event = service.events().update(
                    calendarId=calendar_id,
                    eventId=appointment.google_event_id,
                    body=event
                ).execute()
                event_id = updated_event['id']
                message = "Randevu Google Calendar'da güncellendi"
            else:
                # Create new event
                created_event = service.events().insert(
                    calendarId=calendar_id,
                    body=event
                ).execute()
                event_id = created_event['id']
                message = "Randevu Google Calendar'a eklendi"
            
            # Update appointment with sync info
            appointment.google_event_id = event_id
            appointment.google_calendar_id = calendar_id
            appointment.last_synced_at = datetime.now(timezone.utc)
            await self.db.commit()
            
            return True, message
            
        except Exception as e:
            return False, f"Senkronizasyon hatası: {str(e)}"
    
    async def delete_from_calendar(self, appointment: Randevu, user_id: int) -> Tuple[bool, str]:
        """
        Delete an event from Google Calendar.
        """
        if not appointment.google_event_id:
            return True, "Etkinlik zaten takvimde yok"
        
        credentials = await self.get_credentials(user_id)
        if not credentials:
            return False, "Google hesabı bağlı değil"
        
        try:
            service = build('calendar', 'v3', credentials=credentials)
            calendar_id = appointment.google_calendar_id or self.find_or_create_calendar(credentials)
            
            service.events().delete(
                calendarId=calendar_id,
                eventId=appointment.google_event_id
            ).execute()
            
            # Clear sync info
            appointment.google_event_id = None
            appointment.google_calendar_id = None
            appointment.last_synced_at = None
            await self.db.commit()
            
            return True, "Etkinlik Google Calendar'dan silindi"
            
        except Exception as e:
            return False, f"Silme hatası: {str(e)}"
    
    def _build_description(self, appointment: Randevu) -> str:
        """Build event description from appointment details."""
        lines = []
        
        if appointment.type:
            lines.append(f"Randevu Tipi: {appointment.type}")
        if appointment.doctor_name:
            lines.append(f"Doktor: {appointment.doctor_name}")
        if appointment.notes:
            lines.append(f"Notlar: {appointment.notes}")
        if appointment.hasta:
            lines.append(f"Hasta ID: {appointment.hasta.protokol_no or appointment.hasta_id}")
        
        lines.append("")
        lines.append("--- UroLog EMR ---")
        
        return "\n".join(lines)
