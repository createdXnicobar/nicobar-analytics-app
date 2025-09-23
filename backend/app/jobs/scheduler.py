import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.mongo import get_db
from app.services.matching import link_trials_to_purchases_for_date
from app.services.aggregation import build_insights_for_date

IST = ZoneInfo("Asia/Kolkata")

async def _run_for_date(date_str: str):
    db = get_db()
    await link_trials_to_purchases_for_date(db, date_str)
    await build_insights_for_date(db, date_str)

async def _run_eod_yesterday():
    ist_now = datetime.now(IST)
    date_y = (ist_now - timedelta(days=1)).strftime("%Y-%m-%d")
    await _run_for_date(date_y)

async def _run_two_hourly_today():
    date_t = datetime.now(IST).strftime("%Y-%m-%d")
    print(date_t)
    await _run_for_date(date_t)

def start_scheduler(loop: asyncio.AbstractEventLoop | None = None) -> AsyncIOScheduler:
    """
    Start APScheduler bound to FastAPI/uvicorn's event loop.
    IMPORTANT: we register coroutine functions directly (no create_task),
    so the AsyncIOScheduler will await them on the provided loop.
    """
    if loop is None:
        loop = asyncio.get_event_loop()

    sched = AsyncIOScheduler(timezone=IST, event_loop=loop)

    # EOD: 00:10 IST daily
    sched.add_job(
        _run_eod_yesterday,  # <— coroutine function, no lambda
        CronTrigger(hour=0, minute=10, timezone=IST),
        id="eod_yesterday",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )

    # Every 10 minutes
    sched.add_job(
        _run_two_hourly_today,  # <— coroutine function, no lambda
        CronTrigger(minute="*/10", timezone=IST),
        id="two_hour_today",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )

    sched.start()
    return sched
