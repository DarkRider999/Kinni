"""
Application Settings and Configuration
"""

from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Image Generator"
    DEBUG: bool = False
    VERSION: str = "1.0.0"

    # Server
    API_BASE_URL: str = "http://localhost:8000"
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/ai_image_generator"
    DATABASE_ECHO: bool = False

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SUPER_ADMIN_SESSION_EXPIRE_HOURS: int = 12

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET_NAME: str = "ai-image-generator-images"
    AWS_REGION: str = "us-east-1"

    # Encryption
    ENCRYPTION_KEY: str = ""
    VAULT_ENCRYPTION_ENABLED: bool = True

    # Safety
    SAFETY_CHECKS_ENABLED: bool = True
    PROMPT_SAFETY_THRESHOLD: float = 0.7
    OUTPUT_SAFETY_THRESHOLD: float = 0.8
    AUTO_BLOCK_SEVERITY_THRESHOLD: int = 8

    # Feature Flags
    WEBGPU_LOCAL_MODE_ENABLED: bool = True
    CREATOR_MODE_ENABLED: bool = True
    MODERATION_ENABLED: bool = True

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Admin
    REQUIRE_2FA_FOR_ADMIN: bool = True
    IP_RESTRICTION_ENABLED: bool = True
    SUSPICIOUS_ACTIVITY_DETECTION: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
