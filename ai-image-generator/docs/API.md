# AI Image Generator - API Documentation

## Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.example.com/api/v1`

## Authentication

All endpoints (except auth and health) require JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow this format:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Internal Server Error

## Endpoints

### Authentication

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "secure_password",
  "age_verified": true
}

Response: 201
{
  "user_id": "user_123",
  "email": "user@example.com",
  "username": "username"
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response: 200
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 1800,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### Image Generation

#### Create Image
```
POST /generator/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "A beautiful sunset over mountains",
  "width": 512,
  "height": 512,
  "realism_score": 0.8,
  "pose_preset": "standing",
  "lighting_preset": "studio",
  "use_webgpu_local": false,
  "num_inference_steps": 50,
  "guidance_scale": 7.5
}

Response: 200
{
  "image_id": "img_123456",
  "image_url": "https://s3.amazonaws.com/bucket/img_123456.jpg",
  "width": 512,
  "height": 512,
  "created_at": "2024-01-15T10:30:00Z",
  "realism_score": 0.8,
  "generation_time_ms": 3500
}
```

#### Get Available Styles
```
GET /generator/styles
Authorization: Bearer <token>

Response: 200
{
  "styles": [
    {
      "id": "photorealistic",
      "name": "Photorealistic",
      "description": "High realism style"
    }
  ],
  "pose_presets": [...],
  "lighting_presets": [...]
}
```

### Safety System

#### Check Prompt Safety
```
POST /safety/prompt-check
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "A landscape image"
}

Response: 200
{
  "is_safe": true,
  "safety_score": 0.95,
  "risk_level": "safe",
  "violated_policies": [],
  "recommendation": "Prompt approved for generation"
}
```

#### Check Output Safety
```
POST /safety/output-check
Authorization: Bearer <token>
Content-Type: application/json

{
  "image_id": "img_123456",
  "image_url": "https://s3.amazonaws.com/bucket/img_123456.jpg"
}

Response: 200
{
  "is_safe": true,
  "safety_score": 0.98,
  "risk_level": "safe",
  "violation_categories": [],
  "severity_score": 1,
  "requires_moderation": false,
  "recommendation": "Image approved and safe to display"
}
```

### Gallery

#### List User Images
```
GET /gallery/images?skip=0&limit=20&sort_by=created_at
Authorization: Bearer <token>

Response: 200
{
  "total": 127,
  "images": [
    {
      "id": "img_001",
      "url": "https://s3.amazonaws.com/bucket/img_001.jpg",
      "prompt": "Beautiful sunset",
      "width": 512,
      "height": 512,
      "created_at": "2024-01-15T10:30:00Z",
      "is_private": false
    }
  ],
  "page": 0,
  "page_size": 20
}
```

### Personal Vault

#### Setup Vault
```
POST /vault/setup
Authorization: Bearer <token>

Response: 200
{
  "vault_initialized": true,
  "encrypted_key_stored": true,
  "pin_required": false
}
```

#### Store Vault Item
```
POST /vault/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "image_id": "img_123",
  "content_type": "image",
  "requires_pin": true,
  "panic_hide_enabled": true
}

Response: 201
{
  "id": "vault_item_123",
  "content_type": "image",
  "is_pinned": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Creator Mode

#### Create Creator Profile
```
POST /creator/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Artist Name",
  "bio": "Professional digital artist",
  "profile_picture_url": "https://example.com/pic.jpg"
}

Response: 201
{
  "profile_id": "creator_001",
  "display_name": "Artist Name",
  "identity_verified": false,
  "consent_signed": false,
  "profile_url": "https://example.com/creator/user_123"
}
```

#### Submit Identity Verification
```
POST /creator/verify-identity
Authorization: Bearer <token>
Content-Type: application/json

{
  "document_type": "passport",
  "document_url": "https://s3.amazonaws.com/bucket/doc.jpg",
  "consent_agreed": true
}

Response: 200
{
  "verification_id": "verify_001",
  "status": "pending_review",
  "message": "Identity verification submitted"
}
```

### Admin Dashboard (Super Admin Only)

#### Get Dashboard
```
GET /admin/dashboard
Authorization: Bearer <super_admin_token>

Response: 200
{
  "total_users": 1250,
  "total_images_generated": 45320,
  "active_subscriptions": 340,
  "flagged_images": 23,
  "pending_reports": 8,
  "system_health": "healthy"
}
```

#### Get Moderation Queue
```
GET /admin/moderation-queue?severity=8&status=pending
Authorization: Bearer <super_admin_token>

Response: 200
{
  "total_pending": 12,
  "high_severity_count": 3,
  "entries": [
    {
      "id": "mod_001",
      "image_id": "img_123",
      "severity": 8,
      "reason": "Potential NSFW content",
      "ai_recommendation": "BLOCK",
      "status": "pending"
    }
  ]
}
```

#### Ban User
```
POST /admin/users/{user_id}/ban
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "reason": "Violation of terms of service"
}

Response: 200
{
  "success": true,
  "user_id": "user_123",
  "banned": true,
  "reason": "Violation of terms of service"
}
```

### Moderation

#### Get Moderation Queue
```
GET /moderation/queue?severity=5&status=pending&skip=0&limit=50
Authorization: Bearer <admin_token>

Response: 200
{
  "total_pending": 12,
  "high_severity_count": 3,
  "entries": [
    {
      "id": "mod_001",
      "image_id": "img_123",
      "severity": 8,
      "reason": "Potential NSFW content",
      "ai_recommendation": "BLOCK - High confidence explicit content",
      "flagged_at": "2024-01-15T10:30:00Z",
      "status": "pending"
    }
  ]
}
```

#### Submit Moderation Review
```
POST /moderation/review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "queue_entry_id": "mod_001",
  "action": "approve",
  "notes": "Image approved after review",
  "severity_override": 2
}

Response: 200
{
  "review_id": "review_001",
  "status": "completed",
  "action_taken": "approve",
  "message": "Content approved and published"
}
```

## Rate Limiting

- Default: 100 requests per 60 seconds per IP
- Headers included in response:
  - `X-RateLimit-Limit`: Max requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time until reset

## Pagination

Most list endpoints support:
- `skip`: Number of items to skip (default: 0)
- `limit`: Number of items to return (default: 20, max: 100)

Example:
```
GET /gallery/images?skip=20&limit=20
```

## Filtering and Sorting

Endpoints support:
- `sort_by`: Field to sort by
- `order`: "asc" or "desc"
- Field-specific filters

Example:
```
GET /gallery/images?sort_by=created_at&order=desc
```

## WebGPU Local Mode

Initialize local mode for offline generation:
```
POST /generator/local-mode/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "enable_optimization": true,
  "use_half_precision": true,
  "max_memory_mb": 2048
}

Response: 200
{
  "initialized": true,
  "device_info": {
    "gpu_available": true,
    "gpu_name": "WebGPU Device"
  },
  "model_loaded": true,
  "estimated_memory_mb": 2048
}
```

## Webhooks (Future)

Subscribe to events:
- `image.generated`
- `image.flagged`
- `user.banned`
- `report.created`

## Versioning

Current version: `v1`

Endpoints: `/api/v1/*`

## Support

- API Status: https://status.example.com
- Documentation: https://docs.example.com
- Issues: https://github.com/issues
