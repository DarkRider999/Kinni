// ─── Enums ─────────────────────────────────────────────
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  MANAGER     = 'manager',
  USER        = 'user',
}

export enum JobStatus {
  QUEUED     = 'queued',
  PROCESSING = 'processing',
  COMPLETE   = 'complete',
  ERROR      = 'error',
  CANCELLED  = 'cancelled',
}

export enum CaptionStyle {
  WAVY     = 'wavy',
  EXCITED  = 'excited',
  TENSION  = 'tension',
  NEON     = 'neon',
  LOWKEY   = 'lowkey',
  ANIMATED = 'animated',
}

export enum AIVideoStyle {
  FOUND_FOOTAGE = 'found-footage',
  ANIMAL_CLIPS  = 'animal-clips',
  SECURITY_CAM  = 'security-cam',
  COURT_COMEDY  = 'court-comedy',
  CARTOON_3D    = '3d-cartoon',
}

export enum CreditTransactionType {
  PURCHASE = 'purchase',
  USAGE    = 'usage',
  REFUND   = 'refund',
  BONUS    = 'bonus',
  ADMIN    = 'admin_adjustment',
}

export enum PaymentStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  FAILED    = 'failed',
  REFUNDED  = 'refunded',
}

// ─── User ──────────────────────────────────────────────
export interface IUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IUserPublic {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  totp_enabled: boolean;
  roles: UserRole[];
  credits_balance: number;
  created_at: Date;
}

// ─── Auth ──────────────────────────────────────────────
export interface ITokenPair {
  access_token: string;   // 15-min JWT
  refresh_token: string;  // 7-day JWT
  expires_in: number;     // seconds
}

export interface IJwtPayload {
  sub: string;         // user.id
  email: string;
  roles: UserRole[];
  iat: number;
  exp: number;
}

// ─── Job ───────────────────────────────────────────────
export interface IJob {
  id: string;
  user_id: string;
  source_url: string;
  source_platform: 'youtube' | 'tiktok' | 'instagram' | 'upload';
  source_duration_seconds: number;
  credits_charged: number;
  status: JobStatus;
  clip_count: number;
  caption_style: CaptionStyle;
  caption_language: string;
  ai_video_style: AIVideoStyle | null;
  progress_percent: number;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

// ─── Clip ──────────────────────────────────────────────
export interface IClip {
  id: string;
  job_id: string;
  user_id: string;
  title: string;
  start_time: number;   // seconds
  end_time: number;
  duration: number;
  hook_score: number;    // 0–10
  flow_score: number;    // 0–10
  value_score: number;   // 0–10
  overall_score: number; // average
  video_url: string;     // S3 pre-signed
  thumbnail_url: string;
  is_favorite: boolean;
  export_count: number;
  created_at: Date;
}

export interface ICaption {
  id: string;
  clip_id: string;
  language: string;
  style: CaptionStyle;
  srt_content: string;
  vtt_content: string;
  word_timestamps: IWordTimestamp[];
}

export interface IWordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

// ─── Billing ───────────────────────────────────────────
export interface ICredit {
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  updated_at: Date;
}

export interface ICreditTransaction {
  id: string;
  user_id: string;
  type: CreditTransactionType;
  amount: number;          // positive = add, negative = deduct
  balance_after: number;
  description: string;
  reference_id: string | null; // job_id or payment_id
  created_at: Date;
}

export interface IPayment {
  id: string;
  user_id: string;
  dodo_payment_id: string;
  amount_cents: number;
  currency: string;
  credits_granted: number;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ─── Admin ─────────────────────────────────────────────
export interface IAuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string;
  user_agent: string;
  details: Record<string, unknown>;
  created_at: Date;
}

export interface IAdminStats {
  total_users: number;
  active_users_24h: number;
  total_jobs: number;
  jobs_today: number;
  total_clips: number;
  revenue_total_cents: number;
  revenue_month_cents: number;
  credits_in_circulation: number;
}

// ─── Media ─────────────────────────────────────────────
export interface IMediaAsset {
  id: string;
  user_id: string;
  job_id: string | null;
  clip_id: string | null;
  file_type: 'source_video' | 'clip_video' | 'thumbnail' | 'caption_file';
  s3_key: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: Date;
}

export interface IPresignedUrl {
  url: string;
  key: string;
  expires_in: number;
}

// ─── API Responses ─────────────────────────────────────
export interface IApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// ─── Credit Pricing ────────────────────────────────────
export const CREDIT_PACKAGES = [
  { id: 'starter',    credits: 30,  price_cents: 900,   label: 'Starter',    per_credit: 30 },
  { id: 'creator',    credits: 100, price_cents: 2400,  label: 'Creator',    per_credit: 24 },
  { id: 'pro',        credits: 300, price_cents: 5700,  label: 'Pro',        per_credit: 19 },
  { id: 'enterprise', credits: 1000, price_cents: 15000, label: 'Enterprise', per_credit: 15 },
] as const;
