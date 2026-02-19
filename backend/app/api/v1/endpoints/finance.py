from typing import Any, List, Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.repositories.finance.accounts_repository import AccountsRepository
from app.repositories.finance.income_repository import IncomeRepository
from app.repositories.finance.expense_repository import ExpenseRepository
from app.services.orchestrators.finance_orchestrator import FinanceOrchestrator
from app.schemas.finance import (
    # Kategoriler
    FinansKategoriResponse, FinansKategoriCreate, FinansKategoriUpdate,
    # Hizmetler (Yeni)
    FinansHizmetResponse, FinansHizmetCreate, FinansHizmetUpdate,
    # Kasalar (Yeni)
    KasaResponse, KasaCreate, KasaUpdate, KasaTransferRequest, KasaHareketResponse,
    # Firmalar
    FirmaResponse, FirmaCreate, FirmaUpdate,
    # İşlemler
    FinansIslemResponse, FinansIslemListResponse, FinansIslemCreate, FinansIslemUpdate,
    FinansIslemPaginationResponse,
    FinansIslemIptalRequest, FinansIslemFilters,
    # Ödemeler
    FinansOdemeResponse,
    # Cari ve Özet
    HastaCariResponse, FinansOzetResponse, AylikOzetResponse,
    # Eski modeller (geriye uyumluluk)
    HizmetTanimResponse, HizmetTanimCreate,
    KasaTanimResponse, KasaTanimCreate,
    HastaFinansHareketResponse, HastaFinansHareketCreate
)
from app.services.audit_service import AuditService
from app.services.audit_service import AuditService
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# KATEGORİLER
# =============================================================================
@router.get("/categories", response_model=List[FinansKategoriResponse])
async def get_kategoriler(
    tip: Optional[str] = Query(None, description="'gelir' veya 'gider'"),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Finans kategorilerini listele"""
    repo = AccountsRepository(db)
    return await repo.get_categories(tip=tip)


@router.get("/categories/{kategori_id}", response_model=FinansKategoriResponse)
async def get_kategori(
    kategori_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kategori detayını getir"""
    repo = AccountsRepository(db)
    kategori = await repo.get_category(kategori_id)
    if not kategori:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return kategori


@router.post("/categories", response_model=FinansKategoriResponse)
async def create_kategori(
    *,
    db: AsyncSession = Depends(deps.get_db),
    kategori_in: FinansKategoriCreate
) -> Any:
    """Yeni kategori oluştur"""
    repo = AccountsRepository(db)
    return await repo.create_category(kategori_in)


@router.put("/categories/{kategori_id}", response_model=FinansKategoriResponse)
async def update_kategori(
    kategori_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    kategori_in: FinansKategoriUpdate
) -> Any:
    """Kategori güncelle"""
    repo = AccountsRepository(db)
    kategori = await repo.update_category(kategori_id, kategori_in)
    if not kategori:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return kategori


@router.delete("/categories/{kategori_id}")
async def delete_kategori(
    kategori_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kategori sil"""
    repo = AccountsRepository(db)
    result = await repo.delete_category(kategori_id)
    if not result:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return {"success": True}


# =============================================================================
# HİZMETLER (YENİ SİSTEM)
# =============================================================================
@router.get("/services", response_model=List[FinansHizmetResponse])
async def get_hizmetler_yeni(
    aktif_only: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Hizmet/ürün listesini getir"""
    repo = AccountsRepository(db)
    return await repo.get_services(aktif_only=aktif_only)


@router.get("/services/{hizmet_id}", response_model=FinansHizmetResponse)
async def get_hizmet(
    hizmet_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Hizmet detayını getir"""
    repo = AccountsRepository(db)
    hizmet = await repo.get_service(hizmet_id)
    if not hizmet:
        raise HTTPException(status_code=404, detail="Hizmet bulunamadı")
    return hizmet


@router.post("/services", response_model=FinansHizmetResponse)
async def create_hizmet_yeni(
    *,
    db: AsyncSession = Depends(deps.get_db),
    hizmet_in: FinansHizmetCreate
) -> Any:
    """Yeni hizmet oluştur"""
    repo = AccountsRepository(db)
    return await repo.create_service(hizmet_in)


@router.put("/services/{hizmet_id}", response_model=FinansHizmetResponse)
async def update_hizmet(
    hizmet_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    hizmet_in: FinansHizmetUpdate
) -> Any:
    """Hizmet güncelle"""
    repo = AccountsRepository(db)
    hizmet = await repo.update_service(hizmet_id, hizmet_in)
    if not hizmet:
        raise HTTPException(status_code=404, detail="Hizmet bulunamadı")
    return hizmet


@router.delete("/services/{hizmet_id}")
async def delete_hizmet(
    hizmet_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Hizmet sil"""
    repo = AccountsRepository(db)
    result = await repo.delete_service(hizmet_id)
    if not result:
        raise HTTPException(status_code=404, detail="Hizmet bulunamadı")
    return {"success": True}


# =============================================================================
# KASALAR (YENİ SİSTEM)
# =============================================================================
@router.delete("/accounts/action/delete/{kasa_id}")
async def delete_kasa_endpoint(
    kasa_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kasa sil"""
    repo = AccountsRepository(db)
    result = await repo.delete_account(kasa_id)
    if not result:
        raise HTTPException(status_code=400, detail="Kasa silinemedi. İşlem görmüş olabilir veya bulunamadı.")
    return {"success": True}


@router.get("/accounts", response_model=List[KasaResponse])
async def get_kasalar_yeni(
    aktif_only: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kasa/hesap listesini getir"""
    repo = AccountsRepository(db)
    return await repo.get_accounts(aktif_only=aktif_only)


@router.get("/accounts/{kasa_id}", response_model=KasaResponse)
async def get_kasa(
    kasa_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kasa detayını getir"""
    repo = AccountsRepository(db)
    kasa = await repo.get_account(kasa_id)
    if not kasa:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    return kasa


@router.get("/accounts/{kasa_id}/balance")
async def get_kasa_bakiye(
    kasa_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kasa anlık bakiyesini getir"""
    repo = AccountsRepository(db)
    kasa = await repo.get_account(kasa_id)
    if not kasa:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    return {"kasa_id": kasa_id, "ad": kasa.ad, "bakiye": float(kasa.bakiye or 0)}


@router.get("/accounts/{kasa_id}/movements", response_model=List[KasaHareketResponse])
async def get_kasa_hareketleri(
    kasa_id: int,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Kasa hareketlerini listele"""
    repo = AccountsRepository(db)
    return await repo.get_account_movements(kasa_id, limit=limit)


@router.post("/accounts", response_model=KasaResponse)
async def create_kasa_yeni(
    *,
    db: AsyncSession = Depends(deps.get_db),
    kasa_in: KasaCreate
) -> Any:
    """Yeni kasa oluştur"""
    repo = AccountsRepository(db)
    return await repo.create_account(kasa_in)


@router.put("/accounts/{kasa_id}", response_model=KasaResponse)
async def update_kasa(
    kasa_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    kasa_in: KasaUpdate
) -> Any:
    """Kasa bilgilerini güncelle"""
    repo = AccountsRepository(db)
    kasa = await repo.update_account(kasa_id, kasa_in)
    if not kasa:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    return kasa





@router.post("/accounts/transfer")
async def transfer_between_accounts(
    *,
    db: AsyncSession = Depends(deps.get_db),
    transfer_in: KasaTransferRequest,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Kasalar arası transfer yap"""
    repo = AccountsRepository(db)
    result = await repo.transfer_between_kasalar(
        kaynak_id=transfer_in.kaynak_kasa_id,
        hedef_id=transfer_in.hedef_kasa_id,
        tutar=transfer_in.tutar,
        aciklama=transfer_in.aciklama
    )
    if not result:
        raise HTTPException(status_code=400, detail="Transfer yapılamadı")
    
    # Audit Log
    await AuditService.log(
        db=db,
        action="KASA_TRANSFER",
        user_id=current_user.id,
        resource_type="kasa",
        resource_id=f"{transfer_in.kaynak_kasa_id}->{transfer_in.hedef_kasa_id}",
        details={"tutar": transfer_in.tutar, "aciklama": transfer_in.aciklama}
    )
    
    return {"success": True, "message": "Transfer tamamlandı"}


# =============================================================================
# FİRMALAR
# =============================================================================
@router.get("/companies", response_model=List[FirmaResponse])
async def get_firmalar(
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Firma listesini getir"""
    repo = ExpenseRepository(db)
    return await repo.get_firms()


@router.get("/companies/debts")
async def get_firma_borclar(
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Tüm firma borçlarını listele"""
    repo = ExpenseRepository(db)
    return await repo.get_firm_debt_list()


@router.get("/companies/{firma_id}", response_model=FirmaResponse)
async def get_firma(
    firma_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Firma detayını ve borç durumunu getir"""
    repo = ExpenseRepository(db)
    firma = await repo.get_firm(firma_id)
    if not firma:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")
    
    # Borç durumunu ekle
    toplam_borc = await repo.get_firm_debt(firma_id)
    response = FirmaResponse.model_validate(firma)
    response.toplam_borc = toplam_borc
    return response


@router.post("/companies", response_model=FirmaResponse)
async def create_firma(
    *,
    db: AsyncSession = Depends(deps.get_db),
    firma_in: FirmaCreate
) -> Any:
    """Yeni firma oluştur"""
    repo = ExpenseRepository(db)
    return await repo.create_firm(firma_in)


@router.put("/companies/{firma_id}", response_model=FirmaResponse)
async def update_firma(
    firma_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    firma_in: FirmaUpdate
) -> Any:
    """Firma bilgilerini güncelle"""
    repo = ExpenseRepository(db)
    firma = await repo.update_firm(firma_id, firma_in)
    if not firma:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")
    return firma


# =============================================================================
# FİNANS İŞLEMLERİ
# =============================================================================
@router.get("/transactions", response_model=FinansIslemPaginationResponse)
async def get_islemler(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    islem_tipi: Optional[str] = Query(None),
    durum: Optional[str] = Query(None),
    kategori_id: Optional[int] = Query(None),
    hasta_id: Optional[str] = Query(None),
    firma_id: Optional[int] = Query(None),
    kasa_id: Optional[int] = Query(None),
    referans: Optional[str] = Query(None),
    vade_gecmis: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Finans işlemlerini filtreli listele"""
    repo = IncomeRepository(db)
    
    filters = FinansIslemFilters(
        start_date=start_date,
        end_date=end_date,
        islem_tipi=islem_tipi,
        durum=durum,
        kategori_id=kategori_id,
        hasta_id=UUID(hasta_id) if hasta_id else None,
        firma_id=firma_id,
        kasa_id=kasa_id,
        referans=referans,
        vade_gecmis=vade_gecmis
    )
    
    islemler = await repo.get_patient_transactions(filters.hasta_id) if filters.hasta_id else []
    total = len(islemler)
    
    return {
        "items": islemler,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/transactions/{islem_id}", response_model=FinansIslemResponse)
async def get_islem(
    islem_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """İşlem detayını getir"""
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        adapter = FinanceLegacyAdapter(db)
        islem = await adapter.orchestrator.finance_repo.get_transaction(islem_id)
        if not islem:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı")
        return islem
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions/{islem_id}/payments", response_model=List[FinansOdemeResponse])
async def get_islem_odemeler(
    islem_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """İşleme ait ödemeleri getir"""
    repo = IncomeRepository(db)
    islem = await repo.get_transaction(islem_id)
    if not islem:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı")
    return islem.odemeler


@router.post("/transactions", response_model=FinansIslemResponse)
async def create_islem(
    *,
    db: AsyncSession = Depends(deps.get_db),
    islem_in: FinansIslemCreate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Yeni finans işlemi oluştur"""
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = FinanceLegacyAdapter(db, context)
        result = await adapter.create_transaction(islem_in.model_dump())
        
        # Audit Log
        await AuditService.log(
            db=db,
            action="FINANS_ISLEM_CREATE",
            user_id=current_user.id,
            resource_type="finans_islem",
            resource_id=str(result["id"] if isinstance(result, dict) else result.id),
            details={"tip": islem_in.islem_tipi, "tutar": float(islem_in.tutar), "referans": islem_in.referans_kodu}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/transactions/{islem_id}", response_model=FinansIslemResponse)
async def update_islem(
    islem_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    islem_in: FinansIslemUpdate,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """İşlem bilgilerini güncelle"""
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = FinanceLegacyAdapter(db, context)
        islem = await adapter.orchestrator.finance_repo.update_transaction(islem_id, islem_in.model_dump(exclude_unset=True))
        if not islem:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="FINANS_ISLEM_UPDATE",
            user_id=current_user.id,
            resource_type="finans_islem",
            resource_id=str(islem_id),
            details={"referans": islem.referans_kodu}
        )
        return islem
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transactions/{islem_id}/cancel", response_model=FinansIslemResponse)
async def cancel_islem(
    islem_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    iptal_in: FinansIslemIptalRequest,
    request: Request,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """İşlemi iptal et"""
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = FinanceLegacyAdapter(db, context)
        islem = await adapter.cancel_transaction(islem_id, iptal_in.iptal_nedeni)
        if not islem:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="FINANS_ISLEM_CANCEL",
            user_id=current_user.id,
            resource_type="finans_islem",
            resource_id=str(islem_id),
            details={"iptal_nedeni": iptal_in.iptal_nedeni}
        )
        return islem
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/transactions/{islem_id}")
async def delete_islem(
    islem_id: int,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """İşlemi sil"""
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        from app.core.user_context import UserContext
        
        context = UserContext(
            user_id=current_user.id,
            username=current_user.username,
            ip_address=request.client.host
        )
        adapter = FinanceLegacyAdapter(db, context)
        result = await adapter.delete_transaction(islem_id)
        if not result:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı")
            
        # Audit Log
        await AuditService.log(
            db=db,
            action="FINANS_ISLEM_DELETE",
            user_id=current_user.id,
            resource_type="finans_islem",
            resource_id=str(islem_id),
            details={}
        )
        return {"success": True}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# HASTA CARİ
# =============================================================================
@router.get("/patients/{hasta_id}/transactions", response_model=List[FinansIslemResponse])
async def get_hasta_islemler(
    hasta_id: str,
    request: Request,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        from app.core.user_context import UserContext
        from fastapi import Request
        
        # Note: Need to verify if 'request' is available in dependencies. 
        # For now, following the pattern of injecting context where possible.
        adapter = FinanceLegacyAdapter(db)
        return await adapter.get_patient_transactions(hasta_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patients/{hasta_id}/balance", response_model=HastaCariResponse)
async def get_hasta_cari(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    try:
        from app.controllers.legacy_adapters.finance_adapter import FinanceLegacyAdapter
        
        adapter = FinanceLegacyAdapter(db)
        cari = await adapter.get_patient_summary(hasta_id)
        return HastaCariResponse(**cari)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patients/debtors", response_model=List[HastaCariResponse])
async def get_borclu_hastalar(
    min_borc: float = Query(0, ge=0),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Borçlu hastaları listele"""
    repo = IncomeRepository(db)
    return await repo.get_debtor_patients(min_borc=min_borc)


# =============================================================================
# VADESİ GEÇMİŞ İŞLEMLER
# =============================================================================
@router.get("/overdue", response_model=FinansIslemPaginationResponse)
async def get_vadesi_gecmis_islemler(
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Vadesi geçmiş işlemleri listele"""
    repo = IncomeRepository(db)
    # Placeholder for general overdue list across patients
    return {"items": [], "total": 0}
    return {"items": islemler, "total": total}


# =============================================================================
# ÖZET VE RAPORLAR
# =============================================================================
@router.get("/summary", response_model=FinansOzetResponse)
async def get_finans_ozet(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Genel finans özeti"""
    repo = IncomeRepository(db)
    summary = await repo.get_financial_summary(start_date=start_date, end_date=end_date)
    return FinansOzetResponse(**summary)


@router.get("/summary/daily")
async def get_gunluk_ozet(
    tarih: date = Query(None),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Günlük finans özeti"""
    repo = IncomeRepository(db)
    if not tarih:
        tarih = date.today()
    ozet = await repo.get_ozet(start_date=tarih, end_date=tarih)
    return {
        "tarih": tarih,
        "gelir": ozet['bugun_gelir'],
        "gider": ozet['bugun_gider'],
        "net": ozet['bugun_gelir'] - ozet['bugun_gider']
    }


@router.get("/summary/monthly", response_model=List[AylikOzetResponse])
async def get_aylik_ozet(
    yil: int = Query(None),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Aylık finans özeti"""
    repo = AccountsRepository(db)
    if not yil:
        yil = date.today().year
    return await repo.get_aylik_ozet(yil)


# =============================================================================
# ESKİ ENDPOINTLER (GERİYE UYUMLULUK)
# =============================================================================
@router.get("/hizmetler", response_model=List[HizmetTanimResponse])
async def read_hizmetler(
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """List available services/procedures. (Legacy)"""
    repo = AccountsRepository(db)
    return await repo.get_services()


@router.post("/hizmetler", response_model=HizmetTanimResponse)
async def create_hizmet(
    *,
    db: AsyncSession = Depends(deps.get_db),
    hizmet_in: HizmetTanimCreate
) -> Any:
    """Create new service definition. (Legacy)"""
    repo = AccountsRepository(db)
    return await repo.create_service(hizmet_in)


@router.get("/kasalar", response_model=List[KasaTanimResponse])
async def read_kasalar(
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """List available payment accounts (Safes/Banks). (Legacy)"""
    repo = AccountsRepository(db)
    return await repo.get_accounts()


@router.post("/kasalar", response_model=KasaTanimResponse)
async def create_kasa(
    *,
    db: AsyncSession = Depends(deps.get_db),
    kasa_in: KasaTanimCreate
) -> Any:
    """Create new payment account definition. (Legacy)"""
    repo = AccountsRepository(db)
    return await repo.create_account(kasa_in)


@router.get("/patients/{hasta_id}/hareketler", response_model=List[HastaFinansHareketResponse])
async def read_finance_history(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Get financial history for a patient. (Legacy)"""
    repo = IncomeRepository(db)
    return await repo.get_patient_transactions(UUID(hasta_id))


@router.post("/hareketler", response_model=HastaFinansHareketResponse)
async def create_finance_entry(
    *,
    db: AsyncSession = Depends(deps.get_db),
    hareket_in: HastaFinansHareketCreate
) -> Any:
    """Add a financial record (Debit/Credit). (Legacy)"""
    try:
        logger.info(f"Creating finance entry: {hareket_in.model_dump()}")
        repo = IncomeRepository(db)
        # Using income creation for legacy hareket
        return await repo.create_income_transaction(FinansIslemCreate(**hareket_in.model_dump()))
    except ValueError as e:
        logger.error(f"ValueError creating finance entry: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error creating finance entry: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.put("/hareketler/{hareket_id}", response_model=HastaFinansHareketResponse)
async def update_finance_entry(
    hareket_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    hareket_in: HastaFinansHareketCreate
) -> Any:
    """Update a financial record. (Legacy)"""
    repo = IncomeRepository(db)
    # Placeholder for legacy update
    return None


@router.delete("/hareketler/{hareket_id}", response_model=bool)
async def delete_finance_entry(
    hareket_id: int,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """Delete a financial record. (Legacy)"""
    repo = IncomeRepository(db)
    # Placeholder for legacy delete
    return False
