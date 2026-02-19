from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.clinical.models import (
    ShardedMuayene, ShardedOperasyon, ShardedClinicalNote, ShardedTelefonGorusmesi,
    ShardedTetkikSonuc, ShardedFotografArsivi, ShardedIstirahatRaporu,
    ShardedDurumBildirirRaporu, ShardedTibbiMudahaleRaporu
)
from app.models.appointment import Randevu
from app.models.documents import HastaDosya
from app.models.finance import HastaFinansHareket
from app.core.user_context import UserContext

class PatientTimelineRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    async def get_timeline(self, patient_id: UUID) -> List[Dict[str, Any]]:
        """Aggregates and sorts all patient events into a unified timeline."""
        timeline = []
        
        # Aggregate across domains
        timeline.extend(await self._get_appointment_events(patient_id))
        timeline.extend(await self._get_finance_events(patient_id))
        timeline.extend(await self._get_clinical_events(patient_id))
        timeline.extend(await self._get_lab_events(patient_id))
        timeline.extend(await self._get_document_events(patient_id))
        timeline.extend(await self._get_note_events(patient_id))
        timeline.extend(await self._get_report_events(patient_id))

        # Final Sorting
        timeline.sort(key=self._get_sort_key, reverse=True)
        return timeline

    def _safe_time(self, dt: Any) -> Optional[str]:
        if not dt or not isinstance(dt, datetime): return None
        return dt.strftime("%H:%M")

    def _get_sort_key(self, x: Dict) -> datetime:
        rd = x.get('raw_date')
        if rd is None: return datetime.min
        if isinstance(rd, datetime): return rd.replace(tzinfo=None)
        if isinstance(rd, date): return datetime.combine(rd, datetime.min.time())
        return datetime.min

    async def _get_appointment_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        res = await self.session.execute(select(Randevu).filter(Randevu.hasta_id == patient_id))
        for item in res.scalars().all():
            status_label = "Planlandı"
            status_type = "appointment"
            desc = item.title or 'Planlanmış Randevu'
            
            if item.status == "completed": status_label = "Tamamlandı"
            elif item.status == "cancelled":
                status_label = "İptal Edildi"
                status_type = "appointment_cancelled"
                reason = item.cancel_reason or item.delete_reason or "Belirtilmedi"
                desc = f"İPTAL: {desc} (Gerekçe: {reason})"

            events.append({
                "id": f"appt_{item.id}", "date": item.start, "type": status_type,
                "title": "Randevu", "description": desc, "personnel": item.doctor_name,
                "status": status_label, "time": self._safe_time(item.start), "raw_date": item.start
            })
        return events

    async def _get_finance_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        res = await self.session.execute(select(HastaFinansHareket).filter(HastaFinansHareket.hasta_id == patient_id))
        for item in res.scalars().all():
            title = "Ödeme" if item.islem_tipi == "TAHSILAT" else "Hizmet"
            amount = float(item.alacak) if item.islem_tipi == "TAHSILAT" else float(item.borc)
            events.append({
                "id": f"fin_{item.id}", "date": item.tarih, "type": "payment" if item.islem_tipi == "TAHSILAT" else "service",
                "title": title, "description": item.aciklama or title, "personnel": item.doktor,
                "status": "Tamamlandı", "amount": amount, "time": self._safe_time(item.tarih), "raw_date": item.tarih
            })
        return events

    async def _get_clinical_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        # Muayene
        res = await self.session.execute(select(ShardedMuayene).filter(ShardedMuayene.hasta_id == patient_id))
        for item in res.scalars().all():
            dt = datetime.combine(item.tarih, datetime.min.time()) if item.tarih else None
            events.append({
                "id": f"clin_{item.id}", "date": dt, "type": "examination", "title": "Muayene",
                "description": item.sikayet or "Genel Muayene", "personnel": item.doktor,
                "status": "Tamamlandı", "time": None, "raw_date": dt
            })
        # Operations
        res_op = await self.session.execute(select(ShardedOperasyon).filter(ShardedOperasyon.hasta_id == patient_id))
        for item in res_op.scalars().all():
            dt = datetime.combine(item.tarih, datetime.min.time()) if item.tarih else None
            events.append({
                "id": f"op_{item.id}", "date": dt, "type": "operation", "title": "Operasyon",
                "description": item.ameliyat or "Operasyon Kaydı", "personnel": getattr(item, 'ekip', None) or getattr(item, 'hemsire', None),
                "status": "Tamamlandı", "time": None, "raw_date": dt
            })
        return events

    async def _get_lab_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        # TetkikSonuc (Unified)
        res = await self.session.execute(select(ShardedTetkikSonuc).filter(ShardedTetkikSonuc.hasta_id == patient_id))
        for item in res.scalars().all():
            dt = datetime.combine(item.tarih, datetime.min.time()) if item.tarih else None
            events.append({
                "id": f"lab_{item.id}", "date": dt, "type": "lab" if item.kategori != "Goruntuleme" else "imaging",
                "title": "Laboratuvar" if item.kategori != "Goruntuleme" else "Görüntüleme",
                "description": item.tetkik_adi or "Tetkik Sonucu", "personnel": None, # doktor field might be missing in sharded model used for migration
                "status": "Tamamlandı", "time": None, "raw_date": dt
            })
        return events

    async def _get_document_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        res = await self.session.execute(select(HastaDosya).filter(HastaDosya.hasta_id == patient_id))
        for item in res.scalars().all():
            events.append({
                "id": f"doc_{item.id}", "date": item.created_at, "type": "document", "title": "Belge Arşivi",
                "description": item.dosya_adi or "Belge", "personnel": None, "status": "Yüklendi",
                "time": self._safe_time(item.created_at), "raw_date": item.created_at
            })
        return events

    async def _get_note_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        res = await self.session.execute(select(ShardedClinicalNote).filter(ShardedClinicalNote.hasta_id == patient_id))
        for item in res.scalars().all():
            dt = datetime.combine(item.tarih, datetime.min.time()) if item.tarih else None
            events.append({
                "id": f"note_{item.id}", "date": dt, "type": "followup", "title": "Takip Notu",
                "description": item.icerik or "Not Kaydı", "personnel": None, "status": item.tip or "Bilgi",
                "time": None, "raw_date": dt
            })
        return events

    async def _get_report_events(self, patient_id: UUID) -> List[Dict]:
        events = []
        # IstirahatRaporu
        res = await self.session.execute(select(ShardedIstirahatRaporu).filter(ShardedIstirahatRaporu.hasta_id == patient_id))
        for item in res.scalars().all():
            dt = datetime.combine(item.tarih, datetime.min.time()) if item.tarih else None
            events.append({
                "id": f"rep_ist_{item.id}", "date": dt, "type": "report", "title": "İstirahat Raporu",
                "description": item.tani or "Rapor Kaydı", "personnel": None, "status": "Düzenlendi",
                "time": None, "raw_date": dt
            })
        return events
