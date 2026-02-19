from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from app.models.system import ICDTani
from app.schemas.system import ICDTaniCreate

class SystemRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_icd(self, query: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[ICDTani]:
        stmt = select(ICDTani)
        if query:
            stmt = stmt.where(
                or_(
                    ICDTani.kodu.ilike(f"{query}%"),
                    ICDTani.adi.ilike(f"%{query}%")
                )
            )
        stmt = stmt.order_by(ICDTani.kodu).offset(skip).limit(limit)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_icd_by_code(self, code: str) -> Optional[ICDTani]:
        result = await self.db.execute(select(ICDTani).filter(ICDTani.kodu == code))
        return result.scalars().first()

    async def create_icd(self, obj_in: ICDTaniCreate) -> ICDTani:
        db_obj = ICDTani(
            kodu=obj_in.kodu,
            adi=obj_in.adi,
            ust_kodu=obj_in.ust_kodu,
            aktif=obj_in.aktif or "1",
            seviye=obj_in.seviye or "2"
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete_icds(self, ids: List[int]) -> bool:
        from sqlalchemy import delete
        stmt = delete(ICDTani).where(ICDTani.id.in_(ids))
        await self.db.execute(stmt)
        await self.db.commit()
        return True

    async def search_drugs(self, query: Optional[str] = None, skip: int = 0, limit: int = 50):
        from app.models.system import IlacTanim
        from sqlalchemy import or_, select
        
        stmt = select(IlacTanim)
        if query:
            query = query.strip()
            # Alternatif sorgular oluştur (Türkçe karakter sorunlarını aşmak için)
            # Postgres ilike bazen i/İ ve ı/I eşleşmelerinde sorun yaşayabiliyor locale ayarına göre
            q_lower = query.lower()
            q_upper = query.upper()
            
            # Türkçe karakter mappingleri
            q_tr_upper = query.replace('i', 'İ').replace('ı', 'I').upper()
            q_tr_lower = query.replace('İ', 'i').replace('I', 'ı').lower()
            
            stmt = stmt.where(
                or_(
                    IlacTanim.name.ilike(f"%{query}%"),
                    IlacTanim.name.ilike(f"%{q_lower}%"),
                    IlacTanim.name.ilike(f"%{q_upper}%"),
                    IlacTanim.name.ilike(f"%{q_tr_upper}%"),
                    IlacTanim.name.ilike(f"%{q_tr_lower}%"),
                    IlacTanim.barcode.ilike(f"%{query}%"),
                    IlacTanim.etkin_madde.ilike(f"%{query}%"),
                    IlacTanim.etkin_madde.ilike(f"%{q_tr_upper}%")
                )
            )
        stmt = stmt.order_by(IlacTanim.name).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create_drug(self, obj_in):
        from app.models.system import IlacTanim
        db_obj = IlacTanim(
            name=obj_in.name,
            barcode=obj_in.barcode,
            etkin_madde=obj_in.etkin_madde,
            atc_kodu=obj_in.atc_kodu,
            fiyat=obj_in.fiyat,
            firma=obj_in.firma,
            recete_tipi=obj_in.recete_tipi,
            aktif=obj_in.aktif
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete_all_drugs(self):
        from app.models.system import IlacTanim
        from sqlalchemy import delete
        stmt = delete(IlacTanim)
        await self.db.execute(stmt)
        await self.db.commit()

    async def batch_create_drugs(self, drugs_data: List[dict]):
        from app.models.system import IlacTanim
        from sqlalchemy import insert
        
        if not drugs_data:
            return 0
            
        # Optimize with Core Insert
        # Chunking might be necessary if too large, but 10k is usually fine for one statement
        # SQLite has variable limit, Postgres is fine.
        # Let's chunk it safely to 1000
        
        CHUNK_SIZE = 1000
        total = 0
        
        for i in range(0, len(drugs_data), CHUNK_SIZE):
            chunk = drugs_data[i:i + CHUNK_SIZE]
            stmt = insert(IlacTanim).values(chunk)
            await self.db.execute(stmt)
            total += len(chunk)
            
        await self.db.commit()
        return total
