# AI Image Generator - Enterprise Full Stack Application

A comprehensive, production-ready AI image generation platform with enterprise-grade safety, moderation, and creator tools.

## Features

### Core Generation
- **Advanced Realism Control**: Adaptive sliders for photorealism levels
- **Pose & Composition Assistant**: Preset poses and camera angles
- **Professional Lighting**: Studio-quality lighting presets
- **Dynamic Style Fusion**: Blend multiple artistic styles with customizable blend amounts
- **WebGPU Local Rendering**: Process images on user's device for offline generation

### Safety & Compliance
- **Comprehensive Safety System**:
  - Prompt safety classifier (pre-generation)
  - Output safety classifier (post-generation)
  - Risk scoring engine (1-10 severity scale)
  - Auto-flagging and auto-blocking for high-severity content
  - Human review workflow
- **Always-Enabled Safety Filters**: Safety cannot be disabled
- **Compliance Logging**: Full audit trail of all actions

### Admin & Moderation
- **Super Admin Dashboard**: Complete system control
  - System overview and analytics
  - Moderation queue management
  - User management and banning
  - Billing overview
  - System logs and audit trails
- **Moderation System**:
  - AI-powered recommendations
  - Manual review workflows
  - Severity scoring and reporting
  - Bulk action capabilities
- **Mandatory 2FA**: Required for all admin accounts
- **IP Restrictions**: Configurable IP allowlists
- **Suspicious Activity Detection**: Real-time threat monitoring

### Creator Mode
- **Identity Verification**: Government-issued ID verification
- **Creator Profiles**: Verified creator status
- **Rights Management**: Copyright and usage rights tracking
- **AI Enhancement**: AI-powered artistic variations
- **Creator Analytics**: Views, downloads, earnings
- **Earnings Dashboard**: Revenue tracking and payouts

### Personal Vault
- **Zero-Knowledge Encryption**: End-to-end encrypted storage
- **PIN Protection**: Secure PIN-based access control
- **Panic Hide Mode**: Instantly hide vault from view
- **Region-Aware Privacy**: Data locality options
- **Secure Deletion**: Cryptographic deletion

### Additional Features
- **Image Gallery**: Organized image management
- **Public Sharing**: Share images with customizable access
- **Favorites System**: Bookmark favorite images
- **User Dashboard**: Statistics and quick actions
- **Subscription Management**: Flexible credit system
- **Responsive Design**: Mobile-first UI

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: AWS S3 (or MinIO)
- **Authentication**: JWT with 2FA support
- **Async**: Python asyncio with Uvicorn
- **ORM**: SQLAlchemy

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **UI Components**: Custom + Tailwind
- **Type Safety**: TypeScript

### AI/ML
- **Image Generation**: SDXL-like diffusion pipeline
- **Realism Engine**: Custom realism profiles
- **Style Fusion**: Dynamic style blending
- **Safety Classifiers**: NSFW/safety detection
- **Local Rendering**: WebGPU support

### DevOps
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL in container
- **Cache**: Redis in container
- **S3-Compatible**: MinIO for local development

## Project Structure

```
ai-image-generator/
├── backend/
│   ├── api/
│   │   └── routes/          # API endpoints
│   │       ├── auth.py
│   │       ├── generator.py
│   │       ├── safety.py
│   │       ├── gallery.py
│   │       ├── vault.py
│   │       ├── admin.py
│   │       ├── creator.py
│   │       └── moderation.py
│   ├── database/
│   │   ├── models.py        # SQLAlchemy models
│   │   └── migrations/      # Alembic migrations
│   ├── middleware/
│   │   ├── auth.py          # JWT authentication
│   │   ├── audit.py         # Audit logging
│   │   └── safety.py        # Safety enforcement
│   ├── services/            # Business logic
│   ├── ai/                  # AI pipeline
│   │   ├── pipeline.py
│   │   ├── realism_engine.py
│   │   ├── style_fusion.py
│   │   └── webgpu_local.py
│   ├── safety/              # Safety system
│   │   ├── prompt_classifier.py
│   │   ├── output_classifier.py
│   │   └── risk_engine.py
│   ├── vault/               # Encryption & storage
│   ├── storage/             # S3 integration
│   ├── config/              # Settings
│   ├── main.py              # Entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Landing page
│   │   ├── dashboard/
│   │   ├── generator/
│   │   ├── vault/
│   │   ├── creator/
│   │   ├── admin/
│   │   ├── gallery/
│   │   ├── auth/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   ├── styles/
│   ├── public/              # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── docs/

Database Tables:
- users (with role-based access)
- prompts
- generated_images
- vault_items / vault_keys
- reports
- moderation_queue
- creator_profiles / creator_uploads
- billing_plans / subscriptions / credit_usage
- audit_logs
- style_fusion_configs
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for local development)
- Node.js 20+ (for frontend development)
- PostgreSQL 16 (if running without Docker)

### Quick Start with Docker

```bash
# Clone the repository
git clone <repo-url>
cd ai-image-generator

