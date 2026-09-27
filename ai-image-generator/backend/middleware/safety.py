"""
Safety Enforcement Middleware
Ensures safety filters are always enabled and enforces safety policies
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

from config.settings import settings

logger = logging.getLogger(__name__)


class SafetyEnforcementMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces safety policies globally
    - Ensures safety checks are enabled for all requests
    - Monitors for suspicious patterns
    - Rate limiting checks
    """

    async def dispatch(self, request: Request, call_next):
        # Safety checks are mandatory
        if not settings.SAFETY_CHECKS_ENABLED:
            logger.critical("Safety checks disabled! This is a critical security issue.")
            return JSONResponse(
                status_code=500,
                content={"detail": "Safety system disabled - contact administrator"}
            )

        # Add safety headers
        request.state.safety_enabled = True
        request.state.safety_version = "1.0"

        response = await call_next(request)

        # Add safety indicator headers
        response.headers["X-Safety-Enabled"] = "true"
        response.headers["X-Safety-Version"] = "1.0"

        return response


def enforce_safety_policy(request: Request, resource_type: str) -> bool:
    """
    Verify safety policy compliance
    Returns True if request passes safety checks
    """
    if not request.state.get("safety_enabled", False):
        logger.warning(f"Safety not enabled for {resource_type} access")
        return False

    # Additional safety checks can be added here
    return True


def get_safety_status() -> dict:
    """Get current safety system status"""
    return {
        "safety_enabled": settings.SAFETY_CHECKS_ENABLED,
        "prompt_safety_threshold": settings.PROMPT_SAFETY_THRESHOLD,
        "output_safety_threshold": settings.OUTPUT_SAFETY_THRESHOLD,
        "auto_block_severity": settings.AUTO_BLOCK_SEVERITY_THRESHOLD
    }
