from pydantic_settings import BaseSettings
import logging

# Use basic logging here since logging_config imports this module
logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    APP_NAME: str 
    ENV: str = "dev"
    MONGODB_URI: str
    DB_NAME: str
    NICOBAR_API_BASE: str
    REDIS_URL: str | None = None  # "redis://localhost:6379/0"
    PRODUCT_TTL_SEC: int = 24*3600
    STOCK_TTL_SEC: int = 20*60
    ADMIN_TOKEN: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore" # ignores any extra env vars defined in .env

try:
    settings = Settings()
    logger.info(f"Configuration loaded successfully for environment: {settings.ENV}")
    logger.debug(f"App name: {settings.APP_NAME}")
    logger.debug(f"Database name: {settings.DB_NAME}")
except Exception as e:
    logger.error(f"Failed to load configuration: {e}")
    raise
