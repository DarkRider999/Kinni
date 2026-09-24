// Mirrors the backend API (neonforge/backend, spec §5).

export type MediaKind = "image" | "video" | "gif";
export type JobStatus = "pending" | "queued" | "running" | "cancelling" | "succeeded" | "failed" | "cancelled";
export type BatchStatus = "queued" | "running" | "paused" | "completed" | "partial" | "cancelled" | "failed";
export type Resolution = "sd" | "hd" | "fhd" | "4k" | "8k" | "original";

export interface Plan {
  id: string;
  name: string;
  monthly_credits: number;
  max_batch_files: number;
  max_video_seconds: number;
  max_upload_mb: number;
  max_output_res: Resolution;
  max_upscale: number;
  watermark: boolean;
}

export interface Me {
  id: string;
  email: string;
  display_name: string;
  plan: Plan;
  credits: number;
}

export interface FaceInfo {
  index: number;
  box: [number, number, number, number];
  score: number;
}

export interface MediaFile {
  id: string;
  kind: MediaKind;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  fps: number | null;
  frame_count: number | null;
  has_audio: boolean | null;
  analysis: {
    face_count: number;
    faces: FaceInfo[];
    scene: string;
    noise_sigma: number;
    blur_score: number;
    has_alpha: boolean;
  } | null;
  safety_status: string;
  status: string;
  created_at: string;
  url: string;
  thumb_url: string | null;
}

export interface Step {
  op: string;
  params: Record<string, unknown>;
  enabled?: boolean;
}

export interface OutputSpec {
  image_format: "jpg" | "png" | "webp";
  video_format: "mp4" | "mov" | "gif";
  resolution: Resolution;
  quality: "small" | "balanced" | "max";
  strip_metadata: boolean;
  gif_fps: number;
}

export interface RecipeBody {
  version?: number;
  steps: Step[];
  branches?: Partial<Record<MediaKind, Step[]>>;
  output?: Partial<OutputSpec>;
}

export interface Output {
  id: string;
  format: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number;
  filename: string;
  watermarked: boolean;
  url: string;
  download_url: string;
}

export interface Job {
  id: string;
  batch_id: string | null;
  file_id: string;
  kind: "preview" | "render";
  status: JobStatus;
  stage: string | null;
  progress: number;
  attempt: number;
  error: { code: string; message: string } | null;
  credits_cost: number;
  resolved_models: { op: string; models: string[] }[] | null;
  outputs: Output[] | null;
  created_at: string;
  finished_at: string | null;
  recipe: RecipeBody;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  total_files: number;
  done_files: number;
  failed_files: number;
  progress: number;
  credits_reserved: number;
  credits_spent: number;
  recipe: RecipeBody;
  created_at: string;
  finished_at: string | null;
}

export interface Preset {
  id: string;
  category: "lut" | "background" | "outfit" | "expression";
  subcategory: string | null;
  name: string;
  payload: { kind?: string; colors?: string[]; angle?: number; lut?: string };
  tier: string;
}

export interface SavedRecipe {
  id: string;
  name: string;
  body: RecipeBody;
  system: boolean;
  created_at: string;
}

export interface UserSettings {
  language: string;
  theme: "dark" | "light" | "system";
  quality_lane: "fast" | "balanced" | "max";
  default_image_format: "jpg" | "png" | "webp";
  default_video_format: "mp4" | "mov" | "gif";
  default_resolution: Resolution;
  naming_pattern: string;
  strip_metadata: boolean;
  auto_delete_days: number;
  notify_job_complete: boolean;
}

export interface JobEvent {
  type: "job.progress";
  job_id: string;
  batch_id: string | null;
  file_id: string;
  kind: "preview" | "render";
  status: JobStatus;
  stage: string | null;
  progress: number;
  error: { code: string; message: string } | null;
}

export interface BatchEvent extends Omit<Batch, "recipe"> {
  type: "batch.progress";
}

export type ServerEvent = JobEvent | BatchEvent | { type: "hello" | "ping" };
