from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.api import deps
from app.schemas.lab_analysis import LabTrendRequest, LabTrendResponse
from app.services.lab_analysis_service import LabAnalysisService

router = APIRouter()

@router.post("/trends", response_model=List[LabTrendResponse])
async def get_patient_lab_trends(
    request: LabTrendRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Get trend analysis for specific lab tests for a patient.
    """
    service = LabAnalysisService()
    try:
        trends = await service.get_lab_trends(db, request)
        return trends
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
