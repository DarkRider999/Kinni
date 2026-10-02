import { colors } from "@/theme/colors";

export const brandTagline = "Mix Beyond Reality";
export const brandName = "DJAY RadicalMix";
export const studioName = "SplitFire Production";

export const logoPack = [
  {
    id: "logo-square",
    label: "Primary Mark — Square",
    description: "Glossy red R with integrated headphones, full neon ring backdrop.",
    source: require("../../assets/brand-logo-square.png"),
    usage: "App icon, social avatars, watermark",
  },
  {
    id: "brand-hero",
    label: "Hero Artwork — Hologram",
    description: "Full DJ hologram silhouette behind the R mark, for splash & posters.",
    source: require("../../assets/brand-hero.png"),
    usage: "Splash screen, intros, posters",
  },
];

export const colorPalette = [
  { id: "red", label: "Radical Red", hex: colors.neonRed, role: "Primary neon" },
  { id: "blue", label: "Hologram Blue", hex: colors.neonBlue, role: "Secondary neon" },
  { id: "purple", label: "SplitFire Purple", hex: colors.neonPurple, role: "Accent neon" },
  { id: "ink", label: "Stage Black", hex: colors.background, role: "Background" },
  { id: "surface", label: "Deep Violet Surface", hex: colors.surface, role: "Cards & panels" },
  { id: "white", label: "Stage White", hex: colors.textPrimary, role: "Text / highlights" },
] as const;

export const typeSpecimens = [
  { id: "display", label: "Display", sample: "DJAY RadicalMix", weight: "800", size: 32 },
  { id: "heading", label: "Heading", sample: "SplitFire Production", weight: "700", size: 22 },
  { id: "tagline", label: "Tagline", sample: "MIX BEYOND REALITY", weight: "600", size: 14 },
  { id: "body", label: "Body", sample: "Generate intros, transitions, posters & reels.", weight: "400", size: 15 },
] as const;

export const motionSamples = [
  { id: "m1", label: "Logo Pulse", pattern: "pulse-rings" as const, accent: "red" as const },
  { id: "m2", label: "Ring Sweep", pattern: "sweep" as const, accent: "blue" as const },
  { id: "m3", label: "Particle Burst", pattern: "burst" as const, accent: "purple" as const },
  { id: "m4", label: "Beat Strobe", pattern: "strobe" as const, accent: "red" as const },
];
