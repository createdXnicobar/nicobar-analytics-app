# app/routers/admin_jobs.py
from fastapi import APIRouter, Query
from datetime import datetime, timezone
from app.db.mongo import get_db
from app.services.matching import link_trials_to_purchases_for_date
from app.services.aggregation import build_insights_for_date

router = APIRouter(prefix="/jobs")

@router.post("/match")
async def job_match(date: str = Query(..., description="YYYY-MM-DD IST")):
    db = get_db()
    res = await link_trials_to_purchases_for_date(db, date)
    return res

@router.post("/aggregate")
async def job_aggregate(date: str = Query(..., description="YYYY-MM-DD IST")):
    db = get_db()
    res = await build_insights_for_date(db, date)
    return res
