/**
 * SplitFire Production brand palette.
 * Core identity: glossy red R + headphones, neon ring (red / blue / purple),
 * DJ hologram silhouette, sparks & particles on a near-black stage.
 */
export const colors = {
  // Base / stage
  background: "#05010A",
  backgroundElevated: "#0B0712",
  surface: "#12091D",
  surfaceAlt: "#180C27",
  border: "rgba(255, 60, 120, 0.18)",
  borderSoft: "rgba(255, 255, 255, 0.08)",

  // Neon trio
  neonRed: "#FF1B4B",
  neonRedSoft: "#FF5577",
  neonBlue: "#1BE7FF",
  neonBlueSoft: "#6FF3FF",
  neonPurple: "#B01BFF",
  neonPurpleSoft: "#D46BFF",

  // Text
  textPrimary: "#F7F4FF",
  textSecondary: "#B8ADCB",
  textMuted: "#7A6E90",
  textOnNeon: "#0B0712",

  // Status
  success: "#2CFFB0",
  warning: "#FFC93C",
  danger: "#FF3B5C",

  // Gradients (array tuples for expo-linear-gradient)
  gradientStage: ["#05010A", "#0D0417", "#05010A"] as const,
  gradientBrand: ["#FF1B4B", "#B01BFF", "#1BE7FF"] as const,
  gradientRedPurple: ["#FF1B4B", "#B01BFF"] as const,
  gradientPurpleBlue: ["#B01BFF", "#1BE7FF"] as const,
  gradientGlass: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"] as const,
  gradientCard: ["#1A0E2B", "#0B0712"] as const,
} as const;

export type NeonColorId = "red" | "blue" | "purple" | "white";

export const neonColorSwatches: Record<
  NeonColorId,
  { label: string; hex: string; glow: string }
> = {
  red: { label: "Radical Red", hex: colors.neonRed, glow: "rgba(255,27,75,0.55)" },
  blue: { label: "Hologram Blue", hex: colors.neonBlue, glow: "rgba(27,231,255,0.5)" },
  purple: { label: "SplitFire Purple", hex: colors.neonPurple, glow: "rgba(176,27,255,0.55)" },
  white: { label: "Stage White", hex: "#F7F4FF", glow: "rgba(247,244,255,0.45)" },
};
