from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/aifamily"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # AI Model (primary)
    MODEL_BASE_URL: str = "https://api.deepseek.com/v1"
    MODEL_API_KEY: str = ""
    MODEL_NAME: str = "deepseek-chat"

    # AI Model (fallback)
    FALLBACK_MODEL_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    FALLBACK_MODEL_API_KEY: str = ""
    FALLBACK_MODEL_NAME: str = "qwen-max"

    # Embedding (阿里云 DashScope)
    EMBEDDING_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-v3"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
