from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str 
    ENV: str = "dev"
    MONGODB_URI: str
    DB_NAME: str = "nicobar_analytics"  # Set a default value
    NICOBAR_API_BASE: str
    REDIS_URL: str | None = None
    PRODUCT_TTL_SEC: int = 24*3600
    STOCK_TTL_SEC: int = 20*60

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def mongodb_url(self) -> str:
        # Use the provided full URI directly
        return self.MONGODB_URI

settings = Settings()