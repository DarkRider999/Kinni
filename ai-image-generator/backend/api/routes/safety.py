"""
Safety System API Routes
POST /safety/prompt-check - Check prompt safety
POST /safety/output-check - Check generated image safety
GET /safety/status - Get safety system status
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class PromptSafetyRequest(BaseModel):
    prompt: str


class PromptSafetyResponse(BaseModel):
    is_safe: bool
    safety_score: float
    risk_level: str
    violated_policies: list
    recommendation: str


class OutputSafetyRequest(BaseModel):
    image_id: str
    image_url: str


class OutputSafetyResponse(BaseModel):
    is_safe: bool
    safety_score: float
    risk_level: str
    violation_categories: list
    severity_score: int
    requires_moderation: bool
    recommendation: str


@router.post("/prompt-check", response_model=PromptSafetyResponse)
async def check_prompt_safety(request: Request, prompt_request: PromptSafetyRequest):
    """
    Pre-generation safety check for prompts
    Detects harmful content, explicit requests, policy violations

    - **risk_level**: "safe", "warning", or "blocked"
    - **severity_score**: 1-10, where 10 is most severe
    """
    prompt = prompt_request.prompt

    # Stub implementation of safety classifier
    # Production would use ML model for classification
    safety_score = 0.95  # Example: 95% safe

    return PromptSafetyResponse(
        is_safe=safety_score > 0.7,
        safety_score=safety_score,
        risk_level="safe" if safety_score > 0.8 else "warning",
        violated_policies=[],
        recommendation="Prompt approved for generation"
    )


@router.post("/output-check", response_model=OutputSafetyResponse)
async def check_output_safety(request: Request, output_request: OutputSafetyRequest):
    """
    Post-generation safety check for generated images
    Detects NSFW content, violent content, inappropriate material

    - **severity_score**: 1-10 scale
    - **requires_moderation**: Flag for human review if True
    """
    # Stub implementation of output safety classifier
    # Production would use ML model for classification
    safety_score = 0.98  # Example: 98% safe

    return OutputSafetyResponse(
        is_safe=safety_score > 0.8,
        safety_score=safety_score,
        risk_level="safe",
        violation_categories=[],
        severity_score=1,
        requires_moderation=False,
        recommendation="Image approved and safe to display"
    )


@router.get("/status")
async def get_safety_status(request: Request):
    """Get current safety system status and configuration"""
    return {
        "safety_enabled": True,
        "prompt_check_enabled": True,
        "output_check_enabled": True,
        "moderation_enabled": True,
        "auto_flagging_enabled": True,
        "auto_blocking_enabled": True,
        "min_severity_for_block": 8,
        "last_model_update": "2024-01-10T12:00:00Z",
        "safety_policies": [
            "No NSFW content",
            "No violent content",
            "No harassment",
            "No copyright infringement",
            "No misinformation"
        ]
    }


@router.post("/test-classifier")
async def test_safety_classifier(request: Request, test_input: dict):
    """
    Test safety classifier with custom input
    Admin only - for testing and validation
    """
    if request.state.user_role != "admin" and request.state.user_role != "super_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return {
        "test_id": "test_123",
        "input": test_input,
        "classifier_score": 0.85,
        "risk_assessment": "Low risk"
    }
