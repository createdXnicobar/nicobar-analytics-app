from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
from app.routers import health, trials, pos_webhook, admin_jobs, insights
from app.core.logging_config import setup_logging, get_logger

# Initialize logging
setup_logging()
logger = get_logger(__name__)

def create_app():
    logger.info("Creating FastAPI application")
    app = FastAPI(title="nicobar-analytics")
    
    # Add CORS middleware logging
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        
        # Log incoming request
        logger.info(f"Incoming request: {request.method} {request.url.path}")
        logger.debug(f"Request headers: {dict(request.headers)}")
        
        # Process request
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(f"Request completed: {request.method} {request.url.path} - "
                   f"Status: {response.status_code} - Duration: {process_time:.3f}s")
        
        return response
    
    # Include routers
    logger.info("Including API routers")
    app.include_router(health.router)
    app.include_router(trials.router)
    app.include_router(pos_webhook.router)
    app.include_router(admin_jobs.router)
    app.include_router(insights.router)
    
    logger.info("FastAPI application created successfully")
    return app

app = create_app()