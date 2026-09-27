"""
Audit Logging Middleware
Logs all requests, responses, and state changes for compliance and security
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import json
from datetime import datetime
from typing import Optional
import uuid

logger = logging.getLogger(__name__)


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Capture request details
        method = request.method
        path = request.url.path
        user_id = getattr(request.state, "user_id", None)
        ip_address = request.client.host if request.client else "unknown"

        # Skip audit logging for health checks
        if path == "/health":
            return await call_next(request)

        # Log incoming request
        logger.info(
            f"REQUEST | ID: {request_id} | User: {user_id} | {method} {path} | IP: {ip_address}"
        )

        # Process request
        response = await call_next(request)

        # Log response
        logger.info(
            f"RESPONSE | ID: {request_id} | Status: {response.status_code} | {method} {path}"
        )

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response


def log_audit_event(
    user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    changes: Optional[dict] = None,
    ip_address: str = "unknown",
    status: str = "success"
):
    """
    Log audit event to database
    Typically called from services/handlers
    """
    audit_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "changes": changes,
        "ip_address": ip_address,
        "status": status
    }

    logger.info(f"AUDIT | {json.dumps(audit_entry)}")
    # This would normally be persisted to database via a service
    return audit_entry
