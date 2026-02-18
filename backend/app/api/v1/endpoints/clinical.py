from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from uuid import UUID
from fastapi.responses import FileResponse
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.clinical.repository import ClinicalRepository
from app.api import deps
from app.schemas.clinical import (
    MuayeneCreate, MuayeneUpdate, MuayeneResponse, 
    OperasyonCreate, OperasyonResponse, OperasyonUpdate,
    HastaNotuCreate, HastaNotuResponse, HastaNotuUpdate,
    FotografCreate, FotografResponse, FotografUpdate,
    TetkikSonucCreate, TetkikSonucResponse, TetkikSonucUpdate,
    TelefonGorusmesiCreate, TelefonGorusmesiResponse, TelefonGorusmesiUpdate,
    IstirahatRaporuCreate, IstirahatRaporuResponse, IstirahatRaporuUpdate,
    DurumBildirirRaporuCreate, DurumBildirirRaporuResponse, DurumBildirirRaporuUpdate,
    TibbiMudahaleRaporuCreate, TibbiMudahaleRaporuResponse, TibbiMudahaleRaporuUpdate,
    TrusBiyopsiCreate, TrusBiyopsiResponse, TrusBiyopsiUpdate
)
from app.services.audit_service import AuditService
from app.models.user import User

router = APIRouter()

@router.get("/version-check")
async def version_check():
    return {"version": "V2_WITH_PHOTOS", "status": "active"}

# --- MUAYENE ---
@router.get("/muayeneler/report", response_model=List[MuayeneResponse])
async def read_muayeneler_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_all_muayeneler(start_date=start_date, end_date=end_date, search=search)

