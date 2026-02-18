from typing import List, Optional, Tuple, Dict
from datetime import datetime, date
from sqlalchemy import select, func, and_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.finance.models import (
    ShardedFirma, ShardedFinansIslem, 
    ShardedFinansIslemSatir, ShardedFinansOdeme
)
from app.schemas.finance import (
    FirmaCreate, FirmaUpdate, FinansIslemCreate
)
from app.core.user_context import UserContext

class ExpenseRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    async def generate_referans_kodu(self) -> str:
        yil = datetime.now().year
        result = await self.session.execute(
            select(func.max(ShardedFinansIslem.id))
            .where(
                and_(
                    ShardedFinansIslem.islem_tipi == 'gider',
                    func.extract('year', ShardedFinansIslem.created_at) == yil
                )
            )
        )
        last_id = result.scalar() or 0
        return f"GID-{yil}-{(last_id + 1):05d}"

    # =========================================================================
    # FİRMALAR
    # =========================================================================
    async def get_firms(self) -> List[ShardedFirma]:
        result = await self.session.execute(select(ShardedFirma).order_by(ShardedFirma.ad))
        return result.scalars().all()

    async def get_firm(self, firma_id: int) -> Optional[ShardedFirma]:
        result = await self.session.execute(
            select(ShardedFirma).where(ShardedFirma.id == firma_id)
        )
        return result.scalar_one_or_none()

    async def create_firm(self, obj_in: FirmaCreate) -> ShardedFirma:
        db_obj = ShardedFirma(**obj_in.model_dump())
        self.session.add(db_obj)
        await self.session.flush()
        return db_obj

    async def update_firm(self, firma_id: int, obj_in: FirmaUpdate) -> Optional[ShardedFirma]:
        db_obj = await self.get_firm(firma_id)
        if not db_obj:
            return None
        for key, value in obj_in.model_dump(exclude_unset=True).items():
            setattr(db_obj, key, value)
        await self.session.flush()
        return db_obj

    # =========================================================================
    # BORÇ TAKİBİ
    # =========================================================================
    async def get_firm_debt(self, firma_id: int) -> float:
        result = await self.session.execute(
            select(func.sum(ShardedFinansIslem.net_tutar))
            .where(
                and_(
                    ShardedFinansIslem.firma_id == firma_id,
                    ShardedFinansIslem.islem_tipi == 'gider',
                    ShardedFinansIslem.durum == 'bekliyor',
                    ShardedFinansIslem.is_deleted == False
                )
            )
        )
        return float(result.scalar() or 0)

    async def get_firm_debt_list(self) -> List[dict]:
        stmt = (
            select(
                ShardedFirma.id, ShardedFirma.ad,
                func.sum(ShardedFinansIslem.net_tutar).label('total_debt')
            )
            .join(ShardedFinansIslem, ShardedFinansIslem.firma_id == ShardedFirma.id)
            .where(and_(ShardedFinansIslem.islem_tipi == 'gider', ShardedFinansIslem.durum == 'bekliyor', ShardedFinansIslem.is_deleted == False))
            .group_by(ShardedFirma.id, ShardedFirma.ad)
            .order_by(func.sum(ShardedFinansIslem.net_tutar).desc())
        )
        result = await self.session.execute(stmt)
        return [{'id': r.id, 'ad': r.ad, 'total_debt': float(r.total_debt or 0)} for r in result.all()]

    async def create_expense_transaction(self, obj_in: FinansIslemCreate) -> ShardedFinansIslem:
        ref = await self.generate_referans_kodu()
        data = obj_in.model_dump(exclude={'satirlar', 'odemeler'})
        data['referans_kodu'] = ref
        data['islem_tipi'] = 'gider'
        
        db_tx = ShardedFinansIslem(**data)
        if self.context: db_tx.created_by = self.context.user_id
        self.session.add(db_tx)
        await self.session.flush()
        
        for s in obj_in.satirlar:
            self.session.add(ShardedFinansIslemSatir(islem_id=db_tx.id, **s.model_dump()))
        
        for o in obj_in.odemeler:
            self.session.add(ShardedFinansOdeme(islem_id=db_tx.id, **o.model_dump()))
        
        await self.session.flush()
        return db_tx
