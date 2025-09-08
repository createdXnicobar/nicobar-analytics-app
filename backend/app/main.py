from fastapi import FastAPI
from app.routers import health, trials, pos_webhook, admin_jobs, insights

def create_app():
    app = FastAPI(title="nicobar-analytics")
    app.include_router(health.router)
    app.include_router(trials.router)
    app.include_router(pos_webhook.router)
    app.include_router(admin_jobs.router)
    app.include_router(insights.router)
    return app

app = create_app()