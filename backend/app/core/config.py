from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str 
    ENV: str = "dev"
    MONGODB_URI: str
    DB_NAME: str
    NICOBAR_API_BASE: str
    REDIS_URL: str | None = None  # "redis://localhost:6379/0"
    PRODUCT_TTL_SEC: int = 24*3600
    STOCK_TTL_SEC: int = 20*60

    class Config:
        env_file = ".env"
        extra = "ignore" # ignores any extra env vars defined in .env

settings = Settings()
