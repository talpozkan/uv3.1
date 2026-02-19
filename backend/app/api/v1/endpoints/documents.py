from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
import shutil
import os
import uuid
import io
from PIL import Image

from app.api import deps
from app.models.documents import HastaDosya


router = APIRouter()

@router.post("/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Upload a document file.
    """
    try:
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Check if it's an image for compression
        image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp']
        
        if file_ext in image_extensions:
            # High Quality Compression logic as requested
            target_ext = '.jpg' if file_ext != '.webp' else file_ext
            unique_filename = f"{uuid.uuid4()}{target_ext}"
            file_path = f"static/documents/{unique_filename}"
            
            # Read file into memory
            file_content = await file.read()
            
            try:
                img = Image.open(io.BytesIO(file_content))
                
                # Keep original ICC profile for color accuracy
                icc_profile = img.info.get("icc_profile")
                
                # Convert to RGB if necessary (e.g. from RGBA or CMYK)
                if img.mode != "RGB":
                    img = img.convert("RGB")
                    
                # Step 1: Quality Resizing (max width 1920, maintain aspect ratio)
                base_width = 1920
                if img.size[0] > base_width:
                    w_percent = (base_width / float(img.size[0]))
                    h_size = int((float(img.size[1]) * float(w_percent)))
                    img = img.resize((base_width, h_size), Image.Resampling.LANCZOS)
                
                # Step 3: Save with high quality settings
                # quality=95, subsampling=0 (4:4:4) for best color retention
                img.save(
                    file_path, 
                    "JPEG", 
                    quality=95, 
                    icc_profile=icc_profile, 
                    subsampling=0,
                    optimize=True
                )
            except Exception as img_err:
                print(f"DEBUG_UPLOAD_IMG_ERROR: {img_err}")
                # Fallback to simple save if PIL fails
                with open(file_path, "wb") as buffer:
                    buffer.write(file_content)

        else:
            # Non-image files or skipped (PDF, etc.)
            file_path = f"static/documents/{unique_filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
        # Return URL (relative to base URL)
        return {
            "status": "success", 
            "url": f"/static/documents/{unique_filename}",
            "filename": file.filename
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patients/{hasta_id}/documents", response_model=List[dict])
async def read_documents(
    hasta_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Get all documents for a patient.
    """
    result = await db.execute(select(HastaDosya).filter(HastaDosya.hasta_id == hasta_id))
    docs = result.scalars().all()
    
    # Simple Dict conversion (or use Pydantic schema later)
    return [
        {
            "id": d.id,
            "hasta_id": d.hasta_id,
            "tarih": d.tarih,
            "kategori": d.kategori,
            "dosya_tipi": d.dosya_tipi,
            "dosya_adi": d.dosya_adi,
            "dosya_yolu": d.dosya_yolu,
            "aciklama": d.aciklama,
            "etiketler": d.etiketler,
            "arsiv_no": d.arsiv_no,
            "created_at": d.created_at
        } 
        for d in docs
    ]

@router.post("/documents", response_model=dict)
async def create_document(
    data: dict, # Simplified for now, expecting JSON body
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Create a new document record.
    """
    tarih_val = data.get('tarih')
    if tarih_val and isinstance(tarih_val, str):
        from datetime import datetime
        try:
            tarih_val = datetime.strptime(tarih_val, "%Y-%m-%d").date()
        except ValueError:
            tarih_val = datetime.fromisoformat(tarih_val).date()

    new_doc = HastaDosya(
        hasta_id=data['hasta_id'],
        tarih=tarih_val,
        kategori=data.get('kategori'),
        dosya_tipi=data.get('dosya_tipi'),
        dosya_adi=data.get('dosya_adi'),
        dosya_yolu=data.get('dosya_yolu'),
        aciklama=data.get('aciklama'),
        etiketler=data.get('etiketler'),
        arsiv_no=data.get('arsiv_no'),
        kaynak="MANUEL"
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    return {
        "id": new_doc.id,
        "status": "success"
    }

@router.put("/documents/{id}", response_model=dict)
async def update_document(
    id: int,
    data: dict,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Update a document record.
    """
    try:
        result = await db.execute(select(HastaDosya).filter(HastaDosya.id == id))
        doc = result.scalars().first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        if 'tarih' in data and data['tarih']: 
            # Ensure date is parsed if string
            from datetime import datetime
            val = data['tarih']
            if isinstance(val, str):
                try:
                    doc.tarih = datetime.strptime(val, "%Y-%m-%d").date()
                except ValueError:
                    # Fallback or try ISO format if needed
                     doc.tarih = datetime.fromisoformat(val).date()
            else:
                doc.tarih = val
            
        if 'kategori' in data: doc.kategori = data['kategori']
        if 'dosya_tipi' in data: doc.dosya_tipi = data['dosya_tipi']
        if 'dosya_adi' in data: doc.dosya_adi = data['dosya_adi']
        if 'dosya_yolu' in data: doc.dosya_yolu = data['dosya_yolu']
        if 'aciklama' in data: doc.aciklama = data['aciklama']
        if 'etiketler' in data: doc.etiketler = data['etiketler']
        if 'arsiv_no' in data: doc.arsiv_no = data['arsiv_no']

        await db.commit()
        await db.refresh(doc)
        
        return {
            "id": doc.id,
            "status": "updated"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

@router.get("/download/{id}")
async def download_document(
    id: int,
    db: AsyncSession = Depends(deps.get_db),
    token: str = None,
    download: int = 0
) -> Any:
    """
    Download/Serve a document.
    """
    # Verify token
    await deps.get_current_user_from_token(token=token, db=db)
    result = await db.execute(select(HastaDosya).filter(HastaDosya.id == id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = doc.dosya_yolu
    if not file_path:
        raise HTTPException(status_code=404, detail="File path not found in record")

    # Handle relative/absolute paths
    if file_path.startswith("/"):
        # Remove leading slash to make it relative to project root (e.g. static/...)
        relative_path = file_path[1:]
    else:
        relative_path = file_path
        
    if not os.path.exists(relative_path):
         raise HTTPException(status_code=404, detail=f"File not found on server: {relative_path}")
         
    media_type = "application/pdf" if relative_path.lower().endswith(".pdf") or (doc.dosya_tipi and "pdf" in doc.dosya_tipi.lower()) else None
    
    response = FileResponse(
        path=relative_path,
        media_type=media_type
    )
    
    if download == 1:
        filename = doc.dosya_adi or os.path.basename(relative_path)
        # Ensure filename has extension if missing
        if "." not in filename and "." in relative_path:
            filename += os.path.splitext(relative_path)[1]
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    else:
        response.headers["Content-Disposition"] = "inline"
        
    return response

@router.delete("/documents/{id}")
async def delete_document(
    id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Delete a document record.
    """
    try:
        # Direct delete query is safer with asyncpg to avoid attached/detached object state issues
        stmt = delete(HastaDosya).where(HastaDosya.id == id)
        result = await db.execute(stmt)
        if result.rowcount == 0:
             raise HTTPException(status_code=404, detail="Document not found")
        
        await db.commit()
        return {"status": "success", "id": id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download-path")
async def download_document_by_path(
    path: str,
    db: AsyncSession = Depends(deps.get_db),
    token: str = None,
    download: int = 0
) -> Any:
    """
    Download/Serve a document by its relative path (Compatibility mode).
    """
    # Verify token
    await deps.get_current_user_from_token(token=token, db=db)
    
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")

    # Security check: only allow paths inside static/
    if not (path.startswith("static/") or path.startswith("/static/")):
        raise HTTPException(status_code=403, detail="Access denied to this path")

    # Handle leading slash
    relative_path = path[1:] if path.startswith("/") else path
        
    if not os.path.exists(relative_path):
         raise HTTPException(status_code=404, detail=f"File not found on server: {relative_path}")
         
    media_type = "application/pdf" if relative_path.lower().endswith(".pdf") else None
    
    response = FileResponse(
        path=relative_path,
        media_type=media_type
    )
    
    if download == 1:
        filename = os.path.basename(relative_path)
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    else:
        response.headers["Content-Disposition"] = "inline"
        
    return response
