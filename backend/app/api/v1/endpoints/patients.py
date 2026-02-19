from typing import Any, List, Optional
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from app.core.limiter import limiter
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, cast, Date, distinct
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from fastapi.responses import StreamingResponse
import csv
import io

from app.api import deps
from app.schemas.patient import PatientResponse, PatientCreate, PatientUpdate
from app.schemas.patient.legacy import PatientLegacyResponse
from app.schemas.patient.demographics import PatientDemographicsCreate, PatientDemographicsUpdate, PatientFullProfile
from app.services.audit_service import AuditService
from app.models.user import User
from app.controllers.legacy_adapters.patient_controller import PatientController
from app.core.user_context import UserContext
from app.repositories.patient.models import ShardedPatientDemographics
from app.repositories.clinical.models import ShardedMuayene, ShardedOperasyon

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


def _build_advanced_search_query(
    tani: Optional[str],
    yas_min: Optional[int],
    yas_max: Optional[int],
    muayene_tarihi_baslangic: Optional[str],
    muayene_tarihi_bitis: Optional[str],
    son_islem_tarihi_baslangic: Optional[str],
    son_islem_tarihi_bitis: Optional[str],
    ilk_kayit_tarihi_baslangic: Optional[str],
    ilk_kayit_tarihi_bitis: Optional[str],
    operasyon_tarihi_baslangic: Optional[str],
    operasyon_tarihi_bitis: Optional[str],
    operasyon_adi: Optional[str],
    sikayet: Optional[str],
    bulgu: Optional[str],
):
    from datetime import datetime, timedelta

    # Build base query for patient IDs
    base_stmt = select(ShardedPatientDemographics.id).where(
        ShardedPatientDemographics.is_deleted == False
    )

    # 1. Age filter (calculated from dogum_tarihi)
    if yas_min is not None or yas_max is not None:
        today = date.today()
        if yas_max is not None:
            # Person must be born AFTER this date to be at most yas_max years old
            try:
                min_dob = today.replace(year=today.year - yas_max - 1)
            except ValueError:
                min_dob = today.replace(year=today.year - yas_max - 1, day=28)
            base_stmt = base_stmt.where(ShardedPatientDemographics.dogum_tarihi >= min_dob)
        if yas_min is not None:
            # Person must be born BEFORE this date to be at least yas_min years old
            try:
                max_dob = today.replace(year=today.year - yas_min)
            except ValueError:
                max_dob = today.replace(year=today.year - yas_min, day=28)
            base_stmt = base_stmt.where(ShardedPatientDemographics.dogum_tarihi <= max_dob)

    # 2. First registration date (created_at)
    if ilk_kayit_tarihi_baslangic:
        base_stmt = base_stmt.where(
            cast(ShardedPatientDemographics.created_at, Date) >= ilk_kayit_tarihi_baslangic
        )
    if ilk_kayit_tarihi_bitis:
        base_stmt = base_stmt.where(
            cast(ShardedPatientDemographics.created_at, Date) <= ilk_kayit_tarihi_bitis
        )

    # 3. Diagnosis filter (tani) - search in muayeneler.tani1
    if tani:
        tani_subq = select(ShardedMuayene.hasta_id).where(
            and_(
                ShardedMuayene.is_deleted == False,
                or_(
                    ShardedMuayene.tani1.ilike(f"%{tani}%"),
                    ShardedMuayene.tani2.ilike(f"%{tani}%"),
                    ShardedMuayene.tani3.ilike(f"%{tani}%"),
                    ShardedMuayene.tani4.ilike(f"%{tani}%"),
                    ShardedMuayene.tani5.ilike(f"%{tani}%"),
                    ShardedMuayene.tani1_kodu.ilike(f"%{tani}%"),
                )
            )
        ).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(tani_subq))

    # 4. Examination date filter (muayene tarihi)
    if muayene_tarihi_baslangic or muayene_tarihi_bitis:
        muayene_conditions = [ShardedMuayene.is_deleted == False]
        if muayene_tarihi_baslangic:
            muayene_conditions.append(cast(ShardedMuayene.tarih, Date) >= muayene_tarihi_baslangic)
        if muayene_tarihi_bitis:
            muayene_conditions.append(cast(ShardedMuayene.tarih, Date) <= muayene_tarihi_bitis)
        muayene_subq = select(ShardedMuayene.hasta_id).where(and_(*muayene_conditions)).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(muayene_subq))

    # 5. Last procedure date (son işlem tarihi) - latest updated_at across all clinical tables
    if son_islem_tarihi_baslangic or son_islem_tarihi_bitis:
        # Use updated_at from demographics as a proxy for last activity
        if son_islem_tarihi_baslangic:
            base_stmt = base_stmt.where(
                cast(ShardedPatientDemographics.updated_at, Date) >= son_islem_tarihi_baslangic
            )
        if son_islem_tarihi_bitis:
            base_stmt = base_stmt.where(
                cast(ShardedPatientDemographics.updated_at, Date) <= son_islem_tarihi_bitis
            )

    # 6. Operation date filter (operasyon tarihi)
    if operasyon_tarihi_baslangic or operasyon_tarihi_bitis:
        op_conditions = [ShardedOperasyon.is_deleted == False]
        if operasyon_tarihi_baslangic:
            op_conditions.append(cast(ShardedOperasyon.tarih, Date) >= operasyon_tarihi_baslangic)
        if operasyon_tarihi_bitis:
            op_conditions.append(cast(ShardedOperasyon.tarih, Date) <= operasyon_tarihi_bitis)
        op_subq = select(ShardedOperasyon.hasta_id).where(and_(*op_conditions)).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(op_subq))

    # 7. Operation name filter (operasyon adı)
    if operasyon_adi:
        op_name_subq = select(ShardedOperasyon.hasta_id).where(
            and_(
                ShardedOperasyon.is_deleted == False,
                ShardedOperasyon.ameliyat.ilike(f"%{operasyon_adi}%")
            )
        ).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(op_name_subq))

    # 8. Complaint filter (şikayet)
    if sikayet:
        sikayet_subq = select(ShardedMuayene.hasta_id).where(
            and_(
                ShardedMuayene.is_deleted == False,
                ShardedMuayene.sikayet.ilike(f"%{sikayet}%")
            )
        ).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(sikayet_subq))

    # 9. Findings filter (bulgu)
    if bulgu:
        bulgu_subq = select(ShardedMuayene.hasta_id).where(
            and_(
                ShardedMuayene.is_deleted == False,
                or_(
                    ShardedMuayene.bulgu_notu.ilike(f"%{bulgu}%"),
                    ShardedMuayene.fizik_muayene.ilike(f"%{bulgu}%")
                )
            )
        ).distinct()
        base_stmt = base_stmt.where(ShardedPatientDemographics.id.in_(bulgu_subq))
        
    return base_stmt

