import { Platform } from "react-native";

const monoFamily = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const typography = {
  fontFamily: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  fontFamilyMono: monoFamily,
  tagline: {
    fontSize: 15,
    letterSpacing: 4,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
  },
  display: { fontSize: 34, fontWeight: "800" as const, letterSpacing: 0.3 },
  h1: { fontSize: 26, fontWeight: "800" as const, letterSpacing: 0.2 },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 21 },
  caption: { fontSize: 12.5, fontWeight: "500" as const, letterSpacing: 0.4 },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  xxxl: 48,
};
