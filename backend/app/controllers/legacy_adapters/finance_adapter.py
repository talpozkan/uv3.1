from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.orchestrators.finance_orchestrator import FinanceOrchestrator
from app.core.user_context import UserContext

class FinanceLegacyAdapter:
    """
    Adapter to bridge Legacy Finance API v1 to the Sharded Orchestrator.
    """
    def __init__(self, db: AsyncSession, context: Optional[UserContext] = None):
        self.orchestrator = FinanceOrchestrator(db, context)

    async def get_patient_transactions(self, hasta_id: str):
        # Transacton format must match legacy HastaFinansHareketResponse
        txs, count = await self.orchestrator.get_transactions_multi(patient_id=UUID(hasta_id))
        return txs

    async def get_patient_summary(self, hasta_id: str):
        return await self.orchestrator.get_patient_finance_summary(UUID(hasta_id))

    async def create_transaction(self, tx_data: dict):
        # Map legacy field names if necessary
        return await self.orchestrator.create_transaction_safely(tx_data)

    async def cancel_transaction(self, tx_id: int, reason: str):
        return await self.orchestrator.cancel_transaction(tx_id, reason)

    async def delete_transaction(self, tx_id: int):
        return await self.orchestrator.delete_transaction(tx_id)
