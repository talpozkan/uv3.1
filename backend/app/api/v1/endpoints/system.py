from typing import List, Any, Optional
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from app.core.limiter import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from fastapi_cache.decorator import cache
from app.repositories.system_repository import SystemRepository
from app.schemas.system import ICDTaniResponse, ICDTaniCreate

router = APIRouter()

@router.get("/icd", response_model=List[ICDTaniResponse])
@limiter.limit("30/minute")
@cache(expire=3600)
async def get_icds(
    request: Request,
    q: Optional[str] = Query(None, description="Search query for ICD code or name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Get ICD-10 codes, optionally searching by code or description.
    """
    repo = SystemRepository(db)
    return await repo.search_icd(q, skip, limit)

@router.post("/icd", response_model=ICDTaniResponse)
async def create_icd(
    obj_in: ICDTaniCreate,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Create a new ICD code entry.
    """
    repo = SystemRepository(db)
    # Check if already exists
    existing = await repo.get_icd_by_code(obj_in.kodu)
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="ICD code already exists")
    
    return await repo.create_icd(obj_in)

@router.post("/icd/delete-batch")
async def batch_delete_icd(
    ids: List[int],
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Batch delete ICD records.
    """
    repo = SystemRepository(db)
    await repo.delete_icds(ids)
    return {"status": "success", "deleted_count": len(ids)}

# --- Drugs (İlaçlar) ---

from app.schemas.system import IlacResponse
from fastapi import UploadFile, File

@router.get("/drugs", response_model=List[IlacResponse])
@limiter.limit("60/minute")
@cache(expire=300)
async def get_drugs(
    request: Request,
    q: Optional[str] = Query(None, description="Search drug by name, barcode or active ingredient"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    repo = SystemRepository(db)
    return await repo.search_drugs(q, skip, limit)

@router.post("/drugs/upload")
async def upload_drugs_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Complete replacement of drug database from Excel file.
    Expected columns: 'İlaç Adı', 'Barkod', 'Etkin Madde', 'ATC Kodu', 'Firma', 'Fiyat', 'Reçete Tipi'
    """
    # Read file
    content = await file.read()
    
    import pandas as pd
    import io

    try:
        # Try finding mimetype or just try excel
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        else:
            # CSV Handling with robust encoding/separator detection
            encodings = ['utf-8', 'cp1254', 'latin1']
            separators = [',', ';', '\t']
            
            df = None
            last_error = None
            
            for encoding in encodings:
                for sep in separators:
                    try:
                        # Try reading
                        temp_df = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding)
                        
                        # Basic validation: Check if we have multiple columns or known headers
                        # If we have only 1 column, it might be a wrong separator, unless the file has only 1 column
                        if len(temp_df.columns) > 1:
                            df = temp_df
                            break
                        
                        # If we have 1 column but it contains specific keywords, accept it
                        # But usually drug files have multiple columns
                        if 'ilah' in temp_df.columns[0].lower() or 'drug' in temp_df.columns[0].lower() or 'barkod' in temp_df.columns[0].lower():
                             df = temp_df
                             break
                             
                    except Exception as e:
                        last_error = e
                        continue
                if df is not None:
                    break
            
            if df is None:
                # Fallback to python engine with auto detection
                try:
                    df = pd.read_csv(io.BytesIO(content), sep=None, engine='python')
                except:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=400, detail=f"Dosya okunamadı. Lütfen CSV formatını kontrol edin. (Hata: {str(last_error)})")

    except Exception as e:
        # If we caught it above strictly, this might be redundant for read errors but needed for syntax
        # Check if it is already an HTTPException
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Dosya islenirken hata: {str(e)}")
    
    # Normalize columns
    # We expect some variations, so let's try to map
    column_map = {
        "İlaç Adı": "name",
        "Piyasa Adı": "name",
        "Adı": "name",
        "Barkod": "barcode",
        "Barkodu": "barcode",
        "Etkin Madde": "etkin_madde",
        "ATC Kodu": "atc_kodu",
        "ATC": "atc_kodu",
        "Firma": "firma",
        "Firma Adı": "firma",
        "Fiyat": "fiyat",
        "Reçete Tipi": "recete_tipi",
        "Reçete Türü": "recete_tipi"
    }
    
    df = df.rename(columns=column_map)
    
    # Ensure 'name' exists
    if 'name' not in df.columns:
        # If we can't find name column, try the first column
        df['name'] = df.iloc[:, 0]
    
    # Fill NaNs
    df = df.fillna("")
    
    # Prepare list of dicts
    drugs_data = []
    
    # Limit to reasonable amount if huge? or just process all.
    # Let's process batches if needed, but for now just all.
    
    for _, row in df.iterrows():
        name = str(row.get('name', '')).strip()
        if not name:
            continue
            
        drug = {
            "name": name,
            "barcode": str(row.get('barcode', '')).strip() if row.get('barcode') else None,
            "etkin_madde": str(row.get('etkin_madde', '')).strip() if row.get('etkin_madde') else None,
            "atc_kodu": str(row.get('atc_kodu', '')).strip() if row.get('atc_kodu') else None,
            "firma": str(row.get('firma', '')).strip() if row.get('firma') else None,
            "fiyat": str(row.get('fiyat', '')).strip() if row.get('fiyat') else None,
            "recete_tipi": str(row.get('recete_tipi', '')).strip() if row.get('recete_tipi') else "Normal",
            "aktif": True
        }
        drugs_data.append(drug)
            
    # clear existing
    repo = SystemRepository(db)
    await repo.delete_all_drugs()
    
    # insert new
    count = await repo.batch_create_drugs(drugs_data)
    
    return {"status": "success", "imported_count": count}

