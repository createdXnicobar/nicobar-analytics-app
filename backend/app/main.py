from fastapi import FastAPI
from app.routers import health, trials

def create_app():
    app = FastAPI(title="nicobar-analytics")
    app.include_router(health.router)
    app.include_router(trials.router)
    return app

app = create_app()