from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None

def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _client

def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[settings.DB_NAME]
    return _db

def col(name: str):
    return get_db()[name]

# handy handles
trial_events = lambda: col("trial_events")
purchase_events = lambda: col("purchase_events")
stores = lambda: col("stores")
insights_daily = lambda: col("insights_daily")
trial_purchase_links = lambda: col("trial_purchase_links")
