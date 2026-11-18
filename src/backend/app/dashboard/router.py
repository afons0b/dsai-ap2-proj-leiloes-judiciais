from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dashboard import service
from app.dashboard.schemas import DashboardOut
from app.db import get_session
from app.security.deps import usuario_atual

router = APIRouter(
    prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(usuario_atual)]
)


@router.get("", response_model=DashboardOut)
async def obter(
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DashboardOut:
    return await service.obter(session, settings, datetime.now(UTC))
