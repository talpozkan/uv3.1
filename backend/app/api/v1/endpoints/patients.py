from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.limiter import limiter
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.schemas.patient import PatientResponse, PatientCreate, PatientUpdate
from app.schemas.patient.legacy import PatientLegacyResponse
from app.schemas.patient.demographics import PatientDemographicsCreate, PatientDemographicsUpdate
from app.services.audit_service import AuditService
from app.models.user import User
from app.controllers.legacy_adapters.patient_controller import PatientController
from app.core.user_context import UserContext

router = APIRouter()

@router.get("")
@limiter.limit("100/minute")
@cache(expire=60)
async def read_patients(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    ad: str = None,
    soyad: str = None
) -> Any:
    """
    Retrieve patients.
    """
    try:
        context = UserContext(
            user_id=getattr(request.state, "user_id", None),
            username=getattr(request.state, "username", None),
            ip_address=request.client.host
        )
        controller = PatientController(db, context)
        return await controller.get_patients(skip=skip, limit=limit, search=search, ad=ad, soyad=soyad)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=PatientResponse)
async def create_patient(
    *,
    db: AsyncSession = Depends(deps.get_db),
    patient_in: PatientCreate,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Create new patient.
    """
    context = UserContext(
        user_id=current_user.id,
        username=current_user.username
    )
    
    controller = PatientController(db, context)
    
    # Map API schema to Controller schema
    patient_data = patient_in.model_dump()
    controller_in = PatientDemographicsCreate(**patient_data)
    
    patient = await controller.create_patient(controller_in)
    
    # Audit Log
    # Legacy service still used alongside new sharded audit for safety
    # Convert legacy response to dict for legacy audit service compatibility 
    patient_dict = patient.model_dump()
    
    # Audit Log (Legacy service still used alongside new sharded audit for safety)
    # Audit Log (Legacy service still used alongside new sharded audit for safety)
    try:
        await AuditService.log(
            db=db,
            action="PATIENT_CREATE",
            user_id=current_user.id,
            resource_type="patient",
            resource_id=str(patient_dict['id']),
            details={"status": "created"}
        )
    except Exception as e:
        import traceback
        print(f"AUDIT LOG ERROR: {e}")
        traceback.print_exc()
        # Non-blocking failure
        pass
    
    return patient

@router.get("/references")
async def get_references(
    db: AsyncSession = Depends(deps.get_db)
) -> List[str]:
    """
    Get all unique references.
    """
    controller = PatientController(db)
    return await controller.get_unique_references()

@router.get("/{id}/timeline")
async def get_patient_timeline(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: UUID
) -> List[dict]:
    """
    Get patient timeline.
    """
    controller = PatientController(db)
    return await controller.get_timeline(id)

@router.get("/{id}", response_model=PatientLegacyResponse)
async def read_patient(
    *,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    id: UUID
) -> Any:
    """
    Get patient by ID.
    """
    try:
        # Inject context for auditing
        context = UserContext(
            user_id=getattr(request.state, "user_id", None),
            username=getattr(request.state, "username", None),
            ip_address=request.client.host
        )
        
        controller = PatientController(db, context)
        patient = await controller.get_patient_profile(id)
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"READ PATIENT ERROR for ID {id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/counts")
async def get_patient_counts(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: UUID
) -> Any:
    """
    Get record counts for a patient.
    """
    controller = PatientController(db)
    return await controller.get_counts(id)

@router.put("/{id}", response_model=PatientResponse)
async def update_patient(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: UUID,
    patient_in: PatientUpdate,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Update a patient.
    """
    try:
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username
        )
        
        controller = PatientController(db, context)
        
        # Map API schema to Controller schema
        update_data = patient_in.model_dump(exclude_unset=True)
        controller_in = PatientDemographicsUpdate(**update_data)
        
        updated_patient = await controller.update_patient(id, controller_in)
        
        if not updated_patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Audit Log (Non-blocking)
        try:
            updated_patient_dict = updated_patient.model_dump()
            await AuditService.log(
                db=db,
                action="PATIENT_UPDATE",
                user_id=current_user.id,
                resource_type="patient",
                resource_id=str(updated_patient_dict['id']),
                details={"updated_fields": patient_in.model_dump(exclude_unset=True)}
            )
        except Exception as audit_err:
            import traceback
            print(f"AUDIT LOG ERROR IN UPDATE: {audit_err}")
            traceback.print_exc()

        return updated_patient
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"UPDATE PATIENT API ERROR for ID {id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}")
async def delete_patient(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: UUID,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Delete a patient.
    """
    try:
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username
        )
        
        controller = PatientController(db, context)
        result = await controller.delete_patient(id)
        
        if not result:
             raise HTTPException(status_code=404, detail="Patient not found")
        
        # Audit Log (Legacy service)
        await AuditService.log(
            db=db,
            action="PATIENT_DELETE",
            user_id=current_user.id,
            resource_type="patient",
            resource_id=str(id),
            details={"patient_id": str(id)}
        )
             
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"DELETE API ERROR: {str(e)}")
        # Return 500 with detail instead of crashing
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

