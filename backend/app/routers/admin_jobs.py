# app/routers/admin_jobs.py
from fastapi import APIRouter, Query, Header, HTTPException, Depends
from app.core.config import settings
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
IST = ZoneInfo("Asia/Kolkata")
from app.db.mongo import get_db
from app.services.matching import link_trials_to_purchases_for_date
from app.services.aggregation import build_insights_for_date

router = APIRouter(prefix="/jobs")

def _require_admin(x_admin_token: str | None = Header(default=None)):
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

@router.post("/match", dependencies=[Depends(_require_admin)])
async def job_match(date: str = Query(..., description="YYYY-MM-DD IST")):
    db = get_db()
    res = await link_trials_to_purchases_for_date(db, date)
    return res

@router.post("/aggregate", dependencies=[Depends(_require_admin)])
async def job_aggregate(date: str = Query(..., description="YYYY-MM-DD IST")):
    db = get_db()
    res = await build_insights_for_date(db, date)
    return res

# Helper functions and endpoints to be called by EventBridge scheduler
def _today_ist() -> str: return datetime.now(IST).strftime("%Y-%m-%d")
def _yesterday_ist() -> str: return (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")

@router.post("/match-today", dependencies=[Depends(_require_admin)])
async def job_match_today():
    return await link_trials_to_purchases_for_date(get_db(), _today_ist())

@router.post("/aggregate-today", dependencies=[Depends(_require_admin)])
async def job_aggregate_today():
    return await build_insights_for_date(get_db(), _today_ist())

@router.post("/match-yesterday", dependencies=[Depends(_require_admin)])
async def job_match_yesterday():
    return await link_trials_to_purchases_for_date(get_db(), _yesterday_ist())

@router.post("/aggregate-yesterday", dependencies=[Depends(_require_admin)])
async def job_aggregate_yesterday():
    return await build_insights_for_date(get_db(), _yesterday_ist())
