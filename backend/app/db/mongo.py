from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None

def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        logger.info("Initializing MongoDB client connection")
        try:
            _client = AsyncIOMotorClient(settings.MONGODB_URI)
            logger.info("MongoDB client connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    return _client

def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        logger.info(f"Initializing database connection to: {settings.DB_NAME}")
        try:
            _db = get_client()[settings.DB_NAME]
            logger.info(f"Database connection to '{settings.DB_NAME}' established")
        except Exception as e:
            logger.error(f"Failed to get database '{settings.DB_NAME}': {e}")
            raise
    return _db

def col(name: str):
    return get_db()[name]

# handy handles
trial_events = lambda: col("trial_events")
purchase_events = lambda: col("purchase_events")
stores = lambda: col("stores")
insights_daily = lambda: col("insights_daily")
trial_purchase_links = lambda: col("trial_purchase_links")