@router.get("/patients/{hasta_id}/muayeneler", response_model=List[MuayeneResponse])
async def read_muayeneler(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        adapter = ClinicalLegacyAdapter(db)
        return await adapter.get_patient_muayeneler(hasta_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/muayeneler/{id}", response_model=MuayeneResponse)
async def read_muayene(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        adapter = ClinicalLegacyAdapter(db)
        muayene = await adapter.orchestrator.clinical_repo.get_examination(id)
        if not muayene:
            raise HTTPException(status_code=404, detail="Examination not found")
        return muayene
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/muayeneler", response_model=MuayeneResponse)
async def create_muayene(
    *,
    db: AsyncSession = Depends(deps.get_db),
    muayene_in: MuayeneCreate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        result = await adapter.create_muayene(muayene_in.model_dump())
        
        # Audit Log
        await AuditService.log(
            db=db,
            action="MUAYENE_CREATE",
            user_id=current_user.id,
            resource_type="muayene",
            resource_id=str(result.id),
            details={"hasta_id": str(result.hasta_id), "tarih": str(result.tarih)}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/muayeneler/{id}", response_model=MuayeneResponse)
async def update_muayene(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    muayene_in: MuayeneUpdate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        updated_muayene = await adapter.update_muayene(id, muayene_in.model_dump(exclude_unset=True))
        if not updated_muayene:
            raise HTTPException(status_code=404, detail="Examination not found")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="MUAYENE_UPDATE",
            user_id=current_user.id,
            resource_type="muayene",
            resource_id=str(updated_muayene.id),
            details={"hasta_id": str(updated_muayene.hasta_id)}
        )
        return updated_muayene
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/muayeneler/{id}")
async def delete_muayene(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        result = await adapter.delete_muayene(id)
        if not result:
            raise HTTPException(status_code=404, detail="Examination not found")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="MUAYENE_DELETE",
            user_id=current_user.id,
            resource_type="muayene",
            resource_id=str(id),
            details={}
        )
        return {"status": "success", "id": id}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- OPERASYON ---
@router.get("/operasyonlar/report", response_model=List[OperasyonResponse])
async def read_operasyonlar_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_all_operasyonlar(start_date=start_date, end_date=end_date, search=search)

@router.get("/patients/{hasta_id}/operasyonlar", response_model=List[OperasyonResponse])
async def read_operasyonlar(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        adapter = ClinicalLegacyAdapter(db)
        return await adapter.get_patient_operasyonlar(hasta_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/operasyonlar/{id}", response_model=OperasyonResponse)
async def read_operasyon(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        adapter = ClinicalLegacyAdapter(db)
        result = await adapter.orchestrator.clinical_repo.get_operation(id)
        if not result:
            raise HTTPException(status_code=404, detail="Operation not found")
        return result
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/operasyonlar", response_model=OperasyonResponse)
async def create_operasyon(
    *,
    db: AsyncSession = Depends(deps.get_db),
    operasyon_in: OperasyonCreate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        result = await adapter.create_operasyon(operasyon_in.model_dump())
        
        # Audit Log
        await AuditService.log(
            db=db,
            action="OPERASYON_CREATE",
            user_id=current_user.id,
            resource_type="operasyon",
            resource_id=str(result.id),
            details={"hasta_id": str(result.hasta_id)}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/operasyonlar/{id}", response_model=OperasyonResponse)
async def update_operasyon(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    operasyon_in: OperasyonUpdate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        result = await adapter.update_operasyon(id, operasyon_in.model_dump(exclude_unset=True))
        if not result:
            raise HTTPException(status_code=404, detail="Operation not found")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="OPERASYON_UPDATE",
            user_id=current_user.id,
            resource_type="operasyon",
            resource_id=str(result.id),
            details={"hasta_id": str(result.hasta_id)}
        )
        return result
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/operasyonlar/{id}")
async def delete_operasyon(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    try:
        from app.controllers.legacy_adapters.clinical_adapter import ClinicalLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = ClinicalLegacyAdapter(db, context)
        result = await adapter.delete_operasyon(id) # Logical delete
        if not result:
            raise HTTPException(status_code=404, detail="Operation not found")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="OPERASYON_DELETE",
            user_id=current_user.id,
            resource_type="operasyon",
            resource_id=str(id),
            details={}
        )
        return {"status": "success", "id": id}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- TAKIP ---
@router.get("/patients/{hasta_id}/takip", response_model=List[HastaNotuResponse])
async def read_takip(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_takip_by_patient(hasta_id)

@router.get("/takip/{id}")
async def read_takip_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_takip_note(id)
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up note not found")
    
    return {
        "id": result.id,
        "hasta_id": result.hasta_id,
        "tarih": result.tarih,
        "tur": result.tip,
        "durum": result.sembol,
        "notlar": result.icerik,
        "created_at": result.created_at
    }

@router.post("/takip", response_model=HastaNotuResponse)
async def create_takip(
    *,
    db: AsyncSession = Depends(deps.get_db),
    takip_in: HastaNotuCreate,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.create_takip(takip_in)

    # Audit Log
    await AuditService.log(
        db=db,
        action="TAKIP_NOTU_CREATE",
        user_id=current_user.id,
        resource_type="takip_notu",
        resource_id=str(result["id"]),
        details={"hasta_id": str(result["hasta_id"])}
    )
    
    return result

@router.put("/takip/{id}", response_model=HastaNotuResponse)
async def update_takip(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    takip_in: HastaNotuUpdate,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.update_takip(id, takip_in)
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up note not found")

    # Audit Log
    await AuditService.log(
        db=db,
        action="TAKIP_NOTU_UPDATE",
        user_id=current_user.id,
        resource_type="takip_notu",
        resource_id=str(result["id"]),
        details={"hasta_id": str(result["hasta_id"])}
    )

    return result

@router.delete("/takip/{id}")
async def delete_takip(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.delete_takip(id)
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up note not found")
    
    # Audit Log
    await AuditService.log(
        db=db,
        action="TAKIP_NOTU_DELETE",
        user_id=current_user.id,
        resource_type="takip_notu",
        resource_id=str(id),
        details={}
    )

    return {"status": "success", "id": id}

# --- FOTOĞRAF ARŞİVİ ---
@router.get("/patients/{hasta_id}/photos", response_model=List[FotografResponse])
async def read_photos(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Get all photos for a patient."""
    print(f"DEBUG_GET_PHOTOS_START: patient={hasta_id}")
    repo = ClinicalRepository(db)
    results = await repo.get_photos_by_patient(hasta_id)
    print(f"DEBUG_GET_PHOTOS_END: patient={hasta_id} count={len(results)}")
    return results

@router.post("/photos", response_model=FotografResponse)
async def create_photo(
    *,
    db: AsyncSession = Depends(deps.get_db),
    photo_in: FotografCreate
) -> Any:
    """Upload/Create new photo record."""
    print(f"DEBUG_CREATE_PHOTO: {photo_in}")
    repo = ClinicalRepository(db)
    return await repo.create_photo(photo_in)

@router.put("/photos/{id}", response_model=FotografResponse)
async def update_photo(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    photo_in: FotografUpdate
) -> Any:
    """Update photo record."""
    repo = ClinicalRepository(db)
    result = await repo.update_photo(id, photo_in)
    if not result:
        raise HTTPException(status_code=404, detail="Photo not found")
    return result

@router.get("/photos/{id}/download")
async def download_photo(
    id: int,
    db: AsyncSession = Depends(deps.get_db),
    token: str = None,
    download: int = 0
) -> Any:
    """Download/Serve a photo."""
    try:
        # Verify token
        await deps.get_current_user_from_token(token=token, db=db)
        
        repo = ClinicalRepository(db)
        result = await db.execute(select(FotografArsivi).filter(FotografArsivi.id == id))
        photo = result.scalars().first()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
            
        file_path = photo.dosya_yolu
        if not file_path:
            raise HTTPException(status_code=404, detail="File path not found in record")

        if file_path.startswith("/"):
            relative_path = file_path[1:]
        else:
            relative_path = file_path
            
        if not os.path.exists(relative_path):
             raise HTTPException(status_code=404, detail=f"File not found on server: {relative_path}")
             
        return FileResponse(
            path=relative_path,
            filename=(photo.dosya_adi or os.path.basename(relative_path)) if download == 1 else None
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/photos/{id}")
async def delete_photo(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    """Delete photo record."""
    repo = ClinicalRepository(db)
    result = await repo.delete_photo(id)
    if not result:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"status": "success", "id": id}

# --- GÖRÜNTÜLEME (TetkikSonuc - Goruntuleme) ---
@router.get("/patients/{hasta_id}/imagings", response_model=List[TetkikSonucResponse])
async def read_imagings(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Get all imaging results for a patient."""
    repo = ClinicalRepository(db)
    return await repo.get_tetkik_sonuclari_by_patient(hasta_id, kategori="Goruntuleme")

@router.get("/imagings/{id}", response_model=TetkikSonucResponse)
async def read_imaging(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_tetkik_sonuc(id)
    if not result:
        raise HTTPException(status_code=404, detail="Imaging result not found")
    return result

@router.post("/imagings", response_model=TetkikSonucResponse)
async def create_imaging(
    *,
    db: AsyncSession = Depends(deps.get_db),
    imaging_in: TetkikSonucCreate
) -> Any:
    """Create new imaging result."""
    imaging_in.kategori = "Goruntuleme"
    repo = ClinicalRepository(db)
    return await repo.create_tetkik_sonuc(imaging_in)

@router.put("/imagings/{id}", response_model=TetkikSonucResponse)
async def update_imaging(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    imaging_in: TetkikSonucUpdate
) -> Any:
    """Update imaging result."""
    repo = ClinicalRepository(db)
    result = await repo.update_tetkik_sonuc(id, imaging_in)
    if not result:
        raise HTTPException(status_code=404, detail="Imaging result not found")
    return result

@router.get("/imagings/{id}/download")
async def download_imaging(
    id: int,
    db: AsyncSession = Depends(deps.get_db),
    token: str = None
) -> Any:
    """Download/Serve an imaging result file."""
    # Verify token
    await deps.get_current_user_from_token(token=token, db=db)
    
    result = await db.execute(select(TetkikSonuc).filter(TetkikSonuc.id == id))
    imaging = result.scalars().first()
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging result not found")
        
    file_path = imaging.dosya_yolu
    if not file_path:
        raise HTTPException(status_code=404, detail="File path not found in record")

    if file_path.startswith("/"):
        relative_path = file_path[1:]
    else:
        relative_path = file_path
        
    if not os.path.exists(relative_path):
         raise HTTPException(status_code=404, detail=f"File not found on server: {relative_path}")
         
    return FileResponse(
        path=relative_path,
        filename=imaging.dosya_adi or os.path.basename(relative_path)
    )

@router.delete("/imagings/{id}")
async def delete_imaging(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    """Delete imaging result."""
    repo = ClinicalRepository(db)
    result = await repo.delete_tetkik_sonuc(id)
    if not result:
        raise HTTPException(status_code=404, detail="Imaging result not found")
    return {"status": "success", "id": id}

# --- LABORATUVAR ---
@router.get("/patients/{hasta_id}/labs", response_model=List[TetkikSonucResponse])
async def read_labs(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Get all lab results for a patient."""
    repo = ClinicalRepository(db)
    return await repo.get_tetkik_sonuclari_by_patient(hasta_id, kategori="Laboratuvar")

@router.get("/labs/{id}", response_model=TetkikSonucResponse)
async def read_lab(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_tetkik_sonuc(id)
    if not result:
        raise HTTPException(status_code=404, detail="Lab result not found")
    return result


# --- TELEFON GÖRÜŞMELERİ ---
@router.get("/patients/{hasta_id}/phone-calls", response_model=List[TelefonGorusmesiResponse])
async def read_phone_calls(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Get all phone calls for a patient."""
    repo = ClinicalRepository(db)
    return await repo.get_phone_calls_by_patient(hasta_id)

@router.post("/phone-calls", response_model=TelefonGorusmesiResponse)
async def create_phone_call(
    *,
    db: AsyncSession = Depends(deps.get_db),
    phone_call_in: TelefonGorusmesiCreate
) -> Any:
    """Create new phone call record."""
    repo = ClinicalRepository(db)
    return await repo.create_phone_call(phone_call_in)

@router.put("/phone-calls/{id}", response_model=TelefonGorusmesiResponse)
async def update_phone_call(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    phone_call_in: TelefonGorusmesiUpdate
) -> Any:
    """Update phone call record."""
    repo = ClinicalRepository(db)
    result = await repo.update_phone_call(id, phone_call_in)
    if not result:
        raise HTTPException(status_code=404, detail="Phone call not found")
    return result

@router.delete("/phone-calls/{id}")
async def delete_phone_call(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    """Delete phone call record."""
    repo = ClinicalRepository(db)
    result = await repo.delete_phone_call(id)
    if not result:
        raise HTTPException(status_code=404, detail="Phone call not found")
    return {"status": "success", "id": id}

# --- İSTİRAHAT RAPORLARI ---
@router.get("/patients/{hasta_id}/rest-reports", response_model=List[IstirahatRaporuResponse])
async def read_rest_reports(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_rest_reports_by_patient(hasta_id)

@router.post("/rest-reports", response_model=IstirahatRaporuResponse)
async def create_rest_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    report_in: IstirahatRaporuCreate
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.create_rest_report(report_in)

@router.put("/rest-reports/{id}", response_model=IstirahatRaporuResponse)
async def update_rest_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    report_in: IstirahatRaporuUpdate
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.update_rest_report(id, report_in)
    if not result:
        raise HTTPException(status_code=404, detail="Rest report not found")
    return result

@router.delete("/rest-reports/{id}")
async def delete_rest_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.delete_rest_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Rest report not found")
    return {"status": "success", "id": id}

@router.get("/rest-reports/{id}", response_model=IstirahatRaporuResponse)
async def read_rest_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_rest_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Rest report not found")
    return result

# --- DURUM BİLDİRİR RAPORLARI ---
@router.get("/patients/{hasta_id}/status-reports", response_model=List[DurumBildirirRaporuResponse])
async def read_status_reports(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_status_reports_by_patient(hasta_id)

@router.post("/status-reports", response_model=DurumBildirirRaporuResponse)
async def create_status_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    report_in: DurumBildirirRaporuCreate
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.create_status_report(report_in)

@router.put("/status-reports/{id}", response_model=DurumBildirirRaporuResponse)
async def update_status_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    report_in: DurumBildirirRaporuUpdate
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.update_status_report(id, report_in)
    if not result:
        raise HTTPException(status_code=404, detail="Status report not found")
    return result

@router.delete("/status-reports/{id}")
async def delete_status_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.delete_status_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Status report not found")
    return {"status": "success", "id": id}

@router.get("/status-reports/{id}", response_model=DurumBildirirRaporuResponse)
async def read_status_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_status_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Status report not found")
    return result

# --- TIBBİ MÜDAHALE RAPORLARI ---
@router.get("/patients/{hasta_id}/medical-reports", response_model=List[TibbiMudahaleRaporuResponse])
async def read_medical_reports(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_medical_reports_by_patient(hasta_id)

@router.post("/medical-reports", response_model=TibbiMudahaleRaporuResponse)
async def create_medical_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    report_in: TibbiMudahaleRaporuCreate
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.create_medical_report(report_in)

@router.put("/medical-reports/{id}", response_model=TibbiMudahaleRaporuResponse)
async def update_medical_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    report_in: TibbiMudahaleRaporuUpdate
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.update_medical_report(id, report_in)
    if not result:
        raise HTTPException(status_code=404, detail="Medical report not found")
    return result

@router.delete("/medical-reports/{id}")
async def delete_medical_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.delete_medical_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Medical report not found")
    return {"status": "success", "id": id}

@router.get("/medical-reports/{id}", response_model=TibbiMudahaleRaporuResponse)
async def read_medical_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_medical_report(id)
    if not result:
        raise HTTPException(status_code=404, detail="Medical report not found")
    return result

# --- TRUS BİYOPSİ ---
@router.get("/patients/{hasta_id}/trus-biopsies", response_model=List[TrusBiyopsiResponse])
async def read_trus_biopsies(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.get_trus_biopsies_by_patient(hasta_id)

@router.post("/trus-biopsies", response_model=TrusBiyopsiResponse)
async def create_trus_biopsy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    report_in: TrusBiyopsiCreate
) -> Any:
    repo = ClinicalRepository(db)
    return await repo.create_trus_biopsy(report_in)

@router.put("/trus-biopsies/{id}", response_model=TrusBiyopsiResponse)
async def update_trus_biopsy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    report_in: TrusBiyopsiUpdate
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.update_trus_biopsy(id, report_in)
    if not result:
        raise HTTPException(status_code=404, detail="Trus biopsy not found")
    return result

@router.delete("/trus-biopsies/{id}")
async def delete_trus_biopsy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.delete_trus_biopsy(id)
    if not result:
        raise HTTPException(status_code=404, detail="Trus biopsy not found")
    return {"status": "success", "id": id}

@router.get("/trus-biopsies/{id}", response_model=TrusBiyopsiResponse)
async def read_trus_biopsy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    repo = ClinicalRepository(db)
    result = await repo.get_trus_biopsy(id)
    if not result:
        raise HTTPException(status_code=404, detail="Trus biopsy not found")
    return result
