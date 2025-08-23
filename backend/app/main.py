from fastapi import FastAPI
from app.routers import health, trials, pos_webhook

def create_app():
    app = FastAPI(title="nicobar-analytics")
    app.include_router(health.router)
    app.include_router(trials.router)
    app.include_router(pos_webhook.router)
    return app

app = create_app()