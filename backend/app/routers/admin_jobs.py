# app/routers/admin_jobs.py
from fastapi import APIRouter, Query, Header, HTTPException, Depends, BackgroundTasks
from app.core.config import settings
from app.core.logging_config import get_logger
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
IST = ZoneInfo("Asia/Kolkata")
from app.db.mongo import get_db
from app.services.matching import link_trials_to_purchases_for_date
from app.services.aggregation import build_insights_for_date

logger = get_logger(__name__)
router = APIRouter(prefix="/jobs")

def _require_admin(x_admin_token: str = Header(...)):
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        logger.warning("Unauthorized admin access attempt")
        raise HTTPException(status_code=401, detail="Unauthorized")

# Background job functions
async def _background_match_job(date: str):
    """Background task for matching job"""
    job_id = f"match_{date}_{datetime.now().strftime('%H%M%S')}"
    try:
        logger.info(f"Background matching job started for date: {date} [job_id: {job_id}]")
        db = get_db()
        # Use configured backward/forward windows
        res = await link_trials_to_purchases_for_date(
            db,
            date,
            backward_minutes=settings.TRIAL_MATCH_BACKWARD_MINUTES,
            forward_minutes=settings.TRIAL_MATCH_FORWARD_MINUTES,
        )
        logger.info(f"Background matching job completed for {date} [job_id: {job_id}]: {res}")
        
        # Store job result for monitoring (optional - store in database if needed)
        await _store_job_result(db, job_id, "match", date, "completed", res)
    except Exception as e:
        logger.error(f"Error in background matching job for {date} [job_id: {job_id}]: {str(e)}", exc_info=True)
        try:
            db = get_db()
            await _store_job_result(db, job_id, "match", date, "failed", {"error": str(e)})
        except:
            pass  # Don't fail the main job if logging fails

async def _background_aggregate_job(date: str):
    """Background task for aggregation job"""
    job_id = f"aggregate_{date}_{datetime.now().strftime('%H%M%S')}"
    try:
        logger.info(f"Background aggregation job started for date: {date} [job_id: {job_id}]")
        db = get_db()
        res = await build_insights_for_date(db, date)
        logger.info(f"Background aggregation job completed for {date} [job_id: {job_id}]: {res}")
        
        # Store job result for monitoring (optional - store in database if needed)
        await _store_job_result(db, job_id, "aggregate", date, "completed", res)
    except Exception as e:
        logger.error(f"Error in background aggregation job for {date} [job_id: {job_id}]: {str(e)}", exc_info=True)
        try:
            db = get_db()
            await _store_job_result(db, job_id, "aggregate", date, "failed", {"error": str(e)})
        except:
            pass  # Don't fail the main job if logging fails

async def _store_job_result(db, job_id: str, job_type: str, date: str, status: str, result: dict):
    """Store job execution result for monitoring purposes"""
    try:
        job_doc = {
            "jobId": job_id,
            "type": job_type,
            "date": date,
            "status": status,
            "result": result,
            "startedAt": datetime.now(),
            "completedAt": datetime.now()
        }
        await db.job_executions.insert_one(job_doc)
        logger.debug(f"Stored job result for {job_id}")
    except Exception as e:
        logger.warning(f"Failed to store job result for {job_id}: {e}")

@router.post("/match", dependencies=[Depends(_require_admin)])
async def job_match(background_tasks: BackgroundTasks, date: str = Query(..., description="YYYY-MM-DD IST")):
    logger.info(f"Queuing matching job for date: {date}")
    background_tasks.add_task(_background_match_job, date)
    return {"status": "accepted", "message": f"Matching job for {date} has been queued for processing"}

@router.post("/aggregate", dependencies=[Depends(_require_admin)])
async def job_aggregate(background_tasks: BackgroundTasks, date: str = Query(..., description="YYYY-MM-DD IST")):
    logger.info(f"Queuing aggregation job for date: {date}")
    background_tasks.add_task(_background_aggregate_job, date)
    return {"status": "accepted", "message": f"Aggregation job for {date} has been queued for processing"}

# Helper functions and endpoints to be called by EventBridge scheduler
def _today_ist() -> str: return datetime.now(IST).strftime("%Y-%m-%d")
def _yesterday_ist() -> str: return (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")

@router.get("/status", dependencies=[Depends(_require_admin)])
async def get_recent_job_status(limit: int = Query(10, ge=1, le=50)):
    """Get recent job execution status for monitoring"""
    try:
        db = get_db()
        # Get recent job executions, sorted by most recent first
        cursor = db.job_executions.find().sort("startedAt", -1).limit(limit)
        jobs = []
        async for job in cursor:
            jobs.append({
                "jobId": job.get("jobId"),
                "type": job.get("type"),
                "date": job.get("date"),
                "status": job.get("status"),
                "startedAt": job.get("startedAt"),
                "completedAt": job.get("completedAt"),
                "result": job.get("result", {})
            })
        
        return {
            "recent_jobs": jobs,
            "total_count": len(jobs)
        }
    except Exception as e:
        logger.error(f"Error fetching job status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/match-today", dependencies=[Depends(_require_admin)])
async def job_match_today(background_tasks: BackgroundTasks):
    today = _today_ist()
    logger.info(f"Queuing matching job for today: {today}")
    background_tasks.add_task(_background_match_job, today)
    return {"status": "accepted", "message": f"Matching job for today ({today}) has been queued for processing"}

@router.post("/aggregate-today", dependencies=[Depends(_require_admin)])
async def job_aggregate_today(background_tasks: BackgroundTasks):
    today = _today_ist()
    logger.info(f"Queuing aggregation job for today: {today}")
    background_tasks.add_task(_background_aggregate_job, today)
    return {"status": "accepted", "message": f"Aggregation job for today ({today}) has been queued for processing"}

@router.post("/match-yesterday", dependencies=[Depends(_require_admin)])
async def job_match_yesterday(background_tasks: BackgroundTasks):
    yesterday = _yesterday_ist()
    logger.info(f"Queuing matching job for yesterday: {yesterday}")
    background_tasks.add_task(_background_match_job, yesterday)
    return {"status": "accepted", "message": f"Matching job for yesterday ({yesterday}) has been queued for processing"}

@router.post("/aggregate-yesterday", dependencies=[Depends(_require_admin)])
async def job_aggregate_yesterday(background_tasks: BackgroundTasks):
    yesterday = _yesterday_ist()
    logger.info(f"Queuing aggregation job for yesterday: {yesterday}")
    background_tasks.add_task(_background_aggregate_job, yesterday)
    return {"status": "accepted", "message": f"Aggregation job for yesterday ({yesterday}) has been queued for processing"}
