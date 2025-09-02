from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "nicobar-analytics"
    # ENV: str = "DEV"
    MONGODB_URI: str = os.environ.get("MONGODB_URI")
    DB_NAME: str = "nicobar-analytics-db"
    NICOBAR_API_BASE: str = "https://bronco.nicobar.com"
    REDIS_URL: str | None = None  # "redis://localhost:6379/0"
    PRODUCT_TTL_SEC: int = 24*3600
    STOCK_TTL_SEC: int = 20*60

    class Config:
        env_file = ".env"

settings = Settings()
