from typing import Any, List, Optional
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.finance.accounts_repository import AccountsRepository
from app.repositories.finance.income_repository import IncomeRepository
from app.repositories.finance.expense_repository import ExpenseRepository
from app.repositories.patient.demographics_repository import DemographicsRepository
from app.core.user_context import UserContext

class FinanceOrchestrator:
    def __init__(self, db: AsyncSession, context: Optional[UserContext] = None):
        self.db = db
        self.context = context
        self.accounts_repo = AccountsRepository(db, context)
        self.income_repo = IncomeRepository(db, context)
        self.expense_repo = ExpenseRepository(db, context)
        self.patient_repo = DemographicsRepository(db, context)

    async def get_patient_finance_summary(self, patient_id: UUID) -> dict:
        """
        Aggregates demographics from patient shard and financial stats from finance shard.
        """
        # 1. Get patient info from demographics shard
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")

        # 2. Get financial stats from income shard
        stats = await self.income_repo.get_patient_balance(patient_id)
        
        return {
            "patient_name": f"{patient.ad} {patient.soyad}",
            "tc_kimlik": patient.tc_kimlik,
            **stats
        }

    async def get_transactions_multi(self, skip: int = 0, limit: int = 100, patient_id: Optional[UUID] = None):
        """
        Returns transactions, mapping them to legacy field names (borc, alacak) for v1 compatibility.
        """
        # Note: This is a placeholder for a more complex join across shards if needed
        # For now, if patient_id is provided, we use IncomeRepository
        if patient_id:
            transactions = await self.income_repo.get_patient_transactions(patient_id)
            total = len(transactions) # Simplified pagination for now
        else:
            # Fallback to general fetch if no patient specified (e.g. general ledger)
            # This logic will be fully implemented as we shard more of the FinanceRepo
            transactions = []
            total = 0
        
        results = []
        for tx in transactions:
            # Map new schema to legacy HastaFinansHareketResponse
            # 'gelir' (income) in new schema = 'borc' (debt/bill) in legacy view
            # 'tahsilat' (payment) logic needs to be handled
            results.append({
                "id": tx.id,
                "hasta_id": tx.hasta_id,
                "tarih": tx.tarih,
                "islem_tipi": "HIZMET" if tx.islem_tipi == 'gelir' else "GIDEREK", # Simplified mapping
                "referans_kodu": tx.referans_kodu,
                "aciklama": tx.aciklama,
                "borc": float(tx.net_tutar) if tx.islem_tipi == 'gelir' else 0.0,
                "alacak": float(tx.net_tutar) if tx.islem_tipi == 'gider' else 0.0,
                "para_birimi": tx.para_birimi,
                "doktor": getattr(tx, "doktor", None), # From sharded model
                "hizmet_ad": "Sharded Service" # Placeholder until Hizmet relation is added
            })
            
        return results, total

    async def create_transaction_safely(self, tx_data: dict) -> dict:
        """
        Ensures patient existence before creating a financial record. 2PC candidate.
        """
        if tx_data.get('hasta_id'):
            patient = await self.patient_repo.get_by_id(tx_data['hasta_id'])
            if not patient:
                raise ValueError("Referenced patient does not exist")
        
        if tx_data.get('islem_tipi') == 'gider':
            tx = await self.expense_repo.create_expense_transaction(FinansIslemCreate(**tx_data))
        else:
            tx = await self.income_repo.create_income_transaction(FinansIslemCreate(**tx_data))
        
        await self.db.commit()
        
        # Build response dict
        return {
            "id": tx.id,
            "referans_kodu": tx.referans_kodu,
            "net_tutar": float(tx.net_tutar),
            "status": "success"
        }

    async def cancel_transaction(self, tx_id: int, reason: str):
        # Transaction cancellation logic logic (requires lookups across shards)
        # For now, it's a direct update on the main transaction table
        from app.repositories.finance.models import ShardedFinansIslem
        from sqlalchemy import update
        await self.db.execute(
            update(ShardedFinansIslem)
            .where(ShardedFinansIslem.id == tx_id)
            .values(durum='iptal', updated_by=self.context.user_id if self.context else None)
        )
        await self.db.commit()

    async def delete_transaction(self, tx_id: int):
        from app.repositories.finance.models import ShardedFinansIslem
        from sqlalchemy import update
        await self.db.execute(
            update(ShardedFinansIslem)
            .where(ShardedFinansIslem.id == tx_id)
            .values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
        )
        await self.db.commit()
