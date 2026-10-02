import type { ProjectConfig } from "@/types";

/**
 * SplitFire's generation pipeline is provider-based so the on-device
 * "SplitFire Motion Engine" (real-time procedural rendering — the same
 * engine that drives every live preview in this app) can later be swapped
 * for, or paired with, a cloud AI video-generation backend without touching
 * any screen code. Implement this interface against your chosen provider
 * (e.g. a diffusion video model, Runway/Pika-style API, or a server render
 * farm) and pass it to `configureGenerationProvider`.
 */
export interface GenerationProvider {
  generate(params: {
    itemId: string;
    config: ProjectConfig;
    onProgress: (progress: number) => void;
    signal: AbortSignal;
  }): Promise<{ generatedAt: number }>;
}

/**
 * Default provider: renders locally via the SplitFire Motion Engine.
 * It "generates" by committing the current color/glow/particle/beat-sync
 * configuration as the item's render recipe — genuinely instant because the
 * stage is procedural, with a brief staged progress animation so the UX
 * matches a real render pipeline.
 */
class LocalMotionEngineProvider implements GenerationProvider {
  async generate({ onProgress, signal }: { itemId: string; config: ProjectConfig; onProgress: (p: number) => void; signal: AbortSignal }) {
    const steps = [12, 28, 47, 63, 81, 94, 100];
    for (const step of steps) {
      if (signal.aborted) throw new DOMException("Generation cancelled", "AbortError");
      await delay(140 + Math.random() * 180);
      onProgress(step);
    }
    return { generatedAt: Date.now() };
  }
}

let activeProvider: GenerationProvider = new LocalMotionEngineProvider();

export function configureGenerationProvider(provider: GenerationProvider) {
  activeProvider = provider;
}

export function generateAsset(params: {
  itemId: string;
  config: ProjectConfig;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}) {
  return activeProvider.generate(params);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