@router.get("/advanced-search")
@limiter.limit("60/minute")
async def advanced_search(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    tani: Optional[str] = Query(None, description="Tanı metni (diagnosis text)"),
    yas_min: Optional[int] = Query(None, description="Minimum yaş"),
    yas_max: Optional[int] = Query(None, description="Maksimum yaş"),
    muayene_tarihi_baslangic: Optional[str] = Query(None, description="Muayene başlangıç tarihi (YYYY-MM-DD)"),
    muayene_tarihi_bitis: Optional[str] = Query(None, description="Muayene bitiş tarihi (YYYY-MM-DD)"),
    son_islem_tarihi_baslangic: Optional[str] = Query(None, description="Son işlem başlangıç tarihi (YYYY-MM-DD)"),
    son_islem_tarihi_bitis: Optional[str] = Query(None, description="Son işlem bitiş tarihi (YYYY-MM-DD)"),
    ilk_kayit_tarihi_baslangic: Optional[str] = Query(None, description="İlk kayıt başlangıç tarihi (YYYY-MM-DD)"),
    ilk_kayit_tarihi_bitis: Optional[str] = Query(None, description="İlk kayıt bitiş tarihi (YYYY-MM-DD)"),
    operasyon_tarihi_baslangic: Optional[str] = Query(None, description="Operasyon başlangıç tarihi (YYYY-MM-DD)"),
    operasyon_tarihi_bitis: Optional[str] = Query(None, description="Operasyon bitiş tarihi (YYYY-MM-DD)"),
    operasyon_adi: Optional[str] = Query(None, description="Operasyon adı"),
    sikayet: Optional[str] = Query(None, description="Şikayet metni (complaint)"),
    bulgu: Optional[str] = Query(None, description="Muayene bulguları (findings)"),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Advanced patient search with cross-table filtering and pagination.
    Returns: { "items": [...], "total": count, "page": ..., "size": ... }
    """
    try:
        base_stmt = _build_advanced_search_query(
            tani, yas_min, yas_max, muayene_tarihi_baslangic, muayene_tarihi_bitis,
            son_islem_tarihi_baslangic, son_islem_tarihi_bitis, ilk_kayit_tarihi_baslangic, ilk_kayit_tarihi_bitis,
            operasyon_tarihi_baslangic, operasyon_tarihi_bitis, operasyon_adi, sikayet, bulgu
        )

        # Count total matches
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total_count = await db.scalar(count_stmt) or 0

        # Execute to get matching patient IDs
        base_stmt = base_stmt.order_by(ShardedPatientDemographics.updated_at.desc().nulls_last())
        base_stmt = base_stmt.offset(skip).limit(limit)
        
        result = await db.execute(base_stmt)
        patient_ids = [row[0] for row in result.all()]

        if not patient_ids:
            return {
                "items": [],
                "total": total_count,
                "page": (skip // limit) + 1 if limit > 0 else 1,
                "size": limit
            }

        # Fetch full patient profiles using existing orchestrator pattern
        context = UserContext(
            user_id=getattr(request.state, "user_id", None),
            username=getattr(request.state, "username", None),
            ip_address=request.client.host
        )
        controller = PatientController(db, context)
        
        # Re-fetch patients by IDs with full profile data
        from app.services.orchestrators.patient_orchestrator import PatientOrchestrator
        orchestrator = PatientOrchestrator(db, context)
        
        # Fetch all matched patients
        patients_result = await db.execute(
            select(ShardedPatientDemographics).where(
                ShardedPatientDemographics.id.in_(patient_ids)
            ).order_by(ShardedPatientDemographics.updated_at.desc().nulls_last())
        )
        patients_list = patients_result.scalars().all()

        # Batch-fetch clinical data just like get_multi
        import asyncio
        exam_task = orchestrator.clinical_repo.get_latest_examinations_for_patients(patient_ids)
        stats_task = orchestrator.stats_repo.get_counts_batch(patient_ids)
        batch_results = await asyncio.gather(exam_task, stats_task)
        latest_exams = batch_results[0]
        stats_map = batch_results[1]
        exam_map = {e.hasta_id: e for e in latest_exams}

        results = []
        for p in patients_list:
            exam = exam_map.get(p.id)
            stats = stats_map.get(p.id, {})
            
            son_tani = None
            son_muayene_tarihi = None
            if exam:
                son_muayene_tarihi = exam.tarih
                if exam.tani1:
                    son_tani = exam.tani1
                elif exam.tani1_kodu:
                    son_tani = f"[{exam.tani1_kodu}]"
            
            profile = PatientFullProfile.model_validate(p)
            profile.son_tani = son_tani
            profile.son_muayene_tarihi = son_muayene_tarihi
            for k, v in stats.items():
                setattr(profile, f"{k}_count", v)
            
            legacy = controller._map_to_legacy(profile)
            results.append(legacy)

        # Sort results by updated_at matching the query order is best effort here as we refetched
        # But we ordered the refetch by updated_at too. 
        # Ideally we'd maintain the order from patient_ids list.
        results.sort(key=lambda x: patient_ids.index(x.id) if x.id in patient_ids else 999)

        return {
            "items": results,
            "total": total_count,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/advanced-search/export")
@limiter.limit("5/minute")
async def export_advanced_search(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    tani: Optional[str] = Query(None),
    yas_min: Optional[int] = Query(None),
    yas_max: Optional[int] = Query(None),
    muayene_tarihi_baslangic: Optional[str] = Query(None),
    muayene_tarihi_bitis: Optional[str] = Query(None),
    son_islem_tarihi_baslangic: Optional[str] = Query(None),
    son_islem_tarihi_bitis: Optional[str] = Query(None),
    ilk_kayit_tarihi_baslangic: Optional[str] = Query(None),
    ilk_kayit_tarihi_bitis: Optional[str] = Query(None),
    operasyon_tarihi_baslangic: Optional[str] = Query(None),
    operasyon_tarihi_bitis: Optional[str] = Query(None),
    operasyon_adi: Optional[str] = Query(None),
    sikayet: Optional[str] = Query(None),
    bulgu: Optional[str] = Query(None),
) -> StreamingResponse:
    """
    Export advanced search results as CSV.
    """
    async def generate():
        try:
            base_stmt = _build_advanced_search_query(
                tani, yas_min, yas_max, muayene_tarihi_baslangic, muayene_tarihi_bitis,
                son_islem_tarihi_baslangic, son_islem_tarihi_bitis, ilk_kayit_tarihi_baslangic, ilk_kayit_tarihi_bitis,
                operasyon_tarihi_baslangic, operasyon_tarihi_bitis, operasyon_adi, sikayet, bulgu
            )

            # Fetch ALL matching IDs (no limit)
            base_stmt = base_stmt.order_by(ShardedPatientDemographics.updated_at.desc().nulls_last())
            result = await db.execute(base_stmt)
            patient_ids = [row[0] for row in result.all()]

            if not patient_ids:
                yield "No data found"
                return

            context = UserContext(
                user_id=getattr(request.state, "user_id", None),
                username=getattr(request.state, "username", None),
                ip_address=request.client.host
            )
            controller = PatientController(db, context)

            # Fetch patients
            patients_result = await db.execute(
                select(ShardedPatientDemographics).where(
                    ShardedPatientDemographics.id.in_(patient_ids)
                ).order_by(ShardedPatientDemographics.updated_at.desc().nulls_last())
            )
            patients_list = patients_result.scalars().all()
            
            # Prepare CSV stream
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write BOM for Excel compatibility
            output.write('\ufeff')
            
            # Header
            writer.writerow([
                "TC Kimlik", "Ad", "Soyad", "Doğum Tarihi", "Cinsiyet", 
                "Telefon", "Email", "Protokol No", "Oluşturulma Tarihi"
            ])
            
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            
            for p in patients_list:
                writer.writerow([
                    p.tc_kimlik or "",
                    p.ad or "",
                    p.soyad or "",
                    p.dogum_tarihi.isoformat() if p.dogum_tarihi else "",
                    p.cinsiyet or "",
                    p.cep_tel or "",
                    p.email or "",
                    p.protokol_no or "",
                    p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
                ])
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"Error: {str(e)}"

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=patients_export.csv"}
    )

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

