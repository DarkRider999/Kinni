"""
AI Image Generator Backend - Main Application Entry Point
FastAPI application with comprehensive safety, moderation, and admin features
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
import logging

from config.settings import settings
from middleware.auth import JWTAuthMiddleware
from middleware.audit import AuditLoggingMiddleware
from middleware.safety import SafetyEnforcementMiddleware
from api.routes import generator, safety, auth, gallery, vault, admin, creator, moderation

load_dotenv()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Image Generator Backend Starting")
    # Startup logic
    yield
    logger.info("AI Image Generator Backend Shutting Down")
    # Cleanup logic


app = FastAPI(
    title="AI Image Generator API",
    description="Enterprise-grade AI image generation with safety, moderation, and creator tools",
    version="1.0.0",
    lifespan=lifespan
)

# Trust proxy headers for production
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware stack (order matters)
app.add_middleware(AuditLoggingMiddleware)
app.add_middleware(SafetyEnforcementMiddleware)
app.add_middleware(JWTAuthMiddleware)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(generator.router, prefix="/api/v1/generator", tags=["Generator"])
app.include_router(safety.router, prefix="/api/v1/safety", tags=["Safety"])
app.include_router(gallery.router, prefix="/api/v1/gallery", tags=["Gallery"])
app.include_router(vault.router, prefix="/api/v1/vault", tags=["Vault"])
app.include_router(creator.router, prefix="/api/v1/creator", tags=["Creator Mode"])
app.include_router(moderation.router, prefix="/api/v1/moderation", tags=["Moderation"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
