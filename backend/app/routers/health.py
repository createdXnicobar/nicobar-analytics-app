from fastapi import APIRouter
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()

@router.get("/health")
async def health():
    logger.debug("Health check requested")
    return {"ok": True}
