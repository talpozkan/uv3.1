from typing import List, Optional, Tuple
from uuid import UUID
from datetime import date, datetime
from sqlalchemy import select, func, and_, or_, case, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.finance.models import (
    ShardedFinansIslem, ShardedFinansIslemSatir, 
    ShardedFinansOdeme, ShardedFinansTaksit,
    ShardedKasa
)
from app.repositories.patient.models import ShardedPatientDemographics
from app.schemas.finance import (
    FinansIslemCreate, FinansIslemUpdate, FinansIslemFilters
)
from app.core.user_context import UserContext
from app.core.audit import audited

class IncomeRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    async def generate_referans_kodu(self) -> str:
        yil = datetime.now().year
        result = await self.session.execute(
            select(func.max(ShardedFinansIslem.id))
            .where(
                and_(
                    ShardedFinansIslem.islem_tipi == 'gelir',
                    func.extract('year', ShardedFinansIslem.created_at) == yil
                )
            )
        )
        last_id = result.scalar() or 0
        return f"GEL-{yil}-{(last_id + 1):05d}"

    @audited(action="FINANCE_VIEW", resource_type="patient", id_arg_name="patient_id")
    async def get_patient_transactions(self, patient_id: UUID) -> List[ShardedFinansIslem]:
        stmt = (
            select(ShardedFinansIslem)
            .options(
                selectinload(ShardedFinansIslem.satirlar),
                selectinload(ShardedFinansIslem.odemeler)
            )
            .where(and_(ShardedFinansIslem.hasta_id == patient_id, ShardedFinansIslem.is_deleted == False))
            .order_by(ShardedFinansIslem.tarih.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_transaction(self, tx_id: int) -> Optional[ShardedFinansIslem]:
        stmt = (
            select(ShardedFinansIslem)
            .options(
                selectinload(ShardedFinansIslem.satirlar),
                selectinload(ShardedFinansIslem.odemeler)
            )
            .where(and_(ShardedFinansIslem.id == tx_id, ShardedFinansIslem.is_deleted == False))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_patient_balance(self, patient_id: UUID) -> dict:
        """Calculates patient balance status."""
        # Debt
        borc_stmt = select(func.sum(ShardedFinansIslem.net_tutar)).where(
            and_(ShardedFinansIslem.hasta_id == patient_id, ShardedFinansIslem.islem_tipi == 'gelir', 
                 ShardedFinansIslem.durum != 'iptal', ShardedFinansIslem.is_deleted == False)
        )
        # Payment
        odeme_stmt = select(func.sum(ShardedFinansOdeme.tutar)).join(ShardedFinansIslem).where(
            and_(ShardedFinansIslem.hasta_id == patient_id, ShardedFinansIslem.durum != 'iptal', 
                 ShardedFinansIslem.is_deleted == False)
        )
        
        borc = float((await self.session.execute(borc_stmt)).scalar() or 0)
        odeme = float((await self.session.execute(odeme_stmt)).scalar() or 0)
        
        return {
            'hasta_id': patient_id,
            'toplam_borc': borc,
            'toplam_odeme': odeme,
            'bakiye': borc - odeme
        }

    async def get_debtor_patients(self, min_borc: float = 0) -> List[dict]:
        # Implementation similar to legacy but using sharded models
        # Simplified for brevity here, full logic exists in legacy
        subq = (
            select(ShardedFinansIslem.hasta_id, func.sum(ShardedFinansIslem.net_tutar).label('total_debt'))
            .where(and_(ShardedFinansIslem.is_deleted == False, ShardedFinansIslem.islem_tipi == 'gelir', ShardedFinansIslem.durum != 'iptal'))
            .group_by(ShardedFinansIslem.hasta_id).subquery()
        )
        stmt = (
            select(ShardedPatientDemographics.id, ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad, subq.c.total_debt)
            .join(subq, ShardedPatientDemographics.id == subq.c.hasta_id)
            .where(subq.c.total_debt > min_borc)
            .order_by(subq.c.total_debt.desc())
        )
        result = await self.session.execute(stmt)
        return [{"hasta_id": r.id, "ad": r.ad, "soyad": r.soyad, "bakiye": float(r.total_debt)} for r in result.all()]

    @audited(action="FINANCE_CREATE", resource_type="patient")
    async def create_income_transaction(self, obj_in: FinansIslemCreate) -> ShardedFinansIslem:
        ref = await self.generate_referans_kodu()
        data = obj_in.model_dump(exclude={'satirlar', 'odemeler'})
        data['referans_kodu'] = ref
        data['islem_tipi'] = 'gelir'
        
        db_tx = ShardedFinansIslem(**data)
        if self.context: db_tx.created_by = self.context.user_id
        self.session.add(db_tx)
        await self.session.flush()
        
        # Satirlar
        for s in obj_in.satirlar:
            self.session.add(ShardedFinansIslemSatir(islem_id=db_tx.id, **s.model_dump()))
        
        # Odemeler
        for o in obj_in.odemeler:
            odeme = ShardedFinansOdeme(islem_id=db_tx.id, **o.model_dump())
            self.session.add(odeme)
            # Update kasa (will use AccountsRepository in production orchestrator if needed, 
            # but for now we can do it here if session is shared)
            if odeme.kasa_id:
                # Direct update for efficiency
                await self.session.execute(
                    update(ShardedKasa).where(ShardedKasa.id == odeme.kasa_id).values(bakiye=ShardedKasa.bakiye + odeme.tutar)
                )
        
        await self.session.flush()
        return db_tx

    @audited(action="FINANCE_DELETE_ALL", resource_type="patient", id_arg_name="patient_id")
    async def delete_patient_finance_data(self, patient_id: UUID) -> bool:
        """Logical delete of all finance data for a patient."""
        stmt = (
            update(ShardedFinansIslem)
            .where(ShardedFinansIslem.hasta_id == patient_id)
            .values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return True

    async def get_financial_summary(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
        """Calculates general financial summary."""
        # 1. Base filters
        base_filter = [ShardedFinansIslem.is_deleted == False, ShardedFinansIslem.durum != 'iptal']
        if start_date:
            base_filter.append(ShardedFinansIslem.tarih >= start_date)
        if end_date:
            base_filter.append(ShardedFinansIslem.tarih <= end_date)
            
        # 2. Income/Expense Totals
        stmt_totals = select(
            func.sum(case((ShardedFinansIslem.islem_tipi == 'gelir', ShardedFinansIslem.net_tutar), else_=0)).label('total_income'),
            func.sum(case((ShardedFinansIslem.islem_tipi == 'gider', ShardedFinansIslem.net_tutar), else_=0)).label('total_expense')
        ).where(and_(*base_filter))
        
        res_totals = await self.session.execute(stmt_totals)
        totals = res_totals.fetchone()
        
        # 3. Today's Totals
        today = date.today()
        stmt_today = select(
            func.sum(case((ShardedFinansIslem.islem_tipi == 'gelir', ShardedFinansIslem.net_tutar), else_=0)).label('today_income'),
            func.sum(case((ShardedFinansIslem.islem_tipi == 'gider', ShardedFinansIslem.net_tutar), else_=0)).label('today_expense')
        ).where(and_(ShardedFinansIslem.is_deleted == False, ShardedFinansIslem.durum != 'iptal', ShardedFinansIslem.tarih == today))
        
        res_today = await self.session.execute(stmt_today)
        today_totals = res_today.fetchone()
        
        # 4. Collection status (Odemeler)
        # Explicit join condition is needed because ForeignKey might not be explicitly linked in model
        stmt_collected = select(func.sum(ShardedFinansOdeme.tutar)).join(
            ShardedFinansIslem, ShardedFinansIslem.id == ShardedFinansOdeme.islem_id
        ).where(
            and_(ShardedFinansIslem.is_deleted == False, ShardedFinansIslem.durum != 'iptal')
        )
        if start_date:
            stmt_collected = stmt_collected.where(ShardedFinansOdeme.odeme_tarihi >= start_date)
        if end_date:
            stmt_collected = stmt_collected.where(ShardedFinansOdeme.odeme_tarihi <= end_date)
            
        collected = float((await self.session.execute(stmt_collected)).scalar() or 0)
        
        income = float(totals.total_income or 0)
        expense = float(totals.total_expense or 0)
        
        return {
            "toplam_gelir": income,
            "toplam_gider": expense,
            "net_bakiye": income - expense,
            "bekleyen_tahsilat": income - collected if income > collected else 0,
            "vadesi_gecmis_islem_sayisi": 0, # To be implemented with taksitler
            "bugun_gelir": float(today_totals.today_income or 0),
            "bugun_gider": float(today_totals.today_expense or 0)
        }