# Start all services
docker-compose up -d

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# MinIO Console: http://localhost:9001
```

### Local Development

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

## API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/2fa/enable` - Enable 2FA
- `POST /api/v1/auth/2fa/verify` - Verify 2FA code

### Generator Endpoints
- `POST /api/v1/generator/create` - Generate new image
- `GET /api/v1/generator/styles` - Get available styles
- `POST /api/v1/generator/local-mode/init` - Initialize WebGPU

### Safety Endpoints
- `POST /api/v1/safety/prompt-check` - Pre-generation safety check
- `POST /api/v1/safety/output-check` - Post-generation safety check
- `GET /api/v1/safety/status` - Get safety system status

### Gallery Endpoints
- `GET /api/v1/gallery/images` - List user's images
- `GET /api/v1/gallery/images/{id}` - Get image details
- `DELETE /api/v1/gallery/images/{id}` - Delete image
- `POST /api/v1/gallery/images/{id}/share` - Share image

### Vault Endpoints
- `POST /api/v1/vault/setup` - Initialize vault
- `POST /api/v1/vault/items` - Store vault item
- `GET /api/v1/vault/items` - List vault items
- `POST /api/v1/vault/unlock` - Unlock vault

### Admin Endpoints (Super Admin Only)
- `GET /api/v1/admin/dashboard` - System overview
- `GET /api/v1/admin/moderation-queue` - Moderation queue
- `GET /api/v1/admin/users` - User management
- `POST /api/v1/admin/users/{id}/ban` - Ban user
- `GET /api/v1/admin/audit-logs` - Audit logs
- `GET /api/v1/admin/billing-overview` - Billing stats

### Creator Endpoints
- `POST /api/v1/creator/profile` - Create creator profile
- `POST /api/v1/creator/verify-identity` - Submit identity verification
- `POST /api/v1/creator/upload` - Upload creator content
- `GET /api/v1/creator/profile` - Get creator profile
- `GET /api/v1/creator/earnings` - Get earnings data

### Moderation Endpoints
- `GET /api/v1/moderation/queue` - Get moderation queue
- `POST /api/v1/moderation/review` - Submit moderation review
- `POST /api/v1/moderation/report` - Report content
- `GET /api/v1/moderation/stats` - Moderation statistics

## Configuration

### Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_image_generator
SECRET_KEY=your-secret-key
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
SAFETY_CHECKS_ENABLED=True
REQUIRE_2FA_FOR_ADMIN=True
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=AI Image Generator
```

## Database Schema Highlights

- **Users**: Multi-role system (user, creator, admin, super_admin)
- **Generated Images**: Stores S3 URLs, safety scores, realism metrics
- **Vault**: Zero-knowledge encrypted personal storage
- **Moderation Queue**: Severity scoring and AI recommendations
- **Audit Logs**: Complete compliance logging
- **Subscriptions**: Credit-based billing system

## Safety System Details

### Prompt Safety Check
- Detects harmful prompts before generation
- Returns risk_level: "safe", "warning", "blocked"
- Checks against policy violations

### Output Safety Check
- Analyzes generated images post-generation
- Detects NSFW, violent, harmful content
- Severity scoring: 1-10 scale
- Auto-flags for moderation if needed

### Moderation Queue
- AI recommendation engine
- Manual human review workflow
- Actions: approve, reject, ban_user, review
- Complete audit trail

## Super Admin Features

- Unlimited credits
- Full dashboard access
- 12-hour session limit
- Mandatory 2FA
- IP restriction support
- Suspicious activity alerts
- Complete system logs
- User banning/restrictions
- Billing overview

## Security Features

- JWT authentication with 2FA
- Role-based access control (RBAC)
- Encrypted vault with PIN protection
- Audit logging for all actions
- IP whitelisting for admins
- Suspicious activity detection
- Safety enforcement middleware
- Always-enabled safety filters

## Contributing

See CONTRIBUTING.md for guidelines.

## License

[License Type] - See LICENSE file

## Support

- API Documentation: `/api/v1/docs`
- Issues: GitHub Issues
- Contact: support@example.com

## Deployment

Production deployment requires:
1. Environment variable configuration
2. PostgreSQL database setup
3. AWS S3 bucket configuration
4. SSL/TLS certificates
5. Load balancing setup
6. Monitoring and logging

See docs/DEPLOYMENT.md for detailed instructions.

## Roadmap

- [ ] Advanced style transfer models
- [ ] Multi-user collaborative editing
- [ ] Batch generation API
- [ ] Fine-tuning on user datasets
- [ ] Extended creator monetization
- [ ] Mobile apps (iOS/Android)
- [ ] Advanced analytics dashboard
- [ ] API rate limiting improvements
