from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.repositories.setting_repository import SettingRepository
from app.schemas.setting import SystemSetting, SystemSettingCreate

router = APIRouter()

@router.get("/", response_model=List[SystemSetting])
async def read_settings(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all system settings.
    """
    repo = SettingRepository(db)
    return await repo.get_all()

@router.get("/{key}", response_model=SystemSetting)
async def read_setting(
    key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific setting by key.
    """
    repo = SettingRepository(db)
    setting = await repo.get(key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.post("/", response_model=SystemSetting)
async def create_or_update_setting(
    setting_in: SystemSettingCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create or update a system setting.
    """
    repo = SettingRepository(db)
    return await repo.create_or_update(
        key=setting_in.key,
        value=setting_in.value,
        description=setting_in.description
    )

@router.post("/batch", response_model=List[SystemSetting])
async def batch_update_settings(
    settings_in: List[SystemSettingCreate],
    db: AsyncSession = Depends(get_db)
):
    """
    Update multiple settings at once.
    """
    repo = SettingRepository(db)
    results = []
    for s in settings_in:
        res = await repo.create_or_update(
            key=s.key,
            value=s.value,
            description=s.description
        )
        results.append(res)
    return results
