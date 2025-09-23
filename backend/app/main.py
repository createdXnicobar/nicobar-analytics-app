from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
from app.routers import health, trials, pos_webhook, admin_jobs, insights
from app.core.config import settings  # has ENABLE_SCHEDULER (bool)

@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = None
    if getattr(settings, "ENABLE_SCHEDULER", False):
        from app.jobs.scheduler import start_scheduler
        loop = asyncio.get_running_loop()  # <-- the loop uvicorn is using
        sched = start_scheduler(loop)
    try:
        yield
    finally:
        if sched:
            sched.shutdown(wait=False)

def create_app():
    app = FastAPI(title="nicobar-analytics", lifespan=lifespan)
    app.include_router(health.router)
    app.include_router(trials.router)
    app.include_router(pos_webhook.router)
    app.include_router(admin_jobs.router)
    app.include_router(insights.router)
    return app

app = create_app()