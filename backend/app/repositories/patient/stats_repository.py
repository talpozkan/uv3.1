from typing import Optional, Dict, List
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.clinical.models import (
    ShardedMuayene, ShardedOperasyon, ShardedClinicalNote, 
    ShardedTetkikSonuc, ShardedFotografArsivi
)
from app.models.documents import HastaDosya
from app.core.user_context import UserContext

class PatientStatsRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    async def get_counts(self, patient_id: UUID) -> Dict[str, int]:
        """Get record counts for various clinical categories for a patient using subqueries in a single call."""
        try:
            # Single query using lateral joins or subqueries
            stmt = select(
                select(func.count(ShardedMuayene.id)).where(ShardedMuayene.hasta_id == patient_id).scalar_subquery().label("muayene"),
                select(func.count(ShardedTetkikSonuc.id)).where(and_(ShardedTetkikSonuc.hasta_id == patient_id, ShardedTetkikSonuc.kategori == 'Goruntuleme')).scalar_subquery().label("imaging"),
                select(func.count(ShardedOperasyon.id)).where(ShardedOperasyon.hasta_id == patient_id).scalar_subquery().label("operation"),
                select(func.count(ShardedClinicalNote.id)).where(ShardedClinicalNote.hasta_id == patient_id).scalar_subquery().label("followup"),
                select(func.count(HastaDosya.id)).where(HastaDosya.hasta_id == patient_id).scalar_subquery().label("document"),
                select(func.count(ShardedFotografArsivi.id)).where(ShardedFotografArsivi.hasta_id == patient_id).scalar_subquery().label("photo")
            )
            
            res = await self.session.execute(stmt)
            row = res.fetchone()
            
            return {
                "muayene": row.muayene or 0,
                "imaging": row.imaging or 0,
                "operation": row.operation or 0,
                "followup": row.followup or 0,
                "document": row.document or 0,
                "photo": row.photo or 0
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "muayene": 0, "imaging": 0, "operation": 0, "followup": 0, "document": 0, "photo": 0
            }

    async def get_counts_batch(self, patient_ids: List[UUID]) -> Dict[UUID, Dict[str, int]]:
        """Fetch clinical record counts for multiple patients in bulk."""
        if not patient_ids:
            return {}
            
        async def fetch_counts(model):
            stmt = select(model.hasta_id, func.count(model.id).label("cnt")).where(
                and_(model.hasta_id.in_(patient_ids), getattr(model, 'is_deleted', False) == False)
            ).group_by(model.hasta_id)
            res = await self.session.execute(stmt)
            return {row.hasta_id: row.cnt for row in res.all()}

        # imaging needs extra filter for kategori
        imaging_stmt = select(ShardedTetkikSonuc.hasta_id, func.count(ShardedTetkikSonuc.id).label("cnt")).where(
            and_(ShardedTetkikSonuc.hasta_id.in_(patient_ids), ShardedTetkikSonuc.is_deleted == False, ShardedTetkikSonuc.kategori == 'Goruntuleme')
        ).group_by(ShardedTetkikSonuc.hasta_id)
        
        # document_count (HastaDosya)
        doc_stmt = select(HastaDosya.hasta_id, func.count(HastaDosya.id).label("cnt")).where(
            HastaDosya.hasta_id.in_(patient_ids)
        ).group_by(HastaDosya.hasta_id)

        import asyncio
        results = await asyncio.gather(
            fetch_counts(ShardedMuayene),
            self.session.execute(imaging_stmt),
            fetch_counts(ShardedOperasyon),
            fetch_counts(ShardedClinicalNote),
            self.session.execute(doc_stmt),
            fetch_counts(ShardedFotografArsivi)
        )
        
        mu_map = results[0]
        im_map = {row.hasta_id: row.cnt for row in results[1].all()}
        op_map = results[2]
        nt_map = results[3]
        dc_map = {row.hasta_id: row.cnt for row in results[4].all()}
        ph_map = results[5]
        
        batch_results = {}
        for pid in patient_ids:
            batch_results[pid] = {
                "muayene": mu_map.get(pid, 0),
                "imaging": im_map.get(pid, 0),
                "operation": op_map.get(pid, 0),
                "followup": nt_map.get(pid, 0),
                "document": dc_map.get(pid, 0),
                "photo": ph_map.get(pid, 0)
            }
        return batch_results
