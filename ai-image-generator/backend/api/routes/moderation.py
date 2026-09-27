"""
Moderation System API Routes
GET /moderation/queue - Get moderation queue
POST /moderation/review - Submit moderation review
POST /moderation/report - Report content
GET /moderation/stats - Moderation statistics
"""

from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ModerationQueueEntryResponse(BaseModel):
    id: str
    image_id: str
    severity: int
    reason: str
    ai_recommendation: str
    flagged_at: str
    status: str


class ModerationReviewRequest(BaseModel):
    queue_entry_id: str
    action: str
    notes: Optional[str] = None
    severity_override: Optional[int] = None


class ModerationReviewResponse(BaseModel):
    review_id: str
    status: str
    action_taken: str
    message: str


class ReportContentRequest(BaseModel):
    image_id: str
    reason: str
    description: Optional[str] = None
    category: str


class ReportContentResponse(BaseModel):
    report_id: str
    status: str
    message: str


class ModerationStatsResponse(BaseModel):
    total_flagged: int
    high_severity_count: int
    auto_blocked: int
    pending_review: int
    approved_this_week: int
    rejected_this_week: int


@router.get("/queue", response_model=List[ModerationQueueEntryResponse])
async def get_moderation_queue(
    request: Request,
    severity: Optional[int] = Query(None, ge=1, le=10),
    status: str = Query("pending"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get moderation queue entries
    Admin and moderators only

    - **severity**: 1-10 scale (1=low, 10=critical)
    - **status**: "pending", "reviewing", "approved", "rejected", "banned"
    """
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return [
        ModerationQueueEntryResponse(
            id="mod_001",
            image_id="img_123",
            severity=8,
            reason="Potential NSFW content",
            ai_recommendation="BLOCK - High confidence explicit content",
            flagged_at="2024-01-15T10:30:00Z",
            status="pending"
        ),
        ModerationQueueEntryResponse(
            id="mod_002",
            image_id="img_124",
            severity=5,
            reason="Possible copyright infringement",
            ai_recommendation="REVIEW - Medium confidence violation",
            flagged_at="2024-01-15T09:15:00Z",
            status="pending"
        ),
        ModerationQueueEntryResponse(
            id="mod_003",
            image_id="img_125",
            severity=3,
            reason="Potentially misleading content",
            ai_recommendation="APPROVE - Low risk",
            flagged_at="2024-01-15T08:00:00Z",
            status="pending"
        )
    ]


@router.post("/review", response_model=ModerationReviewResponse)
async def submit_moderation_review(
    request: Request,
    review_request: ModerationReviewRequest
):
    """
    Submit moderation review decision

    - **action**: "approve", "reject", "ban_user", "flag_for_further_review"
    - **severity_override**: Override AI severity assessment (1-10)
    """
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    action_map = {
        "approve": "Content approved and published",
        "reject": "Content rejected and removed",
        "ban_user": "User banned from platform",
        "flag_for_further_review": "Flagged for legal review"
    }

    return ModerationReviewResponse(
        review_id="review_001",
        status="completed",
        action_taken=review_request.action,
        message=action_map.get(review_request.action, "Unknown action")
    )


@router.post("/report", response_model=ReportContentResponse)
async def report_content(
    request: Request,
    report_request: ReportContentRequest
):
    """
    Report problematic content by user

    - **category**: "nsfw", "violence", "harassment", "copyright", "misinformation"
    """
    user_id = request.state.user_id

    return ReportContentResponse(
        report_id="report_001",
        status="received",
        message="Thank you for your report. We will review it within 24 hours."
    )


@router.get("/stats", response_model=ModerationStatsResponse)
async def get_moderation_stats(request: Request):
    """
    Get moderation system statistics
    Admin only
    """
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return ModerationStatsResponse(
        total_flagged=342,
        high_severity_count=23,
        auto_blocked=12,
        pending_review=8,
        approved_this_week=45,
        rejected_this_week=18
    )


@router.get("/severity-breakdown")
async def get_severity_breakdown(request: Request):
    """Get breakdown of flagged content by severity"""
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "severity_distribution": {
            "1-2": 45,
            "3-4": 67,
            "5-6": 89,
            "7-8": 102,
            "9-10": 39
        },
        "most_common_reason": "NSFW content",
        "false_positive_rate": 0.08
    }


@router.post("/bulk-action")
async def perform_bulk_moderation_action(request: Request, bulk_action: dict):
    """
    Perform bulk moderation action on multiple items
    Super admin only

    - **action**: Action to apply to all items
    - **queue_entry_ids**: List of IDs to action
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "success": True,
        "items_processed": len(bulk_action.get("queue_entry_ids", [])),
        "action": bulk_action.get("action")
    }


@router.get("/reports")
async def get_user_reports(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get list of user reports about content
    Admin only
    """
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "total": 342,
        "reports": [
            {
                "report_id": "report_001",
                "reported_image_id": "img_123",
                "reporter_id": "user_001",
                "reason": "NSFW content",
                "status": "pending",
                "created_at": "2024-01-15T10:30:00Z"
            }
        ]
    }


@router.post("/auto-block")
async def trigger_auto_block(request: Request, auto_block_request: dict):
    """
    Manually trigger auto-block for specific content
    Super admin only
    """
    if request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    return {
        "success": True,
        "image_id": auto_block_request.get("image_id"),
        "blocked": True,
        "reason": "Manual super admin action"
    }


@router.get("/moderation-dashboard")
async def get_moderation_dashboard(request: Request):
    """
    Get moderation dashboard overview
    Admin and super admin only
    """
    if request.state.user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "active_cases": 8,
        "average_review_time_minutes": 15,
        "daily_flagged": 45,
        "weekly_trend": "increasing",
        "most_violated_policy": "NSFW content",
        "accuracy_score": 0.94,
        "team_members_active": 12
    }
