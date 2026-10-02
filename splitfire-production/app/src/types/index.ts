import type { ComponentProps } from "react";
import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { NeonColorId } from "@/theme/colors";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type MotionCategoryId =
  | "logo-animations"
  | "transitions"
  | "background-loops"
  | "text-animations"
  | "event-visuals"
  | "overlay-fx";

export type AssetKind = "video" | "poster";

export type StagePattern = "pulse-rings" | "sweep" | "burst" | "typewriter" | "strobe" | "scanlines";

export interface MotionCategory {
  id: MotionCategoryId;
  title: string;
  description: string;
  icon: IconName;
  gradient: readonly [string, string];
}

export interface MotionItem {
  id: string;
  categoryId: MotionCategoryId;
  title: string;
  description: string;
  kind: AssetKind;
  duration: string;
  tags: string[];
  pattern: StagePattern;
  accent: NeonColorId;
  bpmReady: boolean;
}

export type QuickActionType = "intro" | "poster" | "reel";

export interface ProjectConfig {
  primaryColor: NeonColorId;
  secondaryColor: NeonColorId;
  glowIntensity: number; // 0-100
  particleDensity: number; // 0-100
  beatSyncEnabled: boolean;
  bpm: number;
  timelinePhase: number; // 0-1, scrub position within the loop
}

export type ExportFormat = "mp4" | "mov";
export type ExportResolution = "1080p" | "4k";

export interface ExportConfig {
  resolution: ExportResolution;
  format: ExportFormat;
  loop: boolean;
  neonEnhance: boolean;
}

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export interface GeneratedAsset {
  itemId: string;
  status: GenerationStatus;
  progress: number;
  config: ProjectConfig;
  generatedAt?: number;
}
