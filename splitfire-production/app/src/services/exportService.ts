import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { ExportConfig, ExportResolution } from "@/types";

const resolutionPixels: Record<ExportResolution, string> = {
  "1080p": "1920 × 1080",
  "4k": "3840 × 2160",
};

export interface ExportProgressEvent {
  progress: number;
  stage: "encoding" | "rendering" | "finalizing" | "done";
}

/**
 * Simulates the render/encode pipeline for the chosen format/resolution.
 * A full MP4/MOV encoder is a native/cloud render-farm concern (tracked as
 * the next backend milestone — see docs/splitfire-production/SPEC.md); this
 * MVP pipeline still produces a real, savable artifact today by capturing
 * the live SplitFire Motion Engine stage as a high-resolution PNG frame via
 * the `captureRef` passed in from the screen.
 */
export async function runExportPipeline(
  config: ExportConfig,
  onProgress: (event: ExportProgressEvent) => void
) {
  const weight = config.resolution === "4k" ? 1.6 : 1;
  const steps: Array<{ progress: number; stage: ExportProgressEvent["stage"] }> = [
    { progress: 18, stage: "rendering" },
    { progress: 42, stage: "rendering" },
    { progress: 66, stage: "encoding" },
    { progress: 85, stage: "encoding" },
    { progress: 97, stage: "finalizing" },
    { progress: 100, stage: "done" },
  ];
  for (const step of steps) {
    await delay((160 + Math.random() * 160) * weight);
    onProgress(step);
  }
  return { pixelDimensions: resolutionPixels[config.resolution] };
}

export async function saveSnapshotToDevice(uri: string, label: string) {
  if (Platform.OS === "web") {
    return { saved: false, shared: await maybeShareWeb(uri) };
  }
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { dialogTitle: label });
      return { saved: false, shared: true };
    }
    throw new Error("Photo library permission denied");
  }
  const asset = await MediaLibrary.createAssetAsync(uri);
  await MediaLibrary.createAlbumAsync("SplitFire Production", asset, false).catch(() => {});
  return { saved: true, shared: false, assetId: asset.id };
}

async function maybeShareWeb(uri: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
    return true;
  }
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
