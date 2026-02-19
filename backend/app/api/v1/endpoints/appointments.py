from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.api import deps
from app.repositories.appointment_repository import AppointmentRepository
from app.schemas.appointment import RandevuCreate, RandevuUpdate, RandevuResponse

router = APIRouter()

@router.get("/", response_model=List[RandevuResponse])
async def get_appointments(
    start: Optional[str] = Query(None, description="Start datetime ISO string"),
    end: Optional[str] = Query(None, description="End datetime ISO string"),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get all appointments, optionally filtered by date range."""
    repo = AppointmentRepository(db)
    
    start_dt = None
    end_dt = None
    
    if start:
        try:
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
        except:
            pass
    
    if end:
        try:
            end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
        except:
            pass
    
    appointments = await repo.get_all(start=start_dt, end=end_dt)
    return appointments

@router.get("/{randevu_id}", response_model=RandevuResponse)
async def get_appointment(
    randevu_id: int,
    db: AsyncSession = Depends(deps.get_db)
):
    """Get a specific appointment by ID."""
    repo = AppointmentRepository(db)
    appointment = await repo.get_by_id(randevu_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    return appointment

@router.get("/patient/{hasta_id}", response_model=List[RandevuResponse])
async def get_patient_appointments(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Get all appointments for a specific patient."""
    repo = AppointmentRepository(db)
    appointments = await repo.get_by_patient(hasta_id)
    return appointments

@router.post("/", response_model=RandevuResponse)
async def create_appointment(
    randevu_in: RandevuCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Create a new appointment."""
    repo = AppointmentRepository(db)
    appointment = await repo.create(randevu_in)
    return appointment

@router.put("/{randevu_id}", response_model=RandevuResponse)
async def update_appointment(
    randevu_id: int,
    randevu_in: RandevuUpdate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Update an existing appointment."""
    repo = AppointmentRepository(db)
    appointment = await repo.update(randevu_id, randevu_in)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    return appointment

@router.delete("/{randevu_id}")
async def delete_appointment(
    randevu_id: int,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db)
):
    """Delete an appointment."""
    repo = AppointmentRepository(db)
    success = await repo.delete(randevu_id, reason=reason)
    if not success:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    return {"message": "Randevu başarıyla silindi"}


# === CALENDAR INTEGRATION ENDPOINTS ===

@router.post("/{randevu_id}/sync")
async def sync_to_google(
    randevu_id: int,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Sync an appointment to Google Calendar.
    Creates a new event or updates existing one.
    """
    from app.services.google_calendar_service import GoogleCalendarService
    
    repo = AppointmentRepository(db)
    appointment = await repo.get_by_id(randevu_id)
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    # TODO: Get actual user_id from current_user
    user_id = 1
    
    service = GoogleCalendarService(db)
    success, message = await service.sync_appointment(appointment, user_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message, "google_event_id": appointment.google_event_id}


@router.delete("/{randevu_id}/sync")
async def remove_from_google(
    randevu_id: int,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Remove an appointment from Google Calendar.
    """
    from app.services.google_calendar_service import GoogleCalendarService
    
    repo = AppointmentRepository(db)
    appointment = await repo.get_by_id(randevu_id)
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    user_id = 1
    
    service = GoogleCalendarService(db)
    success, message = await service.delete_from_calendar(appointment, user_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.get("/{randevu_id}/ics")
async def download_ics(
    randevu_id: int,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Download iCal (.ics) file for an appointment.
    Can be imported into Apple Calendar, Outlook, etc.
    """
    from fastapi.responses import Response
    from app.utils.calendar_utils import generate_ics_content
    import unicodedata
    import re
    
    repo = AppointmentRepository(db)
    appointment = await repo.get_by_id(randevu_id)
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    # Generate iCal content
    ics_content = generate_ics_content(appointment)
    
    # Build filename - sanitize for ASCII compatibility
    def sanitize_filename(name: str) -> str:
        # Replace Turkish characters with ASCII equivalents
        replacements = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        for tr, en in replacements.items():
            name = name.replace(tr, en)
        # Remove any remaining non-ASCII characters
        name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
        # Replace spaces and special chars with underscore
        name = re.sub(r'[^\w\-.]', '_', name)
        return name
    
    hasta_adi = ""
    if appointment.hasta:
        hasta_adi = f"{appointment.hasta.ad}_{appointment.hasta.soyad}_"
    date_str = appointment.start.strftime("%Y%m%d") if appointment.start else "randevu"
    filename = sanitize_filename(f"{hasta_adi}{date_str}.ics")
    
    return Response(
        content=ics_content.encode('utf-8'),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
