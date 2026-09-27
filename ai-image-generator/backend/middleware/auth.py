"""
JWT Authentication Middleware
Handles token validation, role-based access control, and super admin rules
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from datetime import datetime, timedelta
import jwt
import logging
from typing import Optional

from config.settings import settings

logger = logging.getLogger(__name__)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    EXCLUDED_PATHS = {
        "/health",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
    }

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Authorization header missing"}
            )

        try:
            token = auth_header.replace("Bearer ", "")
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )

            # Check super admin session expiry (12 hours)
            if payload.get("role") == "super_admin":
                issued_at = datetime.fromtimestamp(payload.get("iat", 0))
                if datetime.utcnow() - issued_at > timedelta(hours=settings.SUPER_ADMIN_SESSION_EXPIRE_HOURS):
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Super admin session expired"}
                    )

            # Attach user info to request state
            request.state.user_id = payload.get("sub")
            request.state.user_role = payload.get("role", "user")
            request.state.token_payload = payload

        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token expired"}
            )
        except jwt.InvalidTokenError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid token"}
            )

        return await call_next(request)


def create_access_token(user_id: str, role: str, expires_in_minutes: Optional[int] = None):
    """Create JWT access token"""
    expires_in = expires_in_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=expires_in)

    to_encode = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }

    if role == "super_admin":
        # Super admin tokens have shorter expiry
        to_encode["exp"] = datetime.utcnow() + timedelta(hours=settings.SUPER_ADMIN_SESSION_EXPIRE_HOURS)
        to_encode["elevated_access"] = True

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify and decode JWT token"""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
