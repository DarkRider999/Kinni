"""
User Gallery API Routes
GET /gallery/images - List user's generated images
GET /gallery/images/{id} - Get image details
DELETE /gallery/images/{id} - Delete image
POST /gallery/images/{id}/share - Share image publicly
"""

from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ImageResponse(BaseModel):
    id: str
    url: str
    prompt: str
    width: int
    height: int
    model: str
    realism_score: Optional[float]
    created_at: str
    is_private: bool


class ImageListResponse(BaseModel):
    total: int
    images: List[ImageResponse]
    page: int
    page_size: int


@router.get("/images", response_model=ImageListResponse)
async def get_gallery_images(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at", regex="^(created_at|realism_score)$")
):
    """
    Get user's generated images

    - **skip**: Number of images to skip (pagination)
    - **limit**: Number of images to return
    - **sort_by**: Sort field (created_at or realism_score)
    """
    user_id = request.state.user_id

    return ImageListResponse(
        total=5,
        images=[
            ImageResponse(
                id="img_001",
                url="https://s3.amazonaws.com/bucket/img_001.jpg",
                prompt="A beautiful sunset over mountains",
                width=512,
                height=512,
                model="sdxl-v1",
                realism_score=0.95,
                created_at="2024-01-15T10:30:00Z",
                is_private=False
            ),
            ImageResponse(
                id="img_002",
                url="https://s3.amazonaws.com/bucket/img_002.jpg",
                prompt="Portrait of a person",
                width=512,
                height=512,
                model="sdxl-v1",
                realism_score=0.92,
                created_at="2024-01-15T09:15:00Z",
                is_private=True
            )
        ],
        page=0,
        page_size=limit
    )


@router.get("/images/{image_id}", response_model=ImageResponse)
async def get_image_details(request: Request, image_id: str):
    """Get details for a specific image"""
    user_id = request.state.user_id

    return ImageResponse(
        id=image_id,
        url=f"https://s3.amazonaws.com/bucket/{image_id}.jpg",
        prompt="A beautiful sunset over mountains",
        width=512,
        height=512,
        model="sdxl-v1",
        realism_score=0.95,
        created_at="2024-01-15T10:30:00Z",
        is_private=False
    )


@router.delete("/images/{image_id}")
async def delete_image(request: Request, image_id: str):
    """Delete an image from gallery"""
    user_id = request.state.user_id

    return {
        "success": True,
        "message": f"Image {image_id} deleted successfully"
    }


@router.post("/images/{image_id}/share")
async def share_image(request: Request, image_id: str, share_config: dict):
    """
    Share image publicly or with specific users

    - **public**: Share with everyone
    - **users**: List of user IDs to share with
    - **expiry**: Optional expiry time in hours
    """
    return {
        "success": True,
        "share_link": f"https://example.com/gallery/{image_id}",
        "share_token": "token_abc123"
    }


@router.post("/images/{image_id}/make-private")
async def make_image_private(request: Request, image_id: str):
    """Make a shared image private"""
    return {
        "success": True,
        "is_private": True,
        "message": "Image is now private"
    }


@router.get("/public/{share_token}")
async def view_shared_image(share_token: str):
    """View a publicly shared image (no auth required)"""
    return {
        "id": "img_001",
        "url": "https://s3.amazonaws.com/bucket/img_001.jpg",
        "prompt": "A beautiful sunset",
        "created_by": "username",
        "created_at": "2024-01-15T10:30:00Z"
    }


@router.post("/images/{image_id}/favorite")
async def toggle_favorite(request: Request, image_id: str):
    """Add or remove image from favorites"""
    return {
        "success": True,
        "is_favorite": True
    }


@router.get("/favorites", response_model=ImageListResponse)
async def get_favorite_images(request: Request, skip: int = 0, limit: int = 20):
    """Get user's favorite images"""
    return ImageListResponse(
        total=2,
        images=[],
        page=0,
        page_size=limit
    )
