from typing import List, Optional, Tuple
from sqlalchemy import select, delete, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.finance.models import (
    ShardedFinansKategori, ShardedFinansHizmet, 
    ShardedKasa, ShardedKasaHareket, ShardedFinansIslem, ShardedFinansOdeme
)
from app.schemas.finance import (
    FinansKategoriCreate, FinansKategoriUpdate,
    FinansHizmetCreate, FinansHizmetUpdate,
    KasaCreate, KasaUpdate
)
from app.core.user_context import UserContext

class AccountsRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    # =========================================================================
    # KATEGORİLER
    # =========================================================================
    async def get_categories(self, tip: Optional[str] = None) -> List[ShardedFinansKategori]:
        stmt = select(ShardedFinansKategori).where(ShardedFinansKategori.aktif == True)
        if tip:
            stmt = stmt.where(ShardedFinansKategori.tip == tip)
        stmt = stmt.order_by(ShardedFinansKategori.ad)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_category(self, kategori_id: int) -> Optional[ShardedFinansKategori]:
        result = await self.session.execute(
            select(ShardedFinansKategori).where(ShardedFinansKategori.id == kategori_id)
        )
        return result.scalar_one_or_none()

    async def create_category(self, obj_in: FinansKategoriCreate) -> ShardedFinansKategori:
        db_obj = ShardedFinansKategori(**obj_in.model_dump())
        self.session.add(db_obj)
        await self.session.flush()
        return db_obj

    async def update_category(self, kategori_id: int, obj_in: FinansKategoriUpdate) -> Optional[ShardedFinansKategori]:
        db_obj = await self.get_category(kategori_id)
        if not db_obj:
            return None
        for key, value in obj_in.model_dump(exclude_unset=True).items():
            setattr(db_obj, key, value)
        await self.session.flush()
        return db_obj

    async def delete_category(self, kategori_id: int) -> bool:
        result = await self.session.execute(
            delete(ShardedFinansKategori).where(ShardedFinansKategori.id == kategori_id)
        )
        return result.rowcount > 0

    # =========================================================================
    # HİZMETLER
    # =========================================================================
    async def get_services(self, aktif_only: bool = True) -> List[ShardedFinansHizmet]:
        stmt = select(ShardedFinansHizmet)
        if aktif_only:
            stmt = stmt.where(ShardedFinansHizmet.aktif == True)
        stmt = stmt.order_by(ShardedFinansHizmet.ad)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_service(self, hizmet_id: int) -> Optional[ShardedFinansHizmet]:
        result = await self.session.execute(
            select(ShardedFinansHizmet).where(ShardedFinansHizmet.id == hizmet_id)
        )
        return result.scalar_one_or_none()

    async def create_service(self, obj_in: FinansHizmetCreate) -> ShardedFinansHizmet:
        db_obj = ShardedFinansHizmet(**obj_in.model_dump())
        self.session.add(db_obj)
        await self.session.flush()
        return db_obj

    async def update_service(self, hizmet_id: int, obj_in: FinansHizmetUpdate) -> Optional[ShardedFinansHizmet]:
        db_obj = await self.get_service(hizmet_id)
        if not db_obj:
            return None
        for key, value in obj_in.model_dump(exclude_unset=True).items():
            setattr(db_obj, key, value)
        await self.session.flush()
        return db_obj

    async def delete_service(self, hizmet_id: int) -> bool:
        result = await self.session.execute(
            delete(ShardedFinansHizmet).where(ShardedFinansHizmet.id == hizmet_id)
        )
        return result.rowcount > 0

    # =========================================================================
    # KASALAR
    # =========================================================================
    async def get_accounts(self, aktif_only: bool = True) -> List[ShardedKasa]:
        stmt = select(ShardedKasa)
        if aktif_only:
            stmt = stmt.where(ShardedKasa.aktif == True)
        stmt = stmt.order_by(ShardedKasa.sira_no, ShardedKasa.ad)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_account(self, kasa_id: int) -> Optional[ShardedKasa]:
        result = await self.session.execute(
            select(ShardedKasa).where(ShardedKasa.id == kasa_id)
        )
        return result.scalar_one_or_none()

    async def create_account(self, obj_in: KasaCreate) -> ShardedKasa:
        db_obj = ShardedKasa(**obj_in.model_dump())
        self.session.add(db_obj)
        await self.session.flush()
        return db_obj

    async def update_account(self, kasa_id: int, obj_in: KasaUpdate) -> Optional[ShardedKasa]:
        db_obj = await self.get_account(kasa_id)
        if not db_obj:
            return None
        for key, value in obj_in.model_dump(exclude_unset=True).items():
            setattr(db_obj, key, value)
        await self.session.flush()
        return db_obj

    async def delete_account(self, kasa_id: int) -> bool:
        """Kasa siler (Bağlı hareketleri temizleyerek)"""
        kasa = await self.get_account(kasa_id)
        if not kasa:
            return False
        
        try:
            # Update dependencies to Null
            await self.session.execute(
                update(ShardedFinansIslem).where(ShardedFinansIslem.kasa_id == kasa_id).values(kasa_id=None)
            )
            await self.session.execute(
                update(ShardedFinansOdeme).where(ShardedFinansOdeme.kasa_id == kasa_id).values(kasa_id=None)
            )
            # Delete movements
            await self.session.execute(
                delete(ShardedKasaHareket).where(ShardedKasaHareket.kasa_id == kasa_id)
            )
            await self.session.delete(kasa)
            await self.session.flush()
            return True
        except Exception:
            return False

    async def update_account_balance(self, kasa_id: int, tutar: float, hareket_tipi: str) -> Optional[ShardedKasa]:
        """Kasa bakiyesini günceller ve hareket kaydı oluşturur"""
        kasa = await self.get_account(kasa_id)
        if not kasa:
            return None
        
        onceki_bakiye = float(kasa.bakiye or 0)
        if hareket_tipi == 'giris':
            kasa.bakiye = onceki_bakiye + tutar
        else:
            kasa.bakiye = onceki_bakiye - tutar
        
        sonraki_bakiye = float(kasa.bakiye)
        
        hareket = ShardedKasaHareket(
            kasa_id=kasa_id,
            hareket_tipi=hareket_tipi,
            tutar=tutar,
            onceki_bakiye=onceki_bakiye,
            sonraki_bakiye=sonraki_bakiye
        )
        self.session.add(hareket)
        await self.session.flush()
        return kasa

    async def transfer_between_accounts(self, kaynak_id: int, hedef_id: int, tutar: float, aciklama: str = None) -> bool:
        """Kasalar arası transfer yapar"""
        kaynak = await self.get_account(kaynak_id)
        hedef = await self.get_account(hedef_id)
        
        if not kaynak or not hedef:
            return False
        
        # Source exit
        k_onceki = float(kaynak.bakiye or 0)
        kaynak.bakiye = k_onceki - tutar
        self.session.add(ShardedKasaHareket(
            kasa_id=kaynak_id, hareket_tipi='cikis', tutar=tutar,
            onceki_bakiye=k_onceki, sonraki_bakiye=float(kaynak.bakiye),
            aciklama=f"Transfer: {hedef.ad}'a gönderildi. {aciklama or ''}"
        ))
        
        # Target entry
        h_onceki = float(hedef.bakiye or 0)
        hedef.bakiye = h_onceki + tutar
        self.session.add(ShardedKasaHareket(
            kasa_id=hedef_id, hareket_tipi='giris', tutar=tutar,
            onceki_bakiye=h_onceki, sonraki_bakiye=float(hedef.bakiye),
            aciklama=f"Transfer: {kaynak.ad}'dan alındı. {aciklama or ''}"
        ))
        
        await self.session.flush()
        return True

    async def get_account_movements(self, kasa_id: int, limit: int = 50) -> List[ShardedKasaHareket]:
        stmt = (
            select(ShardedKasaHareket)
            .where(ShardedKasaHareket.kasa_id == kasa_id)
            .order_by(ShardedKasaHareket.tarih.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
