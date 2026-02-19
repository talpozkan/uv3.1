from typing import Any
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, case

from app.api.deps import get_db
from app.schemas.dashboard import DashboardData, DashboardSummary, HeatmapCell, RecentActivity
from app.repositories.patient.models import ShardedPatientDemographics
from app.models.appointment import Randevu, AppointmentStatus
from fastapi_cache.decorator import cache

router = APIRouter()

from app.api import deps
from app.models.user import User

@router.get("", response_model=DashboardData)
@cache(expire=60)
async def get_dashboard_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Get aggregated dashboard data.
    """
    today = date.today()
    
    # --- 1. Date Ranges ---
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    # This Week (Monday start)
    weekday = today.weekday()
    week_start = datetime.combine(today - timedelta(days=weekday), datetime.min.time())
    
    # This Month
    month_start = datetime.combine(date(today.year, today.month, 1), datetime.min.time())
    
    # Last Month
    last_month_val = today.month - 1 if today.month > 1 else 12
    last_month_year = today.year if today.month > 1 else today.year - 1
    last_month_start = datetime.combine(date(last_month_year, last_month_val, 1), datetime.min.time())
    
    # --- 2. Consolidated Patient Queries ---
    import time
    s_p = time.time()
    stmt_patients = select(
        func.count(ShardedPatientDemographics.id).label("total"),
        func.count(case((and_(ShardedPatientDemographics.created_at >= today_start, ShardedPatientDemographics.created_at <= today_end), 1))).label("today"),
        func.count(case((ShardedPatientDemographics.created_at >= week_start, 1))).label("week"),
        func.count(case((ShardedPatientDemographics.created_at >= month_start, 1))).label("month"),
        func.count(case((and_(ShardedPatientDemographics.created_at >= last_month_start, ShardedPatientDemographics.created_at < month_start), 1))).label("last_month")
    )
    res_p = await db.execute(stmt_patients)
    p_stats = res_p.fetchone()
    print(f"DEBUG: Patient stats query took {time.time() - s_p:.4f}s")
    
    total_patients = p_stats.total or 0
    count_this_month = p_stats.month or 0
    count_last_month = p_stats.last_month or 0
    
    growth_pct = 0.0
    trend = "neutral"
    if count_last_month > 0:
        growth_pct = ((count_this_month - count_last_month) / count_last_month) * 100
        if growth_pct > 0:
            trend = "up"
            growth_pct = round(growth_pct, 1)
        elif growth_pct < 0:
            trend = "down"
            growth_pct = round(abs(growth_pct), 1)
    elif count_this_month > 0:
        growth_pct = 100.0
        trend = "up"

    # --- 3. Occupancy & Appointment Stats ---
    s_a = time.time()
    TOTAL_SLOTS = 20
    stmt_appts = select(
        func.count(case((and_(Randevu.start >= today_start, Randevu.start <= today_end, Randevu.status != AppointmentStatus.cancelled), 1))).label("today_filled"),
        func.count(case((and_(Randevu.start >= today_start, Randevu.start <= today_end, Randevu.status != AppointmentStatus.cancelled, Randevu.type.ilike('%Muayene%')), 1))).label("today_exam"),
        func.count(case((and_(Randevu.start >= today_start, Randevu.start <= today_end, Randevu.status != AppointmentStatus.cancelled, Randevu.type.ilike('%Kontrol%')), 1))).label("today_control"),
        func.count(case((and_(Randevu.start >= today_start, Randevu.start <= today_end), 1))).label("today_total"),
        func.count(case((Randevu.start >= week_start, 1))).label("week_total"),
        func.count(case((Randevu.start >= month_start, 1))).label("month_total"),
        func.count(case((and_(Randevu.start >= last_month_start, Randevu.start < month_start), 1))).label("last_month_total")
    )
    res_a = await db.execute(stmt_appts)
    a_stats = res_a.fetchone()
    print(f"DEBUG: Appointment stats query took {time.time() - s_a:.4f}s")
    
    filled_slots = a_stats.today_filled or 0
    exam_count = a_stats.today_exam or 0
    control_count = a_stats.today_control or 0
    
    if exam_count == 0 and control_count == 0 and filled_slots > 0:
        exam_count = filled_slots
        
    occupancy_rate = round((filled_slots / TOTAL_SLOTS) * 100) if TOTAL_SLOTS > 0 else 0
    
    heatmap_data = [] # Heatmap not used in frontend

    # --- 6. Recent Activity ---
    s_r = time.time()
    from sqlalchemy.orm import selectinload
    res_recent_eager = await db.execute(
        select(Randevu)
        .options(selectinload(Randevu.hasta))
        .order_by(desc(Randevu.start))
        .limit(5)
    )
    recent_appts_eager = res_recent_eager.scalars().all()
    print(f"DEBUG: Recent activity query took {time.time() - s_r:.4f}s")
    
    recent_activity_data = [] # Define variable
    
    for appt in recent_appts_eager:
        patient_name = f"{appt.hasta.ad} {appt.hasta.soyad}" if appt.hasta else "Bilinmeyen"
        
        # Map DB status to Frontend status
        status_map = {
            'scheduled': 'waiting',
            'completed': 'completed',
            'cancelled': 'cancelled'
        }
        fe_status = status_map.get(appt.status, 'waiting')
        if appt.start and datetime.now(appt.start.tzinfo) > appt.start and appt.status == 'scheduled':
             fe_status = 'in-progress' 
        
        recent_activity_data.append(RecentActivity(
            id=str(appt.id),
            patientName=patient_name,
            protocolNo=appt.hasta.protokol_no if appt.hasta else str(appt.hasta_id), 
            procedure=appt.type or "Genel Muayene",
            doctor="Dr. Alp", 
            time=appt.start.strftime("%H:%M") if appt.start else "--:--",
            status=fe_status,
            patientId=str(appt.hasta_id) if appt.hasta_id else None
        ))

    return DashboardData(
        summary=DashboardSummary(
            totalPatients={
                 "value": total_patients,
                 "growth": growth_pct,
                 "trend": trend
            },
            occupancy={
                "rate": occupancy_rate,
                "filled": filled_slots,
                "total": TOTAL_SLOTS,
                "breakdown": {"examination": exam_count, "control": control_count}
            },
            pendingLabs={
                "count": 0,
                "urgent": 0
            },
            statistics={
                "today_new_patients": p_stats.today or 0,
                "today_appointments": a_stats.today_total or 0,
                "week_new_patients": p_stats.week or 0,
                "week_appointments": a_stats.week_total or 0,
                "month_new_patients": p_stats.month or 0,
                "month_appointments": a_stats.month_total or 0,
                "last_month_new_patients": p_stats.last_month or 0,
                "last_month_appointments": a_stats.last_month_total or 0
            }
        ),
        heatmap=heatmap_data,
        recentActivity=recent_activity_data
    )
