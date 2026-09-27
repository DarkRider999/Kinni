"""
Super Admin API Routes
GET /admin/dashboard - System overview
GET /admin/moderation-queue - Moderation queue
GET /admin/users - User management
POST /admin/users/{id}/ban - Ban user
GET /admin/audit-logs - System audit logs
GET /admin/billing-overview - Billing overview
"""

from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class AdminDashboardResponse(BaseModel):
    total_users: int
    total_images_generated: int
    active_subscriptions: int
    flagged_images: int
    pending_reports: int
    system_health: str


class AdminModerationQueueResponse(BaseModel):
    total_pending: int
    high_severity_count: int
    entries: list


class AdminUserResponse(BaseModel):
    user_id: str
    email: str
    username: str
    role: str
    created_at: str
    is_active: bool
    is_banned: bool


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(request: Request):
    """
    Get system overview dashboard for super admin
    Requires super admin role and elevated privileges
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return AdminDashboardResponse(
        total_users=1250,
        total_images_generated=45320,
        active_subscriptions=340,
        flagged_images=23,
        pending_reports=8,
        system_health="healthy"
    )


@router.get("/moderation-queue", response_model=AdminModerationQueueResponse)
async def get_moderation_queue(
    request: Request,
    severity: int = Query(None, ge=1, le=10),
    status: str = Query("pending")
):
    """
    Get moderation queue with filtering
    Can filter by severity (1-10) and status
    """
    if request.state.user_role != "super_admin" and request.state.user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return AdminModerationQueueResponse(
        total_pending=12,
        high_severity_count=3,
        entries=[
            {
                "id": "mod_001",
                "image_id": "img_123",
                "severity": 8,
                "reason": "Potential NSFW content",
                "flagged_at": "2024-01-15T10:30:00Z",
                "status": "pending"
            },
            {
                "id": "mod_002",
                "image_id": "img_124",
                "severity": 5,
                "reason": "Potential copyright infringement",
                "flagged_at": "2024-01-15T09:15:00Z",
                "status": "pending"
            }
        ]
    )


@router.get("/users", response_model=list)
async def get_all_users(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    role: str = Query(None, regex="^(user|creator|admin|super_admin)$")
):
    """
    Get list of all users with filtering
    Super admin only
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return [
        AdminUserResponse(
            user_id="user_001",
            email="user1@example.com",
            username="user1",
            role="user",
            created_at="2024-01-01T00:00:00Z",
            is_active=True,
            is_banned=False
        )
    ]


@router.post("/users/{user_id}/ban")
async def ban_user(request: Request, user_id: str, ban_reason: dict):
    """
    Ban user from platform
    Requires super admin privileges
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "success": True,
        "user_id": user_id,
        "banned": True,
        "reason": ban_reason.get("reason")
    }


@router.post("/users/{user_id}/unban")
async def unban_user(request: Request, user_id: str):
    """Unban a previously banned user"""
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "success": True,
        "user_id": user_id,
        "banned": False
    }


@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    action: str = Query(None)
):
    """
    Get system audit logs
    Super admin only - comprehensive access logging
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "total": 5234,
        "logs": [
            {
                "id": "audit_001",
                "timestamp": "2024-01-15T10:30:00Z",
                "user_id": "user_001",
                "action": "generate_image",
                "resource_type": "image",
                "resource_id": "img_123",
                "status": "success"
            }
        ]
    }


@router.get("/billing-overview")
async def get_billing_overview(request: Request):
    """
    Get billing overview and revenue metrics
    Super admin only
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "total_mrr": 45000,
        "active_subscriptions": 340,
        "churn_rate": 0.02,
        "average_subscription_value": 132,
        "credit_pool_value": 50000,
        "pending_payouts": 12000
    }


@router.get("/system-logs")
async def get_system_logs(request: Request, log_level: str = "info"):
    """
    Get system logs for debugging
    Super admin only
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "logs": [
            "2024-01-15 10:30:00 - INFO - Image generation pipeline started",
            "2024-01-15 10:30:05 - INFO - Image generation completed successfully"
        ]
    }


@router.post("/credits/grant")
async def grant_credits_to_user(request: Request, grant_request: dict):
    """
    Grant credits to user (super admin can grant unlimited)
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "success": True,
        "user_id": grant_request.get("user_id"),
        "credits_granted": grant_request.get("amount"),
        "new_balance": 1000
    }


@router.get("/super-admin/stats")
async def get_super_admin_stats(request: Request):
    """
    Get detailed statistics dashboard for super admin
    Includes all system metrics
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "total_users": 1250,
        "total_images": 45320,
        "total_storage_gb": 2340,
        "api_calls_24h": 120500,
        "average_response_time_ms": 245,
        "uptime_percentage": 99.98,
        "security_events_24h": 3
    }
